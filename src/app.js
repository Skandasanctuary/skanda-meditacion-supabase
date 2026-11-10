// Pantalla de la persona: entrar, ver los 11 días, escuchar el audio y marcar el día (con Supabase).
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, PROGRAM_ID, AUDIO_BUCKET } from "./config.js";
import { cleanProfile } from "./profile.js";

const $ = (id) => document.getElementById(id);
const views = { loading: $("loading"), auth: $("auth"), profile: $("profile"), app: $("app") };
const PENDING = "pending_profile";

const configured = !SUPABASE_URL.includes("TU-PROYECTO") && !SUPABASE_PUBLISHABLE_KEY.includes("TU_CLAVE");
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) : null;

let state = null;          // estado listo para pintar
let selected = 1;          // día que se está viendo
let justCompleted = null;  // { day } para animar la reflexión recién desbloqueada
let mode = "login";        // "login" | "signup"

/* ---------- utilidades ---------- */
function show(name) {
  for (const k in views) views[k].hidden = k !== name;
  $("logout").hidden = name !== "app";
}
function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids) if (kid != null) node.append(kid);
  return node;
}
function when(iso) {
  return new Date(iso).toLocaleString("es-CO", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota"
  }) + " (hora de Bogotá)";
}
const LABEL = { completed: "completado", available: "disponible", locked: "aún cerrado" };

const memory = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return memory[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { memory[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch { delete memory[k]; } }
};
function readPending() {
  try { return JSON.parse(store.get(PENDING) || "null"); } catch { return null; }
}

/** Un audio puede ser un enlace completo o el nombre de un archivo en Storage. */
function audioSrc(value) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `${SUPABASE_URL}/storage/v1/object/public/${AUDIO_BUCKET}/${encodeURIComponent(value)}`;
}

/* ---------- datos (Supabase) ---------- */
async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles")
    .select("display_name, phone, city, country").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;  // null si todavía no existe
}
const isComplete = (p) => Boolean(p && p.display_name && p.phone && p.city && p.country);

async function saveProfile(userId, input) {
  const result = cleanProfile(input);
  if (!result.ok) return { ok: false, errors: result.errors };
  const v = result.value;
  const { error } = await supabase.from("profiles")
    .upsert({ user_id: userId, display_name: v.name, phone: v.phone, city: v.city, country: v.country }, { onConflict: "user_id" });
  if (error) return { ok: false, errors: { general: "No pudimos guardar tus datos. Intenta de nuevo." } };
  return { ok: true };
}

/** Convierte la respuesta de get_state / complete_day en lo que pintan las pantallas. */
function shapeProgress(raw) {
  const days = raw.days.map((d) => ({ ...d, audioUrl: audioSrc(d.audioUrl) }));
  const done = days.filter((d) => d.status === "completed").length;
  const next = days.find((d) => d.status === "available");
  return {
    program: raw.program,
    today: raw.today,
    completedCount: done,
    nextDay: next ? next.day : null,
    finished: done === raw.program.totalDays,
    testMode: Boolean(raw.program.testMode),
    days
  };
}

