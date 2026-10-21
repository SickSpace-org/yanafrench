// Role values and role -> landing page, shared by proxy.ts (via
// lib/supabase/proxy.ts), lib/auth.ts and /auth/home so the three can't
// drift. Roles come from public.user_roles (see db/auth-setup.sql and
// supabase/migrations/20261009120000_add_teacher_role.sql). One role per
// login: a teacher's email can never also be a student or admin.

export type ViewerRole = "admin" | "student" | "teacher" | "ai_member" | null;

export function roleFromClaim(value: unknown): ViewerRole {
  return value === "admin" || value === "student" || value === "teacher" || value === "ai_member" ? value : null;
}

export function homeForRole(role: ViewerRole): string {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "ai_member") return "/kiosque/app";
  return "/student-hub";
}
