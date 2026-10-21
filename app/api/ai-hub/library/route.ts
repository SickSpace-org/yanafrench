import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse } from "@/lib/auth";
import { requireAiMember } from "@/lib/aiHub";
import type { LibraryWord } from "@/lib/aiHubData";

const MAX_WORDS = 2000;

type WordRow = { id: string; term: string; meaning: string; note: string; created_at: string };
const toWord = (r: WordRow): LibraryWord => ({ id: r.id, term: r.term, meaning: r.meaning, note: r.note, createdAt: r.created_at });

// GET: the member's saved words, newest first.
export async function GET() {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { data, error } = await supabase
    .from("ai_hub_words")
    .select("id, term, meaning, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_WORDS);
  if (error) {
    console.error("Failed to load Le Kiosque library", error);
    return new Response("Couldn't load your library.", { status: 500 });
  }
  return Response.json(((data as WordRow[]) ?? []).map(toWord));
}

// POST { term, meaning, note? }: save a word. Saving the same term again
// updates it instead of adding a duplicate.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = await req.json().catch(() => null);
  const term = typeof body?.term === "string" ? body.term.trim().slice(0, 200) : "";
  const meaning = typeof body?.meaning === "string" ? body.meaning.trim().slice(0, 400) : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 400) : "";
  if (!term || !meaning) return new Response("A word needs both the French and its meaning.", { status: 400 });

  const { data: existing } = await supabase
    .from("ai_hub_words")
    .select("id")
    .eq("user_id", userId)
    .ilike("term", term.replace(/[%_\\]/g, "\\$&"))
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("ai_hub_words")
      .update({ meaning, note })
      .eq("id", existing.id)
      .select("id, term, meaning, note, created_at")
      .single();
    if (error) {
      console.error("Failed to update Le Kiosque word", error);
      return new Response("Couldn't save that word.", { status: 500 });
    }
    return Response.json(toWord(data as WordRow));
  }

  const { count } = await supabase.from("ai_hub_words").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= MAX_WORDS) return new Response("Your library is full — remove a few words first.", { status: 409 });

  const id = `word-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const { data, error } = await supabase
    .from("ai_hub_words")
    .insert({ id, user_id: userId, term, meaning, note })
    .select("id, term, meaning, note, created_at")
    .single();
  if (error) {
    console.error("Failed to save Le Kiosque word", error);
    return new Response("Couldn't save that word.", { status: 500 });
  }
  return Response.json(toWord(data as WordRow));
}

// DELETE ?id=…: remove one of the member's own words.
export async function DELETE(req: Request) {
  let userId: string;
  try {
    userId = (await requireAiMember()).userId;
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("Missing id.", { status: 400 });

  const { error } = await supabase.from("ai_hub_words").delete().eq("id", id).eq("user_id", userId);
  if (error) {
    console.error("Failed to delete Le Kiosque word", error);
    return new Response("Couldn't remove that word.", { status: 500 });
  }
  return Response.json({ ok: true });
}
