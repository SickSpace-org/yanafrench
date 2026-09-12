"use client";

import Link from "next/link";
import { useState } from "react";
import { lessons } from "@/lib/courseData";
import { computeOverallProgress } from "@/lib/progressData";
import { getSpeakingHistory } from "@/lib/speakingData";
import { usePortalState } from "@/lib/usePortalState";
import { useStudentProfile } from "@/lib/useStudentProfile";
import { DashboardShell } from "./DashboardShell";
import styles from "./SettingsPage.module.css";

const tabs = ["Profile", "Password", "Notifications", "Language", "Appearance", "Account"] as const;
type Tab = (typeof tabs)[number];

function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <button type="button" className={on ? styles.toggleOn : styles.toggleOff} onClick={() => setOn((v) => !v)} aria-pressed={on}>
        <i />
      </button>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Profile");
  const profileData = useStudentProfile();
  const name = profileData.kind === "student" ? profileData.student.name : profileData.kind === "admin-preview" ? profileData.email : "";
  const email = profileData.kind === "student" ? profileData.student.email : profileData.kind === "admin-preview" ? profileData.email : "";
  const course = profileData.kind === "student" ? profileData.student.course : "—";
  const initials = (name || "?").slice(0, 2).toUpperCase();
  const { quizSessions } = usePortalState();
  const overallProgress = computeOverallProgress(lessons, quizSessions, getSpeakingHistory());

  return (
    <DashboardShell>
      <div className={styles.head}>
        <small>LE HUB</small>
        <h1>Profile &amp; Settings.</h1>
      </div>

      <div className={styles.layout}>
        <nav className={styles.tabList}>
          {tabs.map((t) => (
            <button key={t} type="button" className={tab === t ? styles.tabActive : styles.tab} onClick={() => setTab(t)}>{t}</button>
          ))}
        </nav>

        <div className={styles.panel}>
          {tab === "Profile" && (
            <>
              <div className={styles.profileHead}>
                <span className={styles.avatar}>{initials}</span>
                <div>
                  <strong>{name}</strong>
                  <small>{email}</small>
                </div>
                <button type="button" className={styles.ghostButton}>Change photo</button>
              </div>

              <div className={styles.fieldGrid}>
                <label>
                  <span>Name</span>
                  <input key={name} defaultValue={name} />
                </label>
                <label>
                  <span>Email</span>
                  <input key={email} defaultValue={email} type="email" />
                </label>
                <label>
                  <span>Course</span>
                  <input key={course} defaultValue={course} disabled />
                </label>
              </div>

              <label className={styles.fullWidth}>
                <span>Learning goals</span>
                <textarea placeholder="What are you working toward?" />
              </label>

              <div className={styles.progressCallout}>
                <div>
                  <span>OVERALL PROGRESS</span>
                  <strong>{overallProgress}%</strong>
                </div>
                <Link href="/student-hub/progress" className={styles.link}>View progress →</Link>
              </div>

              <button type="button" className={styles.saveButton}>Save changes</button>
            </>
          )}

          {tab === "Password" && (
            <div className={styles.fieldGrid}>
              <label className={styles.fullWidth}><span>Current password</span><input type="password" placeholder="••••••••" /></label>
              <label><span>New password</span><input type="password" placeholder="••••••••" /></label>
              <label><span>Confirm new password</span><input type="password" placeholder="••••••••" /></label>
              <button type="button" className={styles.saveButton}>Update password</button>
            </div>
          )}

          {tab === "Notifications" && (
            <div className={styles.toggleList}>
              <Toggle label="Class reminders" defaultOn />
              <Toggle label="New lesson and video alerts" defaultOn />
              <Toggle label="Assignment deadlines" defaultOn />
              <Toggle label="Speaking and test results" defaultOn />
              <Toggle label="Teacher feedback" defaultOn />
              <Toggle label="Product and platform updates" />
            </div>
          )}

          {tab === "Language" && (
            <div className={styles.optionList}>
              <label className={styles.optionRow}><input type="radio" name="lang" defaultChecked /> English (interface)</label>
              <label className={styles.optionRow}><input type="radio" name="lang" /> Français (interface)</label>
            </div>
          )}

          {tab === "Appearance" && (
            <div className={styles.optionList}>
              <label className={styles.optionRow}><input type="radio" name="theme" defaultChecked /> Light</label>
              <label className={styles.optionRow}><input type="radio" name="theme" /> Dark</label>
              <label className={styles.optionRow}><input type="radio" name="theme" /> Match system</label>
            </div>
          )}

          {tab === "Account" && (
            <div className={styles.accountList}>
              <div className={styles.accountRow}>
                <div><strong>Plan</strong><small>Small-batch French coaching with Yana</small></div>
                <span className={styles.pill}>Active</span>
              </div>
              <div className={styles.accountRow}>
                <div><strong>Log out</strong><small>Sign out of Le Hub on this device</small></div>
                <form action="/auth/signout" method="post">
                  <button type="submit" className={styles.ghostButton}>Log out</button>
                </form>
              </div>
              <div className={styles.accountRow}>
                <div><strong>Delete account</strong><small>Permanently remove your Le Hub account and data</small></div>
                <button type="button" className={styles.dangerButton}>Delete account</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
