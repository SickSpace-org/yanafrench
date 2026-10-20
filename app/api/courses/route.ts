import { revalidatePath } from "next/cache";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { sanitizeCourses } from "@/lib/courseCatalogData";
import { readCourses, writeCourses } from "@/lib/courseCatalogServer";

// GET: public — the course list the /courses page shows (and Admin → Courses
// edits).
export async function GET() {
  return Response.json(await readCourses(), { headers: { "Cache-Control": "no-store" } });
}

// PUT [...courses] (admin): replaces the whole list — add, edit, reorder and
// delete are all just a new list. Only affects new enrollments; students who
// already enrolled keep what they paid for.
export async function PUT(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const parsed = sanitizeCourses(await req.json().catch(() => null));
  if ("error" in parsed) return new Response(parsed.error, { status: 400 });

  if (!(await writeCourses(parsed.courses))) return new Response("Couldn't save.", { status: 502 });
  revalidatePath("/courses");
  return Response.json(parsed.courses);
}
