import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { cleanClassLink, getClassLinks, setClassLink } from "@/lib/classLinks";

// Admin -> Attendance's per-batch class link.
// GET ?batchId=X     → { url } (null if none set)
// PUT { batchId, url } → set it; an empty url removes it
export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const batchId = new URL(req.url).searchParams.get("batchId");
  if (!batchId) return new Response("Missing batchId.", { status: 400 });
  const links = await getClassLinks(supabase, [batchId]);
  return Response.json({ url: links[batchId] ?? null });
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const body = (await req.json().catch(() => null)) as { batchId?: unknown; url?: unknown } | null;
  const batchId = typeof body?.batchId === "string" ? body.batchId : "";
  if (!batchId) return new Response("Missing batchId.", { status: 400 });
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  const url = cleanClassLink(raw);
  if (raw && !url) return new Response("That doesn't look like a valid link.", { status: 400 });

  const { error } = await setClassLink(supabase, batchId, url);
  if (error) {
    console.error("Failed to save class link", batchId, error);
    return new Response("Couldn't save the link.", { status: 500 });
  }
  return Response.json({ url });
}
