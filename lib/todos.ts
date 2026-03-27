import { supabaseAdmin } from "./supabase";
import type { Priority } from "./claude";

export type { Priority };

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  deadline: string | null; // YYYY-MM-DD
  category: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

const priorityOrder: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function sortByPriority(todos: Todo[]): Todo[] {
  return todos.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

function lisbonToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" });
}

function lisbonDatePlusDays(days: number): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function lisbonEndOfMonth(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  d.setMonth(d.getMonth() + 1, 0);
  return d.toLocaleDateString("en-CA");
}

function lisbonEndOfYear(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" }));
  return `${d.getFullYear()}-12-31`;
}

export async function addTodo(data: {
  title: string;
  notes?: string | null;
  priority?: Priority | null;
  deadline?: string | null;
  category?: string | null;
}): Promise<Todo> {
  const { data: todo, error } = await supabaseAdmin
    .from("todos")
    .insert({
      title: data.title,
      notes: data.notes ?? null,
      priority: data.priority ?? "medium",
      deadline: data.deadline ?? null,
      category: data.category ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return todo;
}

export async function listOpen(): Promise<Todo[]> {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return sortByPriority(data as Todo[]);
}

export async function listToday(): Promise<Todo[]> {
  const today = lisbonToday();
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .or(`deadline.is.null,deadline.lte.${today}`);

  if (error) throw error;
  return sortByPriority(data as Todo[]);
}

export async function listTomorrow(): Promise<Todo[]> {
  const tomorrow = lisbonDatePlusDays(1);
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .or(`deadline.is.null,deadline.lte.${tomorrow}`);

  if (error) throw error;
  return sortByPriority(data as Todo[]);
}

export async function listWeek(): Promise<Todo[]> {
  const end = lisbonDatePlusDays(7);
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .or(`deadline.is.null,deadline.lte.${end}`)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data as Todo[];
}

export async function listMonth(): Promise<Todo[]> {
  const end = lisbonEndOfMonth();
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .or(`deadline.is.null,deadline.lte.${end}`)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data as Todo[];
}

export async function listYear(): Promise<Todo[]> {
  const end = lisbonEndOfYear();
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .or(`deadline.is.null,deadline.lte.${end}`)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data as Todo[];
}

export async function listByCategory(category: string): Promise<Todo[]> {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .ilike("category", category)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return sortByPriority(data as Todo[]);
}

export async function listByPriority(priority: Priority): Promise<Todo[]> {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .eq("priority", priority)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data as Todo[];
}

export async function listOverdue(): Promise<Todo[]> {
  const today = lisbonToday();
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .lt("deadline", today)
    .order("deadline", { ascending: true });

  if (error) throw error;
  return sortByPriority(data as Todo[]);
}

export async function deleteTodoById(id: string): Promise<Todo | null> {
  const { data, error } = await supabaseAdmin
    .from("todos").select("*").eq("id", id).single();
  if (error || !data) return null;
  await supabaseAdmin.from("todos").delete().eq("id", id);
  return data as Todo;
}

export async function updatePriorityById(id: string, priority: Priority): Promise<Todo | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("todos").update({ priority, updated_at: now }).eq("id", id).select().single();
  if (error) return null;
  return data as Todo;
}

export async function updateDeadlineById(id: string, deadline: string): Promise<Todo | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("todos").update({ deadline, updated_at: now }).eq("id", id).select().single();
  if (error) return null;
  return data as Todo;
}

export async function markDoneById(id: string): Promise<Todo | null> {
  const doneAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("todos")
    .update({ done: true, done_at: doneAt, updated_at: doneAt })
    .eq("id", id)
    .select()
    .single();

  if (error) return null;
  return data as Todo;
}

export async function markDone(searchTerm: string): Promise<Todo | null> {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .ilike("title", `%${searchTerm}%`)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  return markDoneById((data[0] as Todo).id);
}

export async function updatePriority(
  searchTerm: string,
  priority: Priority
): Promise<Todo | null> {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .ilike("title", `%${searchTerm}%`)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const todo = data[0] as Todo;
  const now = new Date().toISOString();
  await supabaseAdmin.from("todos").update({ priority, updated_at: now }).eq("id", todo.id);
  return { ...todo, priority };
}

export async function updateDeadline(
  searchTerm: string,
  deadline: string
): Promise<Todo | null> {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .ilike("title", `%${searchTerm}%`)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const todo = data[0] as Todo;
  const now = new Date().toISOString();
  await supabaseAdmin.from("todos").update({ deadline, updated_at: now }).eq("id", todo.id);
  return { ...todo, deadline };
}

export async function deleteTodo(searchTerm: string): Promise<Todo | null> {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .ilike("title", `%${searchTerm}%`)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const todo = data[0] as Todo;
  await supabaseAdmin.from("todos").delete().eq("id", todo.id);
  return todo;
}

export async function getTodoById(id: string): Promise<Todo | null> {
  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Todo;
}

export async function updateTodo(
  id: string,
  updates: Partial<Pick<Todo, "done" | "priority" | "deadline" | "title" | "notes" | "category">>
): Promise<Todo | null> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { ...updates, updated_at: now };
  if (updates.done === true) payload.done_at = now;
  if (updates.done === false) payload.done_at = null;

  const { data, error } = await supabaseAdmin
    .from("todos")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Todo;
}