/* ---------- entrar / crear cuenta ---------- */
function setMode(next) {
  mode = next;
  $("tab-login").setAttribute("aria-selected", String(next === "login"));
  $("tab-signup").setAttribute("aria-selected", String(next === "signup"));
  $("signup-fields").hidden = next !== "signup";
  $("auth-submit").textContent = next === "signup" ? "Crear cuenta" : "Entrar";
  $("password").autocomplete = next === "signup" ? "new-password" : "current-password";
  authMessage("");
}
function authMessage(text, isError = false) {
  const m = $("auth-msg");
  m.textContent = text;
  m.className = "msg" + (isError ? " err" : "");
}
$("auth-form").addEventListener("input", () => { if ($("auth-msg").classList.contains("err")) authMessage(""); });
$("tab-login").addEventListener("click", () => setMode("login"));
$("tab-signup").addEventListener("click", () => setMode("signup"));

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!configured) return;
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || password.length < 8) return authMessage("Escribe tu correo y una contraseña de al menos 8 caracteres.", true);
  const profile = { name: $("name").value.trim(), phone: $("phone").value.trim(), city: $("city").value.trim(), country: $("country").value.trim() };
  if (mode === "signup" && (!profile.name || !profile.phone || !profile.city || !profile.country)) {
    return authMessage("Completa tu nombre, WhatsApp, ciudad y país.", true);
  }

  const btn = $("auth-submit");
  btn.disabled = true;
  authMessage("");
  try {
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: profile.name } } });
      if (error) throw error;
      // Guardamos los datos hasta tu primer ingreso (si confirmas por correo, se envían entonces).
      store.set(PENDING, JSON.stringify(profile));
      if (data.session) return await loadState();
      authMessage("Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve aquí para entrar.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadState();
    }
  } catch (err) {
    const notConfirmed = /not confirmed/i.test(err?.message || "");
    authMessage(
      notConfirmed ? "Primero confirma tu correo: te enviamos un mensaje con un enlace."
      : mode === "signup" ? "No pudimos crear tu cuenta. Revisa tus datos o intenta con otro correo."
      : "No pudimos iniciar sesión. Revisa tu correo y contraseña.", true);
  } finally {
    btn.disabled = false;
  }
});

$("logout").addEventListener("click", async () => {
  try { await supabase.auth.signOut(); } catch {}
  state = null;
  $("password").value = "";
  setMode("login");
  show("auth");
});

/* ---------- datos de la persona ("un último paso") ---------- */
function showProfileForm(p = {}) {
  $("p-name").value = p.name || "";
  $("p-phone").value = p.phone || "";
  $("p-city").value = p.city || "";
  $("p-country").value = p.country || "";
  $("p-msg").textContent = "";
  show("profile");
}
$("profile-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("p-submit"), msg = $("p-msg");
  msg.textContent = ""; msg.className = "msg";
  btn.disabled = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { show("auth"); return; }
    const result = await saveProfile(session.user.id, {
      name: $("p-name").value, phone: $("p-phone").value, city: $("p-city").value, country: $("p-country").value
    });
    if (!result.ok) { msg.className = "msg err"; msg.textContent = Object.values(result.errors).join(" "); return; }
    await loadState();
  } finally {
    btn.disabled = false;
  }
});

/* ---------- panel ---------- */
async function loadState() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { show("auth"); return; }
  const user = session.user;

  try {
    let profile = await fetchProfile(user.id);
    if (!isComplete(profile)) {
      const pending = readPending();
      if (pending) {
        await saveProfile(user.id, pending);
        store.del(PENDING);
        profile = await fetchProfile(user.id);
      }
      if (!isComplete(profile)) {
        showProfileForm({ name: profile?.display_name ?? user.user_metadata?.full_name ?? "", phone: profile?.phone, city: profile?.city, country: profile?.country });
        return;
      }
    }
    const { data, error } = await supabase.rpc("get_state", { p_program: PROGRAM_ID });
    if (error) throw error;
    state = { user: { email: user.email, name: profile.display_name }, ...shapeProgress(data) };
  } catch (err) {
    show("app");
    $("hello").textContent = "No pudimos cargar tu avance";
    $("status").textContent = "Revisa tu conexión y recarga la página.";
    return;
  }
  selected = state.nextDay ?? (state.days.filter((d) => d.status !== "locked").pop()?.day ?? 1);
  render();
  show("app");
}

function render() {
  const total = state.program.totalDays;
  $("hello").textContent = state.user.name ? `Hola, ${state.user.name}` : "Hola";
  $("testmode").hidden = !state.testMode;
  $("status").textContent = state.today === 0
    ? `El reto inicia el ${when(state.days[0].unlocksAt)}.`
    : `Día ${state.today} de ${total} · ${state.completedCount} completado${state.completedCount === 1 ? "" : "s"}`;
  renderRing(total);
  renderCard();
  renderFinish();
}

