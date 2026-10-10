"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AuthNoticeToast } from "./AuthNoticeToast";
import { BfcacheGuard } from "./BfcacheGuard";
import styles from "./AdminShell.module.css";

const navItems = [
  { label: "Dashboard", href: "/teacher" },
  { label: "Attendance", href: "/teacher/attendance" },
  { label: "Class content", href: "/teacher/content" },
  { label: "Announcements", href: "/teacher/announcements" },
];

// Frame for /teacher — same look as the admin shell, with the teacher's own
// nav. showNav is false on the paused / no-account screens.
export function TeacherShell({ children, showNav = true }: { children: ReactNode; showNav?: boolean }) {
  const pathname = usePathname();
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Link href="/teacher" className={styles.brand}>le hub<span>.</span> <small>teacher</small></Link>
        <div className={styles.headerActions}>
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signOut}>Log out</button>
          </form>
        </div>
      </header>
      <Suspense fallback={null}>
        <AuthNoticeToast param="signout_error" message="Couldn&rsquo;t sign you out — please try again." variant="error" />
      </Suspense>
      <BfcacheGuard />
      {showNav ? (
        <div className={styles.body}>
          <aside className={styles.sidebar}>
            <nav aria-label="Teacher navigation">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={pathname === item.href ? styles.navActive : styles.navItem}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className={styles.main}>{children}</main>
        </div>
      ) : (
        <main className={styles.main}>{children}</main>
      )}
    </div>
  );
}
