"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BfcacheGuard } from "../BfcacheGuard";
import { SignOutButton } from "./SignOutButton";
import styles from "./AiHubApp.module.css";

const NAV = [
  { label: "Aujourd'hui", href: "/kiosque/app" },
  { label: "Speaking", href: "/kiosque/app/pronunciation" },
  { label: "Translate & Library", href: "/kiosque/app/library" },
  { label: "Daily Quiz", href: "/kiosque/app/quiz" },
  { label: "Daily News", href: "/kiosque/app/news" },
];

export function AiHubShell({ children, daysLeft, isAdmin }: { children: ReactNode; daysLeft: number; isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Link href="/kiosque/app" className={styles.brand}>
          Le Kiosque<span>.</span> <small>by le hub</small>
        </Link>
        <div className={styles.headerRight}>
          {!isAdmin && (
            <span className={`${styles.daysChip} ${daysLeft <= 5 ? styles.daysChipLow : ""}`}>
              {daysLeft} day{daysLeft === 1 ? "" : "s"} left
            </span>
          )}
          <SignOutButton className={styles.signOut} label={isAdmin ? "Exit preview" : "Use a different email"} />
        </div>
      </header>
      {isAdmin && (
        <div className={styles.preview}>
          Admin preview — members see this same app.
          <Link href="/admin/kiosque">Back to Le Kiosque admin →</Link>
        </div>
      )}
      <BfcacheGuard />
      <nav className={styles.nav} aria-label="Le Kiosque navigation">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`${styles.navLink} ${active ? styles.navActive : ""}`} aria-current={active ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
