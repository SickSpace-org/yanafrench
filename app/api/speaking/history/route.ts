import { authErrorResponse, requireStudent, type Viewer } from "@/lib/auth";
import { getSpeakingHistoryFor } from "@/lib/speakingStore";

// A student's own speaking-practice history (see lib/speakingStore.ts),
// replacing the old localStorage read in lib/speakingData.ts.
export async function GET() {
  let viewer: Viewer;
  try {
    viewer = await requireStudent();
  } catch (err) {
    return authErrorResponse(err);
  }

  return Response.json(await getSpeakingHistoryFor(viewer.userId));
}
