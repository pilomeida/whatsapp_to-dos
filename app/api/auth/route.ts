import { NextRequest, NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSetting, setSetting } from "@/lib/settings";

function setAuthCookie(res: NextResponse) {
  res.cookies.set("auth", process.env.APP_SECRET!, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: "Password required" }, { status: 400 });

  const storedHash = await getSetting("password_hash");

  if (storedHash) {
    // Normal login — verify against stored hash
    if (!verifyPassword(password, storedHash)) {
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }
  } else {
    // First login — seed from APP_PASSWORD env var
    if (password !== process.env.APP_PASSWORD) {
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }
    await setSetting("password_hash", hashPassword(password));
  }

  const res = NextResponse.json({ ok: true });
  setAuthCookie(res);
  return res;
}
