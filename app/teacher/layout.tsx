import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TeacherShell } from "@/components/TeacherShell";
import { getTeacherSession } from "@/lib/teachers";
import styles from "@/components/TeacherPortal.module.css";

export const metadata: Metadata = {
  title: "Teacher portal",
  robots: { index: false, follow: false },
};

// proxy.ts already keeps everyone but role 'teacher' out of /teacher. This
// re-checks the teachers row itself on every render, so a paused or
// removed teacher sees why instead of the portal — the JWT role claim alone
// can be up to an hour stale. The API routes check again (lib/teachers.ts).
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await getTeacherSession();

  if (session.kind === "active") return <TeacherShell>{children}</TeacherShell>;

  return (
    <TeacherShell showNav={false}>
      <div className={styles.notice}>
        {session.kind === "deactivated" ? (
          <>
            <h1>Access paused.</h1>
            <p>Your teacher access has been paused. Nothing has been deleted.</p>
            <p>Please contact Yana if you think this is a mistake.</p>
          </>
        ) : (
          <>
            <h1>No teacher account.</h1>
            <p>This login isn&rsquo;t linked to a teacher account any more. Please log out and contact Yana.</p>
          </>
        )}
      </div>
    </TeacherShell>
  );
}
