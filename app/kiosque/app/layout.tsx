import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AiHubShell } from "@/components/ai-hub/AiHubShell";
import { getAiHubSession } from "@/lib/aiHub";
import { AI_HUB_PRICE_LABEL } from "@/lib/aiHubData";
import { whatsappUrl } from "@/lib/site";
import styles from "@/components/ai-hub/AiHubApp.module.css";

export const metadata: Metadata = {
  title: "Le Kiosque",
  robots: { index: false, follow: false },
};

// proxy.ts keeps everyone but ai_member logins (and admins previewing) out
// of /kiosque/app. This re-checks the subscription itself on every render,
// so a lapsed or paused member sees why instead of the tools — the JWT role
// alone can be up to an hour stale. Every /api/ai-hub route checks again.
export default async function AiHubAppLayout({ children }: { children: ReactNode }) {
  const session = await getAiHubSession();

  // proxy.ts already sends signed-out visitors to /login, so "none" here
  // means a signed-in login with no membership row. A card, not a redirect:
  // /login would just bounce a signed-in user straight back to this page.
  if (session.kind === "none" || session.kind === "blocked") {
    const reason = session.kind === "blocked" ? session.reason : "none";
    const copy =
      reason === "none"
        ? { title: "No membership found.", body: "This login isn't linked to a Le Kiosque membership. Message Yana if you think this is a mistake." }
        : reason === "deactivated"
        ? { title: "Access paused.", body: "Your Le Kiosque access has been paused. Nothing has been deleted — message Yana and she'll sort it out." }
        : reason === "pending"
          ? { title: "Almost there.", body: "We're waiting for your payment to be confirmed. Once Yana confirms it, you'll get a setup email." }
          : { title: "Your month has ended.", body: `Renew for ${AI_HUB_PRICE_LABEL} to keep going. Your saved words and history are waiting.` };
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <div className={`${styles.card} ${styles.locked}`}>
            <h1>{copy.title}</h1>
            <p>{copy.body}</p>
            <div className={styles.row} style={{ justifyContent: "center", marginTop: "1.2rem" }}>
              <a className={styles.btn} href={whatsappUrl(`Hi Yana! I'd like to renew my Le Kiosque membership (${AI_HUB_PRICE_LABEL}).`)} target="_blank" rel="noreferrer">
                Message Yana on WhatsApp
              </a>
              <form action="/auth/signout" method="post">
                <button type="submit" className={`${styles.btn} ${styles.btnGhost}`}>Log out</button>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <AiHubShell daysLeft={session.daysLeft} isAdmin={session.isAdmin}>
      {children}
    </AiHubShell>
  );
}
