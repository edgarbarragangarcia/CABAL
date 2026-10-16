import { NextResponse } from "next/server";

/** El identificador público (client ID) de la app de Google con la que el panel se conecta a Drive. No es un secreto: va en el navegador. */
export async function GET() {
  return NextResponse.json({ clientId: process.env.GOOGLE_CLIENT_ID?.trim() || null }, { headers: { "Cache-Control": "private, no-store" } });
}
