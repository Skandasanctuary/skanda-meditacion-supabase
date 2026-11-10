-- =====================================================================
--  PARTE 1 de 3: tablas y seguridad
--  Pégalo en Supabase > SQL Editor > New query y pulsa "Run".
--  Resultado esperado: "Success. No rows returned"
-- =====================================================================

-- Programa (por ahora solo el reto de 11 días)
create table if not exists public.programs (
  id               text primary key,
  title            text not null,
  start_date       date not null,                                   -- día 1
  unlock_hour      integer not null default 6 check (unlock_hour between 0 and 23),
  utc_offset_hours integer not null default -5 check (utc_offset_hours between -12 and 14),  -- Bogotá
  unlock_all       boolean not null default false                   -- true = modo de prueba (todos los días abiertos)
);

-- Contenido de cada día (editable desde Table Editor)
create table if not exists public.program_days (
  program_id  text not null references public.programs (id) on delete cascade,
  day         integer not null check (day >= 1),
  title       text not null,
  description text not null,
  audio_url   text,        -- nombre del archivo en Storage (ej. dia-01.mp3) o un enlace completo https://...
  reflection  text,        -- se muestra al completar el día
  primary key (program_id, day)
);

-- Personas: nombre, WhatsApp, ciudad y país (el login vive en Supabase Auth, no aquí)
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 2 and 80),
  phone        text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,25}$'),
  city         text check (city is null or char_length(city) between 2 and 80),
  country      text check (country is null or char_length(country) between 2 and 80),
  created_at   timestamptz not null default now()
);

-- Días completados: una fila por persona, programa y día (no se puede repetir)
create table if not exists public.completions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  program_id   text not null references public.programs (id) on delete cascade,
  day          integer not null check (day >= 1),
  completed_at timestamptz not null default now(),
  unique (user_id, program_id, day)
);
create index if not exists completions_user_program_idx on public.completions (user_id, program_id);

-- =====================================================================
--  SEGURIDAD: cada persona solo puede ver y editar lo suyo
-- =====================================================================
alter table public.programs     enable row level security;
alter table public.program_days enable row level security;
alter table public.profiles     enable row level security;
alter table public.completions  enable row level security;

-- Programa, días y completados: el navegador NO los toca directamente.
-- Solo se leen y escriben a través de las funciones de la parte 2.
revoke all on public.programs, public.program_days, public.completions from anon, authenticated;

-- Perfil: cada persona ve y edita únicamente su propia fila.
revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
