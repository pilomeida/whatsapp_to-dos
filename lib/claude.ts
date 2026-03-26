import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Priority = "urgent" | "high" | "medium" | "low";

export type Intent =
  | "add"
  | "list_today"
  | "list_week"
  | "list_month"
  | "list_year"
  | "done"
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
    max_tokens: 256,
    system: `You are a to-do assistant. Parse the user's message and return ONLY valid JSON with this shape:
{
  "intent": "add" | "list_today" | "list_week" | "list_month" | "list_year" | "done" | "prioritize" | "set_deadline" | "delete" | "unknown",
  "todo": {
    "title": string | null,
    "notes": string | null,
    "priority": "urgent" | "high" | "medium" | "low" | null,
    "deadline": "YYYY-MM-DD" | null,
    "search_term": string | null,
    "category": string | null
  }
}

Priority levels: urgent (most critical), high, medium (default), low.
Category is a free-text project or area label (e.g. "Home", "Taxes", "Work"). Extract it if the user mentions one — e.g. "add Home: fix roof" → category "Home", title "Fix roof". If no category is mentioned, return null.
Today's date is ${today}. Timezone is Europe/Lisbon.
Never return anything other than the JSON object.`,
    messages: [{ role: "user", content: message }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  return JSON.parse(text) as ParsedIntent;
}
