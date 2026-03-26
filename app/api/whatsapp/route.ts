import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { parseMessage } from "@/lib/claude";
import {
  addTodo,
  listToday,
  listWeek,
  markDone,
  updatePriority,
  updateDeadline,
  deleteTodo,
  type Todo,
} from "@/lib/todos";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const MY_WHATSAPP_NUMBER = process.env.MY_WHATSAPP_NUMBER!;

const priorityEmoji: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "";
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Lisbon",
  });
  if (deadline === today) return " · due today";
  const d = new Date(deadline + "T00:00:00");
  return ` · due ${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;
}

function formatList(title: string, todos: Todo[]): string {
  if (todos.length === 0) return `📋 *${title}*\n\nNo open to-dos.`;
  const lines = todos
    .map(
      (t, i) =>
        `${i + 1}. ${t.title} ${priorityEmoji[t.priority]} ${t.priority}${formatDeadline(t.deadline)}`
    )
    .join("\n");
  return `📋 *${title}*\n\n${lines}\n\nReply "done [number or name]" to mark complete.`;
}

function twimlReply(body: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body}</Message></Response>`;
  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Validate Twilio signature
  // Reconstruct the exact public URL Twilio signed — req.url can differ in Vercel's runtime
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const url = `${proto}://${host}/api/whatsapp`;
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));

  const valid = twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params);
  if (!valid) {
    console.error("Twilio validation failed. url=%s sig=%s", url, signature);
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Validate sender
  const from = params["From"] ?? "";
  if (from !== MY_WHATSAPP_NUMBER) {
    return twimlReply("Unauthorized.");
  }

  const message = (params["Body"] ?? "").trim();
  if (!message) return twimlReply("No message received.");

  // Set a 4.5s timeout to stay under Twilio's 5s limit
  const timeoutMs = 4500;
  let timedOut = false;
  const timeoutPromise = new Promise<NextResponse>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve(twimlReply("Sorry, that took too long. Please try again."));
    }, timeoutMs);
  });

  const workPromise = (async (): Promise<NextResponse> => {
    let parsed;
    try {
      parsed = await parseMessage(message);
    } catch {
      return twimlReply("Sorry, I couldn't understand that. Please try again.");
    }

    if (timedOut) return twimlReply("Done.");

    const { intent, todo } = parsed;

    try {
      switch (intent) {
        case "add": {
          if (!todo.title) return twimlReply("I didn't catch the to-do title.");
          const added = await addTodo({
            title: todo.title,
            notes: todo.notes,
            priority: todo.priority,
            deadline: todo.deadline,
          });
          const deadlinePart = added.deadline ? ` · due ${added.deadline}` : "";
          return twimlReply(
            `✅ Added: *${added.title}* ${priorityEmoji[added.priority]} ${added.priority}${deadlinePart}`
          );
        }

        case "list_today": {
          const todos = await listToday();
          return twimlReply(formatList("Today's to-dos", todos));
        }

        case "list_week": {
          const todos = await listWeek();
          return twimlReply(formatList("This week", todos));
        }

        case "done": {
          // Support "done 2" (number) or "done task name"
          const term = todo.search_term ?? "";
          const numMatch = term.match(/^\d+$/);
          let result;
          if (numMatch) {
            const todos = await listToday();
            const idx = parseInt(term) - 1;
            const target = todos[idx];
            if (!target) return twimlReply(`No item #${term} in today's list.`);
            result = await markDone(target.title);
          } else {
            result = await markDone(term);
          }
          if (!result) return twimlReply(`Couldn't find a to-do matching "${term}".`);
          return twimlReply(`✔️ Done: *${result.title}*`);
        }

        case "prioritize": {
          if (!todo.search_term || !todo.priority)
            return twimlReply("I need both a task name and a priority level.");
          const result = await updatePriority(todo.search_term, todo.priority);
          if (!result) return twimlReply(`Couldn't find a to-do matching "${todo.search_term}".`);
          return twimlReply(
            `🔺 *${result.title}* is now ${result.priority} priority`
          );
        }

        case "set_deadline": {
          if (!todo.search_term || !todo.deadline)
            return twimlReply("I need both a task name and a deadline.");
          const result = await updateDeadline(todo.search_term, todo.deadline);
          if (!result) return twimlReply(`Couldn't find a to-do matching "${todo.search_term}".`);
          const d = new Date(result.deadline! + "T00:00:00");
          const formatted = d.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          return twimlReply(`📅 *${result.title}* due ${formatted}`);
        }

        case "delete": {
          if (!todo.search_term)
            return twimlReply("I need a task name to delete.");
          const result = await deleteTodo(todo.search_term);
          if (!result) return twimlReply(`Couldn't find a to-do matching "${todo.search_term}".`);
          return twimlReply(`🗑️ Deleted: *${result.title}*`);
        }

        case "unknown":
        default:
          return twimlReply(
            "Sorry, I didn't get that. Try: \"add call João Friday high priority\""
          );
      }
    } catch {
      return twimlReply("Something went wrong. Please try again.");
    }
  })();

  return Promise.race([workPromise, timeoutPromise]);
}
