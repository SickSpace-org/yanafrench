import { authErrorResponse, requireAdmin } from "@/lib/auth";
import { enrollablePriceInPaise } from "@/lib/courseCatalogData";
import { findEnrollable } from "@/lib/courseCatalogServer";
import { EMI_MAX_PAYMENTS, emiSettingProblem, isFullPaymentOnly, type EmiSetting } from "@/lib/emiData";
import { readEmiSettings, writeEmiSetting } from "@/lib/emiSettingsServer";

// GET: public — the course page's checkout reads it to show each product's
// current EMI plan (lib/emiData.ts resolveEmiPlan turns a setting, or its
// absence, into the plan). It's pricing the site shows anyway.
export async function GET() {
  return Response.json(await readEmiSettings(), { headers: { "Cache-Control": "no-store" } });
}

// PUT { productId, setting } (admin): saves Admin → EMI Plans' plan for one
// product; setting: null resets it to the default. Only affects new
// enrollments — existing students' schedules are edited in Admin → EMI.
export async function PUT(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    return authErrorResponse(err);
  }

  const body = (await req.json().catch(() => null)) as { productId?: unknown; setting?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const enrollable = await findEnrollable(productId);
  if (!enrollable || enrollable.kind === "orientation") return new Response("Unknown course.", { status: 400 });

  if (body?.setting === null) {
    return (await writeEmiSetting(productId, null)) ? Response.json({ ok: true }) : new Response("Couldn't save.", { status: 502 });
  }

  if (isFullPaymentOnly(enrollable)) return new Response("This course is set to No EMI in Admin → Courses.", { status: 400 });

  const raw = body?.setting as Partial<EmiSetting> | undefined;
  if (!raw || !Array.isArray(raw.payments) || raw.payments.length > EMI_MAX_PAYMENTS) {
    return new Response("Invalid plan.", { status: 400 });
  }
  const setting: EmiSetting = {
    enabled: raw.enabled === true,
    payments: raw.payments.map((p, i) => ({
      rupees: Number(p?.rupees),
      afterDays: i === 0 ? 0 : Number(p?.afterDays),
      ...(typeof p?.note === "string" && p.note.trim() ? { note: p.note.trim() } : {}),
    })),
  };
  const problem = emiSettingProblem(setting, enrollablePriceInPaise(enrollable));
  if (problem) return new Response(problem, { status: 400 });

  return (await writeEmiSetting(productId, setting)) ? Response.json({ ok: true }) : new Response("Couldn't save.", { status: 502 });
}
