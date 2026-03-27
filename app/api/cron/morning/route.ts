import { NextRequest, NextResponse } from "next/server";
import { listToday } from "@/lib/todos";
import { sendWhatsApp } from "@/lib/notify";

const priorityEmoji: Record<string, string> = {
  urgent: "🔴",
  high: "🟡",
  medium: "🔵",
  low: "🟢",
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const todos = await listToday();
  if (todos.length === 0) {
    await sendWhatsApp("☀️ *Good morning!* No to-dos for today.");
    return new NextResponse("Sent", { status: 200 });
  }

  const lines = todos
    .map((t, i) => {
      const cat = t.category ? ` [${t.category}]` : "";
      return `${i + 1}. ${t.title}${cat} ${priorityEmoji[t.priority]}`;
    })
    .join("\n");

  await sendWhatsApp(`☀️ *Good morning! Your to-dos for today:*\n\n${lines}`);
  return new NextResponse("Sent", { status: 200 });
}
