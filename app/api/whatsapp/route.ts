import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { parseMessage } from "@/lib/claude";
import {
  addTodo,
  listToday,
  listWeek,
  listMonth,
  listYear,
  markDone,
  markDoneById,
  updatePriority,
  updatePriorityById,
  updateDeadline,
  updateDeadlineById,
  deleteTodo,
  deleteTodoById,
  getTodoById,
  updateTodo,
  type Todo,
} from "@/lib/todos";
import { generateToken } from "@/lib/password";
import { getSetting, setSetting } from "@/lib/settings";

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const MY_WHATSAPP_NUMBER = process.env.MY_WHATSAPP_NUMBER!;

const priorityEmoji: Record<string, string> = {
  urgent: "🔴",
  high: "🟡",
  medium: "🔵",
  low: "🟢",
};

function twimlReply(body: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body}</Message></Response>`;
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

function lisbonToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
}

function formatDateHeader(dateStr: string): string {
  const today = lisbonToday();
  const tomorrow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow.toLocaleDateString("en-CA")) return "Tomorrow";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short",
  });
}

function todoLine(t: Todo, i: number): string {
  const cat = t.category ? ` [${t.category}]` : "";
  return `${i}. ${t.title}${cat} ${priorityEmoji[t.priority]}`;
}

function formatFlatList(title: string, todos: Todo[]): string {
  if (todos.length === 0) return `📋 *${title}*\n\nNo open to-dos.`;
  const lines = todos.map((t, i) => todoLine(t, i + 1)).join("\n");
  return `📋 *${title}*\n\n${lines}\n\nReply "done [number or name]" to mark complete.`;
}

function formatGroupedList(title: string, todos: Todo[]): string {
  if (todos.length === 0) return `📋 *${title}*\n\nNo open to-dos.`;

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
  const parts: string[] = [`📋 *${title}*`];
  for (const key of sortedKeys) {
    parts.push(`\n*${key === "__none__" ? "No date" : formatDateHeader(key)}*`);
    for (const t of groups.get(key)!) {
      parts.push(todoLine(t, counter++));
    }
  }
  parts.push('\nReply "done [number or name]" to mark complete.');
  return parts.join("\n");
}

async function saveLastList(todos: Todo[]): Promise<void> {
  await setSetting("last_list", JSON.stringify(todos.map((t) => t.id)));
}

// Resolve a search_term to a Todo — supports number (last list) or text search
async function resolveByTerm(
  term: string,
  finder: (t: string) => Promise<Todo | null>
): Promise<Todo | null> {
  if (/^\d+$/.test(term)) {
    const lastListJson = await getSetting("last_list");
    const ids: string[] = lastListJson ? JSON.parse(lastListJson) : [];
    const id = ids[parseInt(term) - 1];
    if (!id) return null;
    return getTodoById(id);
  }
  // Strip [category] suffixes the user may have copied from the display
  const cleaned = term.replace(/\s*\[.*?\]\s*/g, "").trim();
  return finder(cleaned);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = process.env.WEBHOOK_URL!;
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));

  const valid = twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params);
  if (!valid) {
    console.error("Twilio validation failed. url=%s token_len=%d", url, TWILIO_AUTH_TOKEN?.length ?? 0);
    return new NextResponse("Forbidden", { status: 403 });
  }

  const from = params["From"] ?? "";
  if (from !== MY_WHATSAPP_NUMBER) return twimlReply("Unauthorized.");

  const message = (params["Body"] ?? "").trim();
  if (!message) return twimlReply("No message received.");

  if (/^reset password$/i.test(message)) {
    const token = generateToken();
    const expiry = Date.now() + 15 * 60 * 1000;
    await setSetting("reset_token", token);
    await setSetting("reset_token_expiry", String(expiry));
    const resetUrl = `${url.replace("/api/whatsapp", "")}/reset?token=${token}`;
    return twimlReply(`🔑 Reset link (valid 15 min):\n${resetUrl}`);
  }

  const timeoutMs = 4500;
  let timedOut = false;
  const timeoutPromise = new Promise<NextResponse>((resolve) => {
    setTimeout(() => { timedOut = true; resolve(twimlReply("Sorry, that took too long. Please try again.")); }, timeoutMs);
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
            category: todo.category,
          });
          const deadlinePart = added.deadline
            ? ` · due ${new Date(added.deadline + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`
            : "";
          const catPart = added.category ? ` [${added.category}]` : "";
          return twimlReply(
            `✅ Added: *${added.title}*${catPart} ${priorityEmoji[added.priority]} ${added.priority}${deadlinePart}`
          );
        }

        case "list_today": {
          const todos = await listToday();
          await saveLastList(todos);
          return twimlReply(formatFlatList("Today's to-dos", todos));
        }

        case "list_week": {
          const todos = await listWeek();
          await saveLastList(todos);
          return twimlReply(formatGroupedList("This week", todos));
        }

        case "list_month": {
          const todos = await listMonth();
          await saveLastList(todos);
          return twimlReply(formatGroupedList("This month", todos));
        }

        case "list_year": {
          const todos = await listYear();
          await saveLastList(todos);
          return twimlReply(formatGroupedList("This year", todos));
        }

        case "done": {
          const term = todo.search_term ?? "";
          let result: Todo | null;
          if (/^\d+$/.test(term)) {
            const lastListJson = await getSetting("last_list");
            const ids: string[] = lastListJson ? JSON.parse(lastListJson) : [];
            const id = ids[parseInt(term) - 1];
            if (!id) return twimlReply(`No item #${term} in the last list.`);
            result = await markDoneById(id);
          } else {
            result = await markDone(term.replace(/\s*\[.*?\]\s*/g, "").trim());
          }
          if (!result) return twimlReply(`Couldn't find a to-do matching "${term}".`);
          return twimlReply(`✔️ Done: *${result.title}*`);
        }

        case "update": {
          if (!todo.search_term) return twimlReply("I need a task reference to update.");
          const target = await resolveByTerm(todo.search_term, async (t) => {
            // find by title match
            const { supabaseAdmin } = await import("@/lib/supabase");
            const { data } = await supabaseAdmin.from("todos").select("*").eq("done", false).ilike("title", `%${t}%`).limit(1);
            return data?.[0] ?? null;
          });
          if (!target) return twimlReply(`Couldn't find a to-do matching "${todo.search_term}".`);

          const updates: Record<string, unknown> = {};
          if (todo.priority) updates.priority = todo.priority;
          if (todo.category !== undefined) updates.category = todo.category;
          if (todo.deadline) updates.deadline = todo.deadline;

          const result = await updateTodo(target.id, updates as Parameters<typeof updateTodo>[1]);
          if (!result) return twimlReply("Failed to update to-do.");

          const parts: string[] = [];
          if (todo.priority) parts.push(`priority → ${result.priority} ${priorityEmoji[result.priority]}`);
          if (todo.category !== undefined && todo.category !== null) parts.push(`category → ${result.category}`);
          if (todo.deadline) parts.push(`due → ${new Date(result.deadline! + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`);

          return twimlReply(`✏️ *${result.title}*: ${parts.join(", ")}`);
        }

        case "prioritize": {
          if (!todo.search_term || !todo.priority)
            return twimlReply("I need both a task reference and a priority level.");
          let result: Todo | null;
          if (/^\d+$/.test(todo.search_term)) {
            const lastListJson = await getSetting("last_list");
            const ids: string[] = lastListJson ? JSON.parse(lastListJson) : [];
            const id = ids[parseInt(todo.search_term) - 1];
            if (!id) return twimlReply(`No item #${todo.search_term} in the last list.`);
            result = await updatePriorityById(id, todo.priority);
          } else {
            result = await updatePriority(todo.search_term.replace(/\s*\[.*?\]\s*/g, "").trim(), todo.priority);
          }
          if (!result) return twimlReply(`Couldn't find a to-do matching "${todo.search_term}".`);
          return twimlReply(`${priorityEmoji[result.priority]} *${result.title}* is now ${result.priority} priority`);
        }

        case "set_deadline": {
          if (!todo.search_term || !todo.deadline)
            return twimlReply("I need both a task reference and a deadline.");
          let result: Todo | null;
          if (/^\d+$/.test(todo.search_term)) {
            const lastListJson = await getSetting("last_list");
            const ids: string[] = lastListJson ? JSON.parse(lastListJson) : [];
            const id = ids[parseInt(todo.search_term) - 1];
            if (!id) return twimlReply(`No item #${todo.search_term} in the last list.`);
            result = await updateDeadlineById(id, todo.deadline);
          } else {
            result = await updateDeadline(todo.search_term.replace(/\s*\[.*?\]\s*/g, "").trim(), todo.deadline);
          }
          if (!result) return twimlReply(`Couldn't find a to-do matching "${todo.search_term}".`);
          const formatted = new Date(result.deadline! + "T00:00:00").toLocaleDateString("en-GB", {
            weekday: "short", day: "numeric", month: "short",
          });
          return twimlReply(`📅 *${result.title}* due ${formatted}`);
        }

        case "delete": {
          if (!todo.search_term) return twimlReply("I need a task reference to delete.");
          let result: Todo | null;
          if (/^\d+$/.test(todo.search_term)) {
            const lastListJson = await getSetting("last_list");
            const ids: string[] = lastListJson ? JSON.parse(lastListJson) : [];
            const id = ids[parseInt(todo.search_term) - 1];
            if (!id) return twimlReply(`No item #${todo.search_term} in the last list.`);
            result = await deleteTodoById(id);
          } else {
            result = await deleteTodo(todo.search_term.replace(/\s*\[.*?\]\s*/g, "").trim());
          }
          if (!result) return twimlReply(`Couldn't find a to-do matching "${todo.search_term}".`);
          return twimlReply(`🗑️ Deleted: *${result.title}*`);
        }

        case "unknown":
        default:
          return twimlReply('Sorry, I didn\'t get that. Try: "add Home: fix roof Friday urgent" or "done 2" or "delete 3"');
      }
    } catch {
      return twimlReply("Something went wrong. Please try again.");
    }
  })();

  return Promise.race([workPromise, timeoutPromise]);
}
