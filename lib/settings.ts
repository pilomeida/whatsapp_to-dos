import { supabaseAdmin } from "./supabase";

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("settings")
    .select("value")
    .eq("key", key)
    .single();
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await supabaseAdmin.from("settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });
}
