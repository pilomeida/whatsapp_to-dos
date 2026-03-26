import { NextRequest, NextResponse } from "next/server";
import { addTodo, listOpen, updateTodo, deleteTodo, getTodoById } from "@/lib/todos";

export async function GET() {
  try {
    const todos = await listOpen();
    // Also include done items (last 30 days) for the dashboard's Done filter
    const { supabaseAdmin } = await import("@/lib/supabase");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: doneTodos } = await supabaseAdmin
      .from("todos")
      .select("*")
      .eq("done", true)
      .gte("done_at", thirtyDaysAgo.toISOString())
      .order("done_at", { ascending: false });

    return NextResponse.json({ open: todos, done: doneTodos ?? [] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch todos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, notes, priority, deadline } = body;
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const todo = await addTodo({ title, notes, priority, deadline });
    return NextResponse.json(todo, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to add todo" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await getTodoById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const todo = await updateTodo(id, updates);
    return NextResponse.json(todo);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update todo" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const existing = await getTodoById(id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await deleteTodo(existing.title);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete todo" }, { status: 500 });
  }
}
