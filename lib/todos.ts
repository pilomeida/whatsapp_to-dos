import { supabaseAdmin } from "./supabase";

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  priority: "high" | "medium" | "low";
  deadline: string | null; // YYYY-MM-DD
  done: boolean;
  done_at: string | null;
  created_at: string;
  updated_at: string;
}

const priorityOrder = { high: 0, medium: 1, low: 2 };

export async function addTodo(data: {
  title: string;
  notes?: string | null;
  priority?: "high" | "medium" | "low" | null;
  deadline?: string | null;
}): Promise<Todo> {
  const { data: todo, error } = await supabaseAdmin
    .from("todos")
    .insert({
      title: data.title,
      notes: data.notes ?? null,
      priority: data.priority ?? "medium",
      deadline: data.deadline ?? null,
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
  return (data as Todo[]).sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

export async function listToday(): Promise<Todo[]> {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Lisbon",
  });

  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .or(`deadline.is.null,deadline.lte.${today}`);

  if (error) throw error;
  return (data as Todo[]).sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

export async function listWeek(): Promise<Todo[]> {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Lisbon" })
  );
  const weekLater = new Date(now);
  weekLater.setDate(weekLater.getDate() + 7);
  const weekStr = weekLater.toLocaleDateString("en-CA");

  const { data, error } = await supabaseAdmin
    .from("todos")
    .select("*")
    .eq("done", false)
    .or(`deadline.is.null,deadline.lte.${weekStr}`);

  if (error) throw error;
  return (data as Todo[]).sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
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

  const todo = data[0] as Todo;
  const doneAt = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("todos")
    .update({ done: true, done_at: doneAt, updated_at: doneAt })
    .eq("id", todo.id);

  if (updateError) throw updateError;
  return { ...todo, done: true, done_at: doneAt };
}

export async function updatePriority(
  searchTerm: string,
  priority: "high" | "medium" | "low"
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

  const { error: updateError } = await supabaseAdmin
    .from("todos")
    .update({ priority, updated_at: now })
    .eq("id", todo.id);

  if (updateError) throw updateError;
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

  const { error: updateError } = await supabaseAdmin
    .from("todos")
    .update({ deadline, updated_at: now })
    .eq("id", todo.id);

  if (updateError) throw updateError;
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

  const { error: deleteError } = await supabaseAdmin
    .from("todos")
    .delete()
    .eq("id", todo.id);

  if (deleteError) throw deleteError;
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
  updates: Partial<Pick<Todo, "done" | "priority" | "deadline" | "title" | "notes">>
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
