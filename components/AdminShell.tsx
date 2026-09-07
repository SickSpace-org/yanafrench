"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./AdminShell.module.css";

const navItems = [
  { label: "Lessons", href: "/admin" },
  { label: "Batches", href: "/admin/batches" },
  { label: "Enrollments", href: "/admin/enrollments" },
  { label: "Highlights", href: "/admin/highlights" },
  { label: "Messages", href: "/admin/messages" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.brand}>le hub<span>.</span> <small>admin</small></Link>
        <Link href="/student-hub" className={styles.viewStudent}>View as student →</Link>
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
