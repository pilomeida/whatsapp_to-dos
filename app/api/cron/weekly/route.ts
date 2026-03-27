import { NextRequest, NextResponse } from "next/server";
import { listOpen, type Todo } from "@/lib/todos";
import { sendWhatsApp } from "@/lib/notify";

const priorityEmoji: Record<string, string> = {
  urgent: "🔴",
  high: "🟡",
  medium: "🔵",
  low: "🟢",
};

function formatDateHeader(dateStr: string): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
  const tomorrow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow.toLocaleDateString("en-CA")) return "Tomorrow";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const todos = await listOpen();
  if (todos.length === 0) {
    await sendWhatsApp("📅 *Weekly review* — no open to-dos. Clean slate! 🎉");
    return new NextResponse("Sent", { status: 200 });
  }

  const groups = new Map<string, Todo[]>();
  for (const t of todos) {
    const key = t.deadline ?? "__none__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === "__none__") return 1;
    if (b === "__none__") return -1;
    return a.localeCompare(b);
  });

  let counter = 1;
  const parts: string[] = ["📅 *Weekly review — all your open to-dos:*"];
  for (const key of sortedKeys) {
    parts.push(`\n*${key === "__none__" ? "No date" : formatDateHeader(key)}*`);
    for (const t of groups.get(key)!) {
      const cat = t.category ? ` [${t.category}]` : "";
      parts.push(`${counter++}. ${t.title}${cat} ${priorityEmoji[t.priority]}`);
    }
  }

  await sendWhatsApp(parts.join("\n"));
  return new NextResponse("Sent", { status: 200 });
}
