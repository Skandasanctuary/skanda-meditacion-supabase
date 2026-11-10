// Vista previa local SIN Supabase: servidor sencillo + Supabase falso (todo en el navegador).
// Uso:  npm run preview  →  http://localhost:8888      (?now=2026-11-14T12:00:00Z simula una fecha; ?confirm=1 exige confirmar correo)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8888);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".mp3": "audio/mpeg" };

function send(res, file, transform) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end("No encontrado"); }
  let data = fs.readFileSync(file);
  if (transform) data = transform(data.toString("utf8"));
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  res.end(data);
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  if (p === "/" || p === "/index.html") {
    return send(res, path.join(root, "public/index.html"), (html) =>
      html.replace('<script type="module" src="/app.js">',
        '<script type="importmap">{"imports":{"@supabase/supabase-js":"/dev/fake-supabase.js"}}</script>\n<script type="module" src="/app.js">'));
  }
  if (p === "/config.js") {
    if (process.env.REAL_CONFIG === "1") return send(res, path.join(root, "src/config.js"));   // para probar el aviso de "falta configurar"
    res.writeHead(200, { "content-type": TYPES[".js"] });
    return res.end(`export const SUPABASE_URL = "http://${req.headers.host}"; export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake"; export const PROGRAM_ID = "11"; export const AUDIO_BUCKET = "audio";`);
  }
  if (p === "/app.js" || p === "/profile.js") return send(res, path.join(root, "src", p));
  if (p.startsWith("/dev/")) return send(res, path.join(root, p));
  if (p.startsWith("/storage/v1/object/public/audio/")) return send(res, path.join(root, "test-audio", decodeURIComponent(p.split("/").pop())));
  return send(res, path.join(root, "public", path.normalize(p).replace(/^(\.\.[/\\])+/, "")));
}).listen(PORT, () => console.log(`Vista previa: http://localhost:${PORT}  (Supabase FALSO, solo para probar)`));
