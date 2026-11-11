// Validación de los datos de perfil: nombre, WhatsApp y país.
const text = (v, min, max) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s.length >= min && s.length <= max ? s : null;
};

export function cleanProfile(input) {
  const errors = {};
  const name = text(input?.name, 2, 80);
  if (!name) errors.name = "Escribe tu nombre.";

  const phoneRaw = typeof input?.phone === "string" ? input.phone.trim() : "";
  const digits = phoneRaw.replace(/\D/g, "");
  const phone = /^\+?[0-9 ()\-]{7,25}$/.test(phoneRaw) && digits.length >= 7 && digits.length <= 15 ? phoneRaw : null;
  if (!phone) errors.phone = "Escribe un número válido con código de país, por ejemplo +57 300 000 0000.";

  const country = text(input?.country, 2, 80);
  if (!country) errors.country = "Escribe tu país.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, phone, country } };
}

/**
 * La contraseña se construye con los ÚLTIMOS 8 DÍGITOS del número de WhatsApp (sin espacios, + ni guiones).
 * Así funciona escribas el número con o sin código de país, y cumple el mínimo de 6 caracteres de Supabase.
 * Devuelve null si el número tiene menos de 8 dígitos.
 */
export function passwordFromPhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : null;
}

/**
 * Contraseñas que se prueban al entrar, en este orden:
 *  1) si lo escrito parece un número de teléfono, los últimos 8 dígitos (la contraseña inicial);
 *  2) lo escrito tal cual (una contraseña que la persona eligió al cambiarla).
 * Así funciona tanto con la contraseña inicial como con una contraseña propia.
 */
export function passwordCandidates(input) {
  const raw = String(input ?? "");
  const out = [];
  if (/^[+()\d\s.-]+$/.test(raw.trim())) {
    const derived = passwordFromPhone(raw);
    if (derived) out.push(derived);
  }
  if (raw.length >= 6) out.push(raw);
  return [...new Set(out)];
}

/** Reglas de la contraseña nueva. Devuelve un mensaje de error o null si está bien. */
export function checkNewPassword(a, b) {
  if (typeof a !== "string" || a.length < 8) return "Usa al menos 8 caracteres.";
  if (a.length > 72) return "Usa 72 caracteres como máximo.";
  if (!a.trim()) return "La contraseña no puede estar en blanco.";
  if (a !== b) return "Las dos contraseñas no coinciden.";
  return null;
}
