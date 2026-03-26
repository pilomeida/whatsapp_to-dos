import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { getSetting, setSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json();
  if (!token || !newPassword) {
    return NextResponse.json({ error: "Token and new password required" }, { status: 400 });
  }

  const storedToken = await getSetting("reset_token");
  const expiryStr = await getSetting("reset_token_expiry");

  if (!storedToken || storedToken !== token) {
    return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 401 });
  }

  if (!expiryStr || Date.now() > parseInt(expiryStr)) {
    return NextResponse.json({ error: "Reset token has expired" }, { status: 401 });
  }

  await setSetting("password_hash", hashPassword(newPassword));
  await setSetting("reset_token", "");
  await setSetting("reset_token_expiry", "0");

  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", process.env.APP_SECRET!, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
