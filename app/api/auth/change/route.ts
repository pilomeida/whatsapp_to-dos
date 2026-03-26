import { NextRequest, NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSetting, setSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
  // Must be authenticated
  const auth = req.cookies.get("auth")?.value;
  if (auth !== process.env.APP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  }

  const storedHash = await getSetting("password_hash");
  const valid = storedHash
    ? verifyPassword(currentPassword, storedHash)
    : currentPassword === process.env.APP_PASSWORD;

  if (!valid) {
    return NextResponse.json({ error: "Current password is wrong" }, { status: 401 });
  }

  await setSetting("password_hash", hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
