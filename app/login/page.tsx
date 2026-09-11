import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  link_invalid: "That link has expired or was already used. Request a new one below.",
  auth_callback: "We couldn't complete sign-in. Please try again.",
  reset_success: "Password updated. Sign in with your new password.",
  signed_out: "You've been signed out.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "";
  const noticeKey = sp.error ?? sp.notice ?? "";
  const notice = NOTICES[noticeKey] ?? null;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.mark}>ç.</span>
          <h1>The Fran&ccedil;ais Hub</h1>
          <p>Sign in to your hub.</p>
        </div>
        <LoginForm next={next} notice={notice} />
      </div>
    </main>
  );
}
