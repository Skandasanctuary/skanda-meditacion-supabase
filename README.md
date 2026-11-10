# Skanda Sanctuary · Meditation app (Supabase version)

People create an account, log in, listen to each day's audio, press **"Marcar el día como completado"**
and see a short **reflection**. Progress is stored per person. Everything the visitor sees is in Spanish.

**Who does what**

| Part | Where it lives |
|---|---|
| The screens (this folder's `public/` + `src/`) | GitHub → published by **Netlify** |
| Login (email + password) | **Supabase Auth** |
| Database (people, progress, the 11 days) | **Supabase** (Postgres) |
| Audio files | **Supabase Storage** (bucket `audio`) — or any link you prefer |
| The rules (which day is open, one completion per day) | Functions **inside the Supabase database** (`supabase/02_functions.sql`) |

Supabase does not host websites, so Netlify (or any static host) still publishes the screens.

## 1. Create the Supabase project
1. supabase.com → sign in (GitHub works) → **New project**. Name: `skanda-meditacion`.
2. Choose a database password and **save it** (you won't need it in the app).
3. Region: **East US (North Virginia)** is a good balance for Colombia and México. It can't be changed later.
4. Plan: Free. Wait ~2 minutes until the project is ready.

## 2. Create the tables, rules and content
Open **SQL Editor → New query**, paste each file, press **Run**, and wait for *"Success. No rows returned"*:
1. `supabase/01_tables_and_security.sql`
2. `supabase/02_functions.sql`
3. `supabase/03_program_content.sql`

If the editor asks you to confirm a "destructive" query, that is normal (the scripts drop and recreate policies); confirm.
Check: **Table Editor** should list `programs`, `program_days`, `profiles`, `completions`; `program_days` has 11 rows.

## 3. Login settings (Authentication)
* **Sign In / Providers → Email**: enabled. For testing, turn **"Confirm email" OFF** so signups log in at once.
  The built-in email sender only allows a couple of emails per hour; for a real cohort set up your own email
  sender (Authentication → SMTP Settings, e.g. Resend) and turn confirmation back on.
* **URL Configuration**: after Netlify gives you an address, set **Site URL** to it and add it to **Redirect URLs**.

## 4. Audio (Storage)
**Storage → New bucket** → name `audio` → switch **Public bucket** on → upload the 11 files from `test-audio/`
(`dia-01.mp3` … `dia-11.mp3`; they are 4-second test tones). Later replace them with the real recordings using the same names.
Free plan limits to keep in mind: 1 GB storage, 50 MB per file, 5 GB bandwidth per month.
You can also put any full link (Wix, Cloudflare R2…) in the `audio_url` column of `program_days` instead of a file name.

## 5. Connect the screens to Supabase
**Project Settings → API Keys**: copy the **Project URL** and the **publishable key** (`sb_publishable_…`).
Never use the *secret* key here. Put the two values in `src/config.js` (both are safe to publish).

## 6. Publish
1. GitHub: new private repository → upload everything in this folder (keep the structure).
2. Netlify: *Add new project → Import an existing project → GitHub →* the repository → Deploy
   (settings come from `netlify.toml`).
3. Copy the Netlify address into Supabase → Authentication → URL Configuration (step 3).

## 7. Test
* Create an account (name, WhatsApp, city, country, email, password). You should land on your 11 beads.
* Before 11 Nov 6:00 a.m. Bogotá time every day is locked. To test earlier: **Table Editor → `programs`** →
  set `unlock_all` to `true` for row `11`, test, then set it back to `false`.
* See your data in **Table Editor → `profiles` / `completions`**.
* Dashboard → **Advisors / Security** should show no tables without Row Level Security.

## Editing without code
In **Table Editor → `program_days`** you can change a day's title, description, audio file and reflection;
in `programs` you can change the start date (`start_date`) and the opening hour.

## Try the screens on your computer (optional, Node 22)
`npm run preview` → http://localhost:8888 — uses a **fake** Supabase that lives in the browser, only to see the screens.
Add `?now=2026-11-14T12:00:00Z` to the address to simulate a date, or `?confirm=1` to require email confirmation.

## Not included yet
Forgot-password screen, reminders, admin view, private audio, English. Add a privacy notice and consent before
real participants use it (you are storing names, emails and phone numbers).
