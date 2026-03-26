import crypto from "crypto";

// Use Supabase URL as salt — stable, unique to this deployment, never changes
function getSalt(): string {
  return process.env.SUPABASE_URL ?? "whatsapp-todo-app";
}

export function hashPassword(password: string): string {
  return crypto.scryptSync(password, getSalt(), 64).toString("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    const hashed = crypto.scryptSync(password, getSalt(), 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hashed, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
