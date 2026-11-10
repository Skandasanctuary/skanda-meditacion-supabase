// Validación de los datos de perfil: nombre, WhatsApp, ciudad y país.
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

  const city = text(input?.city, 2, 80);
  if (!city) errors.city = "Escribe tu ciudad.";
  const country = text(input?.country, 2, 80);
  if (!country) errors.country = "Escribe tu país.";

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: { name, phone, city, country } };
}
