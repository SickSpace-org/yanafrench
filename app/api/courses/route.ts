import { revalidatePath } from "next/cache";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { sanitizeCatalog } from "@/lib/courseCatalogData";
import { readCatalog, writeCatalog } from "@/lib/courseCatalogServer";

// GET: public — the catalog (courses, DELF and Orientation Test prices) the
// /courses page shows and Admin → Courses edits.
export async function GET() {
  return Response.json(await readCatalog(), { headers: { "Cache-Control": "no-store" } });
}

// PUT catalog (admin): replaces the whole catalog — add, edit, reorder and
// delete are all just a new list. A changed price carries each course's
// custom EMI plan over to the new fee. Only affects new enrollments;
// students who already enrolled keep what they agreed to pay.
export async function PUT(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const parsed = sanitizeCatalog(await req.json().catch(() => null));
  if ("error" in parsed) return new Response(parsed.error, { status: 400 });

  if (!(await writeCatalog(parsed.catalog))) return new Response("Couldn't save.", { status: 502 });
  revalidatePath("/courses");
  return Response.json(parsed.catalog);
}
