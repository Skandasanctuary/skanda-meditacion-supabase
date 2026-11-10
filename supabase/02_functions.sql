-- =====================================================================
--  PARTE 2 de 3: las reglas del reto (calendario, días abiertos, completar)
--  Se ejecutan dentro de la base de datos, así que nadie puede saltárselas
--  editando la página.
--  Resultado esperado: "Success. No rows returned"
-- =====================================================================

-- Momento exacto en que se abre el día 1 (fecha de inicio a la hora de apertura, en hora de Bogotá).
create or replace function public.program_first_unlock(p_program text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select ((p.start_date::timestamp + make_interval(hours => p.unlock_hour - p.utc_offset_hours)) at time zone 'UTC')
  from public.programs p
  where p.id = p_program
$$;

-- Último día abierto ahora mismo (0 = el reto aún no empieza).
create or replace function public.program_today(p_program text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  prog public.programs;
  first_unlock timestamptz;
  total integer;
  n integer;
begin
  select * into prog from public.programs where id = p_program;
  if not found then
    return 0;
  end if;
  select count(*)::integer into total from public.program_days where program_id = p_program;
  if prog.unlock_all then
    return total;
  end if;
  first_unlock := public.program_first_unlock(p_program);
  if now() < first_unlock then
    return 0;
  end if;
  n := floor(extract(epoch from (now() - first_unlock)) / 86400)::integer + 1;
  return least(n, total);
end;
$$;

-- Lo que ve la persona: cada día con su estado. El audio solo se entrega si el día ya está abierto
-- y la reflexión solo si el día ya está completado.
create or replace function public.get_state(p_program text default '11')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  prog public.programs;
  today integer;
  first_unlock timestamptz;
  result jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into prog from public.programs where id = p_program;
  if not found then
    raise exception 'unknown program' using errcode = 'P0002';
  end if;

  today := public.program_today(p_program);
  first_unlock := public.program_first_unlock(p_program);

  select jsonb_build_object(
    'program', jsonb_build_object(
      'id', prog.id,
      'title', prog.title,
      'startDate', prog.start_date,
      'totalDays', count(*),
      'testMode', prog.unlock_all
    ),
    'today', today,
    'days', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'day', d.day,
          'title', d.title,
          'description', d.description,
          'status', case
                      when c.day is not null then 'completed'
                      when d.day <= today then 'available'
                      else 'locked'
                    end,
          'unlocksAt', first_unlock + make_interval(days => d.day - 1),
          'audioUrl', case when d.day <= today then d.audio_url else null end,
          'reflection', case when c.day is not null then d.reflection else null end
        )
        order by d.day
      ),
      '[]'::jsonb
    )
  )
  into result
  from public.program_days d
  left join public.completions c
    on c.program_id = d.program_id and c.day = d.day and c.user_id = uid
  where d.program_id = p_program;

  return result;
end;
$$;

-- Marca un día como completado (una sola vez) y devuelve el estado actualizado.
create or replace function public.complete_day(p_program text, p_day integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_day is null or p_day < 1 or p_day > public.program_today(p_program) then
    raise exception 'day is locked or invalid' using errcode = 'P0001';
  end if;

  insert into public.completions (user_id, program_id, day)
  values (uid, p_program, p_day)
  on conflict do nothing;

  return public.get_state(p_program);
end;
$$;

-- Permisos: solo personas con sesión iniciada pueden usar get_state y complete_day.
revoke all on function public.program_first_unlock(text) from public, anon, authenticated;
revoke all on function public.program_today(text)        from public, anon, authenticated;
revoke all on function public.get_state(text)            from public, anon;
revoke all on function public.complete_day(text, integer) from public, anon;
grant execute on function public.get_state(text)             to authenticated;
grant execute on function public.complete_day(text, integer) to authenticated;
