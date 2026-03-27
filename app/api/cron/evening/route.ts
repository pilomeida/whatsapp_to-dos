import { NextRequest, NextResponse } from "next/server";
import { listOverdue } from "@/lib/todos";
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

  const todos = await listOverdue();
  if (todos.length === 0) {
    await sendWhatsApp("🌙 *All done today* — no pending to-dos to reschedule.");
    return new NextResponse("Sent", { status: 200 });
  }

  const lines = todos
    .map((t, i) => {
      const cat = t.category ? ` [${t.category}]` : "";
      const due = t.deadline
        ? ` · was due ${new Date(t.deadline + "T00:00:00").toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}`
        : "";
      return `${i + 1}. ${t.title}${cat} ${priorityEmoji[t.priority]}${due}`;
    })
    .join("\n");

  await sendWhatsApp(
    `🌙 *Day's over — these are past due. Time to reschedule?*\n\n${lines}`
  );
  return new NextResponse("Sent", { status: 200 });
}
