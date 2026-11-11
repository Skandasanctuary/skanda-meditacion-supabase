-- =====================================================================
--  PARTE 4: lista de inscritos (roster) y "reclamar" el perfil
--  Así nadie tiene que volver a escribir su nombre, WhatsApp y país:
--  al entrar con el mismo correo Y el mismo número con los que se inscribió,
--  sus datos se copian solos a su perfil.
--  Resultado esperado: "Success. No rows returned"
-- =====================================================================

-- La lista de inscritos (la importas desde un CSV, ver README). Nadie la puede leer desde la app.
create table if not exists public.roster (
  email      text primary key,        -- en minúsculas
  name       text,
  phone      text,                    -- con código de país, ej. +57 300 123 4567
  country    text,
  source     text,                    -- opcional: de dónde viene (ej. "landing nov 2026")
  created_at timestamptz not null default now()
);
alter table public.roster enable row level security;
revoke all on public.roster from anon, authenticated;

-- Si habías ejecutado una versión anterior (sin parámetro), se elimina.
drop function if exists public.claim_roster_profile();

-- Copia los datos de la lista al perfil de la persona que acaba de entrar.
-- Exige que coincidan el CORREO de la cuenta y los últimos 8 dígitos del NÚMERO escrito,
-- así no basta con conocer un correo para "reclamar" los datos de otra persona.
create or replace function public.claim_roster_profile(p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  u_email text;
  typed text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  r public.roster;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if char_length(typed) < 8 then
    return false;
  end if;

  select lower(u.email) into u_email from auth.users u where u.id = uid;
  if u_email is null then
    return false;
  end if;

  select * into r
  from public.roster ro
  where lower(ro.email) = u_email
    and right(regexp_replace(coalesce(ro.phone, ''), '\D', '', 'g'), 8) = typed;
  if not found then
    return false;
  end if;

  insert into public.profiles as p (user_id, display_name, phone, country)
  values (
    uid,
    case when char_length(btrim(coalesce(r.name, ''))) between 2 and 80 then btrim(r.name) end,
    case when btrim(coalesce(r.phone, '')) ~ '^\+?[0-9 ()-]{7,25}$' then btrim(r.phone) end,
    case when char_length(btrim(coalesce(r.country, ''))) between 2 and 80 then btrim(r.country) end
  )
  on conflict (user_id) do update set
    display_name = coalesce(p.display_name, excluded.display_name),
    phone        = coalesce(p.phone, excluded.phone),
    country      = coalesce(p.country, excluded.country);

  return true;
end;
$$;

revoke all on function public.claim_roster_profile(text) from public, anon;
grant execute on function public.claim_roster_profile(text) to authenticated;
