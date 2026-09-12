import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { getVocabStore, saveWordFor, toggleFavoriteFor } from "@/lib/vocabStore";
import type { VocabWord } from "@/lib/vocabData";

// Per-student saved words + favorites (see lib/vocabStore.ts) — replaces
// the old per-browser localStorage version, which never synced across
// devices and was invisible to anyone but the student themselves.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  return Response.json(await getVocabStore(viewer.userId));
}

type VocabAction = { type: "saveWord"; word: VocabWord } | { type: "toggleFavorite"; id: string };

export async function POST(req: Request) {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  const action = (await req.json().catch(() => null)) as VocabAction | null;
  if (!action || typeof action !== "object" || !("type" in action)) {
    return new Response("Invalid action", { status: 400 });
  }

  let store;
  if (action.type === "saveWord" && action.word) {
    store = await saveWordFor(viewer.userId, action.word);
  } else if (action.type === "toggleFavorite" && action.id) {
    store = await toggleFavoriteFor(viewer.userId, action.id);
  } else {
    return new Response("Invalid action", { status: 400 });
  }

  if (!store) return new Response("Not persisted — R2 isn't configured.", { status: 501 });
  return Response.json(store);
}
