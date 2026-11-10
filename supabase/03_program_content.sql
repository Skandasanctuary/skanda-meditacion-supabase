-- =====================================================================
--  PARTE 3 de 3: contenido del reto (fecha de inicio, días, audios y reflexiones)
--  Después podrás editar todo esto desde Supabase > Table Editor, sin código.
--  Resultado esperado: "Success. No rows returned"
-- =====================================================================

insert into public.programs (id, title, start_date, unlock_hour, utc_offset_hours, unlock_all)
values ('11', 'Reto de Meditación de 11 Días', '2026-11-11', 6, -5, false)
on conflict (id) do nothing;

insert into public.program_days (program_id, day, title, description, audio_url, reflection)
values
  ('11', 1, 'Llegar', 'Comienza tu camino en la meditación y regálate un momento de calma para conectar contigo.', 'dia-01.mp3', 'Llegar es suficiente. No hay nada que lograr hoy, solo estar aquí.'),
  ('11', 2, 'Preparar', 'Prepara tu espacio, encuentra una postura cómoda y crea las condiciones para meditar.', 'dia-02.mp3', 'Un espacio sencillo y una postura amable son el comienzo de toda práctica.'),
  ('11', 3, 'El Camino', 'Descubre cómo el yoga, el cuerpo y la respiración nos preparan para la meditación.', 'dia-03.mp3', 'El cuerpo y la respiración son la puerta; la quietud ya espera al otro lado.'),
  ('11', 4, 'El Cuerpo', 'Explora cómo la postura, la mirada y los gestos pueden cultivar estabilidad y presencia.', 'dia-04.mp3', 'Cuando el cuerpo se asienta, la mente encuentra dónde descansar.'),
  ('11', 5, 'Profundizar', 'Reflexiona sobre tu práctica y avanza hacia una meditación de 30 minutos, con paciencia y constancia.', 'dia-05.mp3', 'La constancia pequeña, repetida con paciencia, hace más que cualquier esfuerzo grande.'),
  ('11', 6, 'Armonía', 'Explora la meditación con mantra y el concepto de sattva, cultivando claridad y equilibrio.', 'dia-06.mp3', 'Un mantra es un hilo: lo sueltas y lo retomas, una y otra vez, sin reproche.'),
  ('11', 7, 'Integrar', 'Descubre la relación entre emoción, mente, cuerpo y respiración como preparación para meditar.', 'dia-07.mp3', 'Lo que sientes, lo que piensas y cómo respiras forman una sola conversación.'),
  ('11', 8, 'Patrones', 'Comprende cómo las impresiones mentales y los hábitos influyen en tu experiencia interior.', 'dia-08.mp3', 'Ver un hábito con claridad es el primer paso para dejar de obedecerlo.'),
  ('11', 9, 'Soltar', 'Practica Yoga Nidra para liberar tensiones y descansar profundamente, manteniendo la atención presente.', 'dia-09.mp3', 'Soltar no es perder; es abrir la mano para poder descansar.'),
  ('11', 10, 'Lo Esencial', 'Reflexiona sobre la naturaleza cambiante de la vida y descubre la importancia de cultivar una relación con tu ser interior.', 'dia-10.mp3', 'Todo cambia. Lo que permanece es la mirada que lo observa.'),
  ('11', 11, 'Ser', 'Explora el mantra So Ham y descubre cómo la meditación puede profundizar tu relación con tu naturaleza interior.', 'dia-11.mp3', 'No terminas el camino; lo llevas contigo. Hoy eres quien se sienta.')
on conflict (program_id, day) do update set
  title       = excluded.title,
  description = excluded.description,
  audio_url   = excluded.audio_url,
  reflection  = excluded.reflection;