function renderRing(total) {
  const ring = $("ring");
  ring.replaceChildren();
  ring.insertAdjacentHTML("afterbegin",
    '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width=".5"/></svg>');
  ring.append(el("div", { class: "ring-center" },
    el("div", { class: "big", text: String(state.completedCount) }),
    el("div", { class: "small", text: `de ${total} días` })));

  state.days.forEach((d, i) => {
    const a = (-90 + (i * 360) / total) * Math.PI / 180;
    ring.append(el("button", {
      type: "button",
      class: `bead ${d.status}` + (d.day === selected ? " sel" : "") + (justCompleted?.day === d.day ? " pop" : ""),
      style: `left:${50 + 40 * Math.cos(a)}%;top:${50 + 40 * Math.sin(a)}%`,
      "aria-label": `Día ${d.day}: ${d.title}, ${LABEL[d.status]}`,
      "aria-pressed": String(d.day === selected),
      text: String(d.day),
      onclick: () => { selected = d.day; justCompleted = null; render(); }
    }));
  });
}

function renderCard() {
  const d = state.days.find((x) => x.day === selected);
  const card = $("day-card");
  card.replaceChildren(
    el("p", { class: "when", text: `Día ${d.day} de ${state.program.totalDays}` }),
    el("h2", { text: d.title }),
    el("p", { class: "desc", text: d.description })
  );

  if (d.status === "locked") {
    card.append(el("p", { class: "locknote", text: `Este día se abre el ${when(d.unlocksAt)}.` }));
    return;
  }

  const audio = el("audio", { controls: true, preload: "none", src: d.audioUrl, "aria-label": `Audio del día ${d.day}` });
  const note = el("p", { class: "audio-missing", hidden: true, text: "El audio de este día aún no está disponible." });
  audio.addEventListener("error", () => { audio.hidden = true; note.hidden = false; });
  card.append(audio, note);

  if (d.status === "available") {
    const btn = el("button", { class: "btn", type: "button", text: `Marcar el día ${d.day} como completado` });
    btn.addEventListener("click", () => completeDay(d.day, btn));
    card.append(btn);
  } else {
    card.append(el("span", { class: "badge", text: "Día completado ✓" }));
  }

  if (d.reflection) {
    card.append(el("blockquote", { class: "quote" + (justCompleted?.day === d.day ? " reveal" : "") },
      el("span", { class: "label", text: "Reflexión del día" }),
      el("p", { text: d.reflection })));
  }
}

function renderFinish() {
  const box = $("finish");
  box.hidden = !state.finished;
  if (!state.finished) return;
  box.replaceChildren(
    el("h2", { text: "Completaste los 11 días" }),
    el("p", { text: "Gracias por sentarte contigo durante todo este camino. Pronto compartiremos contigo los siguientes pasos." }));
}

async function completeDay(day, btn) {
  btn.disabled = true;
  btn.textContent = "Guardando…";
  const { data, error } = await supabase.rpc("complete_day", { p_program: PROGRAM_ID, p_day: day });
  if (error) {
    btn.disabled = false;
    btn.textContent = `Marcar el día ${day} como completado`;
    const expired = /JWT|not authenticated|401/i.test(error.message || "") || error.code === "28000";
    btn.after(el("p", { class: "msg err", text: expired ? "Tu sesión terminó. Vuelve a entrar." : "No pudimos guardar tu avance. Intenta de nuevo." }));
    if (expired) show("auth");
    return;
  }
  state = { ...state, ...shapeProgress(data) };
  justCompleted = { day };
  selected = day;
  render();
}

/* ---------- inicio ---------- */
(async function start() {
  if (!configured) {
    views.loading.querySelector("p").textContent =
      "Falta conectar Supabase: abre src/config.js y pega la dirección de tu proyecto y tu clave pública.";
    return;
  }
  show("loading");
  await loadState();
})();
