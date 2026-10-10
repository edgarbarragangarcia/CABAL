import { NextResponse } from "next/server";

import { MIEMBRO_COOKIE } from "@/lib/comunidad/sesion";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(MIEMBRO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
