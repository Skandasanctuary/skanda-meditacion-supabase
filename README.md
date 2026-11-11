# Skanda Sanctuary · Meditation app (Supabase version)

People log in with their **email and the WhatsApp number they signed up with** (no password to remember),
listen to each day's audio, press **"Marcar el día como completado"** and see a short **reflection**.
Progress is stored per person. Everything the visitor sees is in Spanish.

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

## 2b. Use the sign-ups you already have (roster)
People already gave their name, email, WhatsApp and country on the landing page, so the app does not ask again.
1. SQL Editor → run `supabase/04_roster.sql` (creates the `roster` table and the matching function).
2. Export your sign-ups: Netlify → your landing project → **Forms** → the sign-up form → download as CSV.
3. In a spreadsheet keep only four columns and rename them to exactly: `email`, `name`, `phone`, `country`
   (see `roster_template.csv`). Write emails in lowercase, put the country code in phone numbers (+57…), and
   delete duplicate emails.
4. Supabase → **Table Editor → `roster` → Import data from CSV**.
5. When someone logs in with the same email **and** the same number as in the list, their name, phone and country
   are copied into their profile automatically. People who are not on the list (or typed a different number)
   see a short "one last step" form once.
The phone numbers in the roster are never shown in the app.

## How login works
* **Creating an account:** email + WhatsApp number. The **last 8 digits of the number** become the account's
  initial password (it works with or without the country code, and with spaces or dashes).
* **Logging in:** email + "Contraseña". Until the person changes it, the password is the **last 8 digits of their
  WhatsApp number**; typing the whole number also works. The app tries that first and then whatever was typed as a
  custom password, so both kinds work.
* **Changing the password:** once logged in, the **"Cambiar contraseña"** link (next to "Salir") lets them choose
  their own password (8+ characters). From then on the number no longer works; they log in with the new password.
* **Forgot password:** the "¿Olvidaste tu contraseña?" link on the login screen sends an email with a link to create a
  new one. This needs **your own email sender** (Authentication → SMTP Settings): Supabase's built-in sender only
  allows a couple of emails per hour. Also add your Netlify address under Authentication → URL Configuration →
  Redirect URLs, or the link will not work. If emails are not set up yet, someone who changed their password and
  forgot it will be locked out until you help them in Supabase → Authentication → Users (check which actions your
  dashboard offers there, for example sending a recovery email or deleting the account so they can register again).
* Why 8 digits and not 4: Supabase requires passwords of at least 6 characters, and 4 digits are only 10,000
  possibilities.
* **Be aware:** a phone number is not a secret. While someone has not changed their password, anyone who knows their
  email *and* number could log in as them. Here that only exposes a first name and which days they ticked (the phone
  number is never displayed), so it is a reasonable trade-off for a free program. Encourage people to change it.

## 3. Login settings (Authentication)
* **Sign In / Providers → Email**: enabled. For testing, turn **"Confirm email" OFF** so new accounts log in at once.
  The built-in email sender only allows a couple of emails per hour; for the real cohort set up your own email
  sender (Authentication → SMTP Settings, e.g. Resend) and turn confirmation back on. With confirmation off, someone
  could register another person's email before they do; with it on, that cannot happen.
* Leave the **password requirements at their defaults** (minimum length 6, no required letters/symbols). Do not
  switch on strength rules that reject digit-only passwords, or the login will stop working.
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
* **Crear cuenta** with an email and number that are in your roster. You should land on your 11 beads with your
  name already filled in. Log out and **Entrar** again, typing the number as the password, with and without the
  country code: both work.
* **Cambiar contraseña** → choose a new one → log out → the old number is rejected and the new password works.
* "¿Olvidaste tu contraseña?" → you receive an email → the link opens "Crea tu contraseña nueva" (needs the email
  sender and the Redirect URL from step 3).
* Try an email that is not in the roster: you get the "one last step" form (the number you typed is prefilled).
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
