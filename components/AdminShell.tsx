"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./AdminShell.module.css";

const navItems = [
  { label: "Lessons", href: "/admin" },
  { label: "Batches", href: "/admin/batches" },
  { label: "Enrollments", href: "/admin/enrollments" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Students", href: "/admin/students" },
  { label: "Highlights", href: "/admin/highlights" },
  { label: "Messages", href: "/admin/messages" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.brand}>le hub<span>.</span> <small>admin</small></Link>
        <div className={styles.headerActions}>
          <Link href="/student-hub" className={styles.viewStudent}>View as student →</Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className={styles.signOut}>Log out</button>
          </form>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <nav aria-label="Admin navigation">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={active ? styles.navActive : styles.navItem}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
