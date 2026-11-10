// SUPABASE FALSO, solo para la vista previa y las pruebas locales (todo vive en este navegador).
// Imita las mismas respuestas que daría Supabase. En producción se usa @supabase/supabase-js de verdad.
const mem = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return mem[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { mem[k] = v; } }
};
const read = (k, fb) => { try { return JSON.parse(store.get(k) || "null") ?? fb; } catch { return fb; } };
const write = (k, v) => store.set(k, JSON.stringify(v));

const params = new URLSearchParams(location.search);
const CONFIRM_EMAILS = params.get("confirm") === "1";
const nowMs = () => Date.parse(params.get("now") || store.get("fake_now") || new Date().toISOString());

let programPromise;
const program = () => (programPromise ??= fetch("/dev/program.json").then((r) => r.json()));

const DAY = 86400000;
function firstUnlock(p) {
  const [y, m, d] = p.startDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d, p.unlockHour - p.utcOffsetHours);
}
function today(p, unlockAll) {
  if (unlockAll) return p.days.length;
  const f = firstUnlock(p), now = nowMs();
  return now < f ? 0 : Math.min(p.days.length, Math.floor((now - f) / DAY) + 1);
}
const sessionUser = () => {
  const s = read("fake_session", null);
  if (!s) return null;
  const u = read("fake_users", {})[s.email];
  return u ? { id: u.id, email: s.email, user_metadata: { full_name: u.full_name } } : null;
};

async function getState(uid, unlockAll = !!read("fake_unlock_all", false)) {
  const p = await program();
  const t = today(p, unlockAll), f = firstUnlock(p);
  const done = new Set(read("fake_completions", []).filter((c) => c.user_id === uid).map((c) => c.day));
  return {
    program: { id: p.id, title: p.title, startDate: p.startDate, totalDays: p.days.length, testMode: unlockAll },
    today: t,
    days: p.days.map((d, i) => {
      const n = i + 1;
      return {
        day: n, title: d.title, description: d.description,
        status: done.has(n) ? "completed" : n <= t ? "available" : "locked",
        unlocksAt: new Date(f + i * DAY).toISOString(),
        audioUrl: n <= t ? d.audio : null,
        reflection: done.has(n) ? d.reflection : null
      };
    })
  };
}

const PHONE = /^\+?[0-9 ()-]{7,25}$/;
function checkProfile(row) {
  const len = (v) => v == null || (String(v).length >= 2 && String(v).length <= 80);
  return len(row.display_name) && len(row.city) && len(row.country) && (row.phone == null || PHONE.test(row.phone));
}

export function createClient() {
  window.__confirm = (email) => { const u = read("fake_users", {}); if (u[email]) { u[email].confirmed = true; write("fake_users", u); } };
  return {
    auth: {
      async getSession() {
        const user = sessionUser();
        return { data: { session: user ? { user } : null }, error: null };
      },
      async signUp({ email, password, options }) {
        const users = read("fake_users", {});
        if (users[email]) return { data: { user: null, session: null }, error: null };   // como Supabase: no revela si ya existe
        users[email] = { id: "u-" + (Object.keys(users).length + 1), password, full_name: options?.data?.full_name || "", confirmed: !CONFIRM_EMAILS };
        write("fake_users", users);
        if (CONFIRM_EMAILS) return { data: { user: { email }, session: null }, error: null };
        write("fake_session", { email });
        return { data: { user: sessionUser(), session: { user: sessionUser() } }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const u = read("fake_users", {})[email];
        if (!u || u.password !== password) return { data: {}, error: { message: "Invalid login credentials" } };
        if (!u.confirmed) return { data: {}, error: { message: "Email not confirmed" } };
        write("fake_session", { email });
        return { data: { session: { user: sessionUser() } }, error: null };
      },
      async signOut() { store.set("fake_session", "null"); return { error: null }; }
    },
    from(table) {
      if (table !== "profiles") throw new Error("tabla no permitida: " + table);
      return {
        select() {
          let uid = null;
          const q = { eq(_c, v) { uid = v; return q; },
            async maybeSingle() {
              const me = sessionUser();
              if (!me) return { data: null, error: { message: "JWT required" } };
              if (uid !== me.id) return { data: null, error: null };       // RLS: solo la propia fila
              return { data: read("fake_profiles", {})[me.id] ?? null, error: null };
            } };
          return q;
        },
        async upsert(row) {
          const me = sessionUser();
          if (!me || row.user_id !== me.id) return { error: { message: "RLS violation" } };
          if (!checkProfile(row)) return { error: { message: "check constraint" } };
          const all = read("fake_profiles", {});
          all[me.id] = { display_name: row.display_name, phone: row.phone, city: row.city, country: row.country };
          write("fake_profiles", all);
          return { error: null };
        }
      };
    },
    async rpc(name, args) {
      const me = sessionUser();
      if (!me) return { data: null, error: { message: "not authenticated", code: "28000" } };
      if (name === "get_state") return { data: await getState(me.id), error: null };
      if (name === "complete_day") {
        const p = await program(), unlockAll = !!read("fake_unlock_all", false);
        const day = args.p_day;
        if (!Number.isInteger(day) || day < 1 || day > today(p, unlockAll)) return { data: null, error: { message: "day is locked or invalid", code: "P0001" } };
        const all = read("fake_completions", []);
        if (!all.some((c) => c.user_id === me.id && c.day === day)) { all.push({ user_id: me.id, day }); write("fake_completions", all); }
        return { data: await getState(me.id), error: null };
      }
      return { data: null, error: { message: "función desconocida" } };
    }
  };
}
