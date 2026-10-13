// Revisa el directorio de portales regionales (src/lib/monitoreo/medios-regionales.ts): ¿el sitio responde?, ¿Google Noticias lo
// indexa?, ¿indexa su página de Facebook? Uso: node scripts/verificar-medios.mjs
// Los portales cambian de dominio o cierran: conviene correrlo de vez en cuando y quitar o corregir lo que salga marcado.
import { readFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const fuente = readFileSync(new URL("../src/lib/monitoreo/medios-regionales.ts", import.meta.url), "utf8");
const filas = [...fuente.matchAll(/\{ id: "([^"]+)", nombre: "([^"]+)", dominio: "([^"]+)".*?ciudad: "([^"]+)".*?web: (true|false), fb: (null|"[^"]+"), fbIndexado: (true|false)/g)].map((m) => ({
  id: m[1], nombre: m[2], dominio: m[3], ciudad: m[4], web: m[5] === "true", fb: m[6] === "null" ? null : m[6].slice(1, -1), fbIndexado: m[7] === "true",
}));

async function sitio(dominio) {
  for (const host of [dominio, `www.${dominio}`]) {
    try {
      const r = await fetch(`https://${host}`, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12_000) });
      if (r.status < 400 || r.status === 403) return r.status; // 403: protege el sitio contra robots, pero existe
    } catch {
      /* se prueba la otra forma */
    }
  }
  return 0;
}
async function noticias(q) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://news.google.com/rss/search?${new URLSearchParams({ q, hl: "es-419", gl: "CO", ceid: "CO:es-419" })}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15_000) });
      if (r.ok) return ((await r.text()).match(/<item>/g) ?? []).length;
    } catch {
      /* reintento */
    }
    await new Promise((ok) => setTimeout(ok, 2_000 * (i + 1)));
  }
  return -1;
}

let i = 0;
const problemas = [];
await Promise.all(
  Array.from({ length: 5 }, async () => {
    while (i < filas.length) {
      const f = filas[i++];
      const [http, web, fb] = await Promise.all([sitio(f.dominio), f.web ? noticias(`site:${f.dominio} when:30d`) : 1, f.fb && f.fbIndexado ? noticias(`site:facebook.com/${f.fb} when:30d`) : 1]);
      const mal = [http === 0 && "el sitio no responde", f.web && web === 0 && "Google Noticias no trae nada del sitio en 30 días", f.fb && f.fbIndexado && fb === 0 && "Google Noticias no trae nada de su página de Facebook", web < 0 && "Google Noticias no respondió"].filter(Boolean);
      if (mal.length) problemas.push(`${f.nombre} (${f.ciudad}, ${f.dominio}): ${mal.join("; ")}`);
    }
  })
);
console.log(`${filas.length} portales revisados.`);
console.log(problemas.length ? `Para revisar:\n- ${problemas.sort().join("\n- ")}` : "Todo en orden.");
