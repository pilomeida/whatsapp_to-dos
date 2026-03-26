import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Priority = "urgent" | "high" | "medium" | "low";

export type Intent =
  | "add"
  | "list_today"
  | "list_tomorrow"
  | "list_week"
  | "list_month"
  | "list_year"
  | "done"
  | "update"
  | "prioritize"
  | "set_deadline"
  | "delete"
  | "unknown";

export interface ParsedIntent {
  intent: Intent;
  todo: {
    title: string | null;
    notes: string | null;
    priority: Priority | null;
    deadline: string | null; // YYYY-MM-DD
    search_term: string | null;
    category: string | null;
  };
}

export async function parseMessage(message: string): Promise<ParsedIntent> {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Lisbon",
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: `You are a to-do assistant. Parse the user's message and return ONLY valid JSON with this shape:
{
  "intent": "add" | "list_today" | "list_tomorrow" | "list_week" | "list_month" | "list_year" | "done" | "update" | "prioritize" | "set_deadline" | "delete" | "unknown",
  "todo": {
    "title": string | null,
    "notes": string | null,
    "priority": "urgent" | "high" | "medium" | "low" | null,
    "deadline": "YYYY-MM-DD" | null,
    "search_term": string | null,
    "category": string | null
  }
}

Intent rules:
- "add": create a new to-do. Category can be extracted from patterns like "Home: fix roof" or "fix roof under Home" → category "Home", title "Fix roof".
- "update": update one or more fields (priority, category, deadline) on an existing to-do. Use this when the user wants to change category AND/OR priority AND/OR deadline together. Put the task reference (name or number) in search_term.
- "prioritize": change priority only. Use search_term for the task reference.
- "set_deadline": change deadline only. Use search_term for the task reference.
- "done" / "delete": mark done or delete. "cancel" is a synonym for delete. Use search_term for the task reference.
- search_term can be a number (e.g. "3") if the user references a task by its list position.
- "list_today", "list_tomorrow", "list_week", "list_month", "list_year": list open to-dos for that time window. Use "list_tomorrow" only when the user explicitly asks about tomorrow.

Priority levels: urgent (most critical), high, medium (default), low.
Category is a free-text project/area label. Never hardcode values — extract whatever the user says.
Today's date is ${today}. Timezone is Europe/Lisbon.
Never return anything other than the JSON object.`,
    messages: [{ role: "user", content: message }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as ParsedIntent;
}
