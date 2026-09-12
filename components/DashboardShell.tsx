"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { getNotifications } from "@/lib/notificationData";
import { useStudentProfile, displayName } from "@/lib/useStudentProfile";
import styles from "./DashboardShell.module.css";

const navItems: { type: string; label: string; href?: string }[] = [
  { type: "dashboard", label: "Dashboard", href: "/student-hub" },
  { type: "lessons", label: "Lessons", href: "/student-hub/lessons" },
  { type: "speaking", label: "Speaking Practice", href: "/student-hub/speaking" },
  { type: "vocabulary", label: "Vocabulary", href: "/student-hub/vocabulary" },
  { type: "progress", label: "Progress", href: "/student-hub/progress" },
  { type: "calendar", label: "Calendar", href: "/student-hub/calendar" },
  { type: "messages", label: "Messages", href: "/student-hub/messages" },
  { type: "settings", label: "Settings", href: "/student-hub/settings" },
];

function NavIcon({ type }: { type: string }) {
  const props = { viewBox: "0 0 24 24", "aria-hidden": true, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (type) {
    case "dashboard": return <svg {...props}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.4"/><rect x="13" y="3.5" width="7.5" height="4.5" rx="1.4"/><rect x="13" y="10.5" width="7.5" height="10" rx="1.4"/><rect x="3.5" y="13.5" width="7.5" height="7" rx="1.4"/></svg>;
    case "lessons": return <svg {...props}><path d="M4 4.5h11.5L20 9v10.5H4z"/><path d="M15.5 4.5V9H20"/><path d="M7.5 13h9M7.5 16.2h6"/></svg>;
    case "speaking": return <svg {...props}><rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/></svg>;
    case "vocabulary": return <svg {...props}><path d="M5 4.5h14v13H9l-4 3.5z"/><path d="M8.5 9h7M8.5 12h4.5"/></svg>;
    case "progress": return <svg {...props}><path d="M4 20V10M11 20V4M18 20v-6.5"/></svg>;
    case "calendar": return <svg {...props}><rect x="3.5" y="5" width="17" height="15.5" rx="1.6"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/></svg>;
    case "messages": return <svg {...props}><path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4z"/></svg>;
    default: return <svg {...props}><circle cx="12" cy="12" r="2.6"/><path d="M12 3.5v2.4M12 18v2.5M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7 16 16M8 8 6.3 6.3"/></svg>;
  }
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const profile = useStudentProfile();
  const name = displayName(profile) || "Student";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  const initials = name.slice(0, 2).toUpperCase();

  function closeMenus() {
    setNotifOpen(false);
    setProfileOpen(false);
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" className={styles.menuToggle} aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((v) => !v)}>
            <span /><span /><span />
          </button>
          <Link href="/student-hub" className={styles.brand}>le hub<span>.</span></Link>
        </div>
        <div className={styles.date}>{today}</div>
        <div className={styles.headerActions}>
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" strokeLinejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round"/></svg>
              <span className={styles.dot} />
            </button>
            {notifOpen && (
              <div className={styles.dropdown}>
                <span className={styles.dropdownHeading}>Notifications</span>
                {getNotifications().slice(0, 3).map((n) => (
                  <div key={n.id} className={styles.notifItem}>
                    <strong>{n.title}</strong>
                    <small>{n.detail} · {n.date}</small>
                  </div>
                ))}
                <Link href="/student-hub/notifications" className={styles.dropdownLink} onClick={() => setNotifOpen(false)}>View all →</Link>
              </div>
            )}
          </div>

          <div className={styles.menuWrap}>
            <button
              type="button"
              className={styles.avatarButton}
              aria-label="Profile menu"
              aria-expanded={profileOpen}
              onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
            >
              {initials}
            </button>
            {profileOpen && (
              <div className={`${styles.dropdown} ${styles.dropdownRight}`}>
                <span className={styles.dropdownHeading}>{name}</span>
                <button type="button" className={styles.dropdownLink}>View profile</button>
                <button type="button" className={styles.dropdownLink}>Settings</button>
                <form action="/auth/signout" method="post" style={{ display: "contents" }}>
                  <button type="submit" className={styles.dropdownLink}>Log out</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {(notifOpen || profileOpen) && <button type="button" className={styles.backdrop} aria-label="Close menus" onClick={closeMenus} />}
      {mobileNavOpen && <button type="button" className={styles.backdrop} aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <div className={styles.body}>
        <aside className={`${styles.sidebar} ${mobileNavOpen ? styles.sidebarOpen : ""}`}>
          <nav aria-label="Student platform navigation">
            {navItems.map((item) => {
              const active = item.href != null && (item.href === "/student-hub" ? pathname === item.href : pathname?.startsWith(item.href));
              const className = active ? styles.navActive : styles.navItem;
              return item.href ? (
                <Link key={item.label} href={item.href} className={className} onClick={() => setMobileNavOpen(false)}>
                  <NavIcon type={item.type} />
                  {item.label}
                </Link>
              ) : (
                <span key={item.label} className={className}>
                  <NavIcon type={item.type} />
                  {item.label}
                </span>
              );
            })}
          </nav>
        </aside>

        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
