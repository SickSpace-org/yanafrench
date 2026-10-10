import { after } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { sendTeacherInviteEmail } from "@/lib/email";
import { getTeacherById, linkTeacherAndCreateSetupLink, TeacherInviteError } from "@/lib/teachers";

// POST: Admin -> Teachers' "Resend invite". Finishes linking the login if an
// earlier attempt didn't, then emails a fresh one-time setup link (after()).
// Safe to repeat.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return new Response("Supabase isn't configured.", { status: 501 });

  const { id } = await params;
  const teacher = await getTeacherById(supabase, id).catch(() => null);
  if (!teacher) return new Response("Teacher not found.", { status: 404 });
  if (teacher.status !== "active") return new Response("Reactivate this teacher before re-inviting.", { status: 409 });

  try {
    const setupUrl = await linkTeacherAndCreateSetupLink(supabase, teacher);
    after(() =>
      sendTeacherInviteEmail(teacher.email, teacher.fullName, setupUrl)
        .then((sent) => {
          if (!sent) console.error("Teacher invite email not delivered to", teacher.email);
        })
        .catch((err) => console.error("Teacher invite email failed for", teacher.email, err))
    );
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof TeacherInviteError) return new Response(err.message, { status: err.status });
    console.error("Failed to re-invite teacher", id, err);
    return new Response("Couldn't send the invite. Check the server logs.", { status: 500 });
  }
}
