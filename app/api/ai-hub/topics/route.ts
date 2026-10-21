import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { requireAiMember } from "@/lib/aiHub";
import type { AiHubTopic } from "@/lib/aiHubData";

// GET: the speaking topics Yana has added (members and admins). An empty list
// is fine — the app also has its own built-in topics.
export async function GET() {
  try {
    await requireAiMember();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return Response.json([]);

  const { data, error } = await supabase.from("ai_hub_topics").select("id, topic, points, created_at").order("created_at", { ascending: false });
  if (error) {
    console.error("Failed to load speaking topics", error);
    return Response.json([]);
  }
  const topics: AiHubTopic[] = (data ?? []).map((r) => ({
    id: r.id as string,
    topic: r.topic as string,
    points: r.points as string,
    createdAt: r.created_at as string,
  }));
  return Response.json(topics);
}

// POST { topic, points? }: admin adds a speaking topic.
export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = await req.json().catch(() => null);
  const topic = typeof body?.topic === "string" ? body.topic.trim().slice(0, 300) : "";
  const points = typeof body?.points === "string" ? body.points.trim().slice(0, 300) : "";
  if (!topic) return new Response("Write the topic first.", { status: 400 });

  const row = { id: `top-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, topic, points, created_at: new Date().toISOString() };
  const { error } = await supabase.from("ai_hub_topics").insert(row);
  if (error) {
    console.error("Failed to save speaking topic", error);
    return new Response("Couldn't save the topic. Has the speaking-topics migration been run?", { status: 500 });
  }
  return Response.json({ id: row.id, topic, points, createdAt: row.created_at } satisfies AiHubTopic);
}
