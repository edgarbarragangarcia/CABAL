import "server-only";

/** Bot de Telegram para el informe: TELEGRAM_BOT_TOKEN (de @BotFather) y TELEGRAM_CHAT_ID. */
export function configTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

/** Telegram admite 4.096 caracteres por mensaje: se corta por párrafos, sin partir una etiqueta. */
export function partirMensaje(html: string, max = 3800): string[] {
  const partes: string[] = [];
  let actual = "";
  for (const bloque of html.split("\n\n")) {
    if (actual && actual.length + bloque.length + 2 > max) {
      partes.push(actual);
      actual = "";
    }
    actual = actual ? `${actual}\n\n${bloque}` : bloque;
    // Un bloque enorme se corta por líneas.
    while (actual.length > max) {
      const corte = actual.lastIndexOf("\n", max);
      partes.push(actual.slice(0, corte > 0 ? corte : max));
      actual = actual.slice(corte > 0 ? corte + 1 : max);
    }
  }
  if (actual) partes.push(actual);
  return partes;
}

export async function enviarTelegram(html: string) {
  const c = configTelegram();
  if (!c) throw new Error("Falta configurar TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en Vercel.");
  for (const texto of partirMensaje(html)) {
    const res = await fetch(`https://api.telegram.org/bot${c.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: c.chatId, text: texto, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(20_000),
    });
    const cuerpo = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!res.ok || !cuerpo?.ok) throw new Error(`Telegram respondió: ${cuerpo?.description ?? res.status}`);
  }
}
