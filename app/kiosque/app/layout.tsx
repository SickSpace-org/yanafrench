import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/ai-hub/SignOutButton";
import { AiHubShell } from "@/components/ai-hub/AiHubShell";
import { getAiHubSession } from "@/lib/aiHub";
import { AI_HUB_PRICE_LABEL } from "@/lib/aiHubData";
import { whatsappUrl } from "@/lib/site";
import styles from "@/components/ai-hub/AiHubApp.module.css";

export const metadata: Metadata = {
  title: "Le Kiosque",
  robots: { index: false, follow: false },
};

// Members have no password: they type their email at /kiosque/enter, which
// sets a signed cookie. This re-checks the subscription from the database on
// every render, so a lapsed or paused member sees why instead of the tools.
// Every /api/ai-hub route checks again (lib/aiHub.ts).
export default async function KiosqueAppLayout({ children }: { children: ReactNode }) {
  const session = await getAiHubSession();

  if (session.kind === "none") redirect("/kiosque/enter");

  if (session.kind === "blocked") {
    const reason = session.reason;
    const copy =
      reason === "deactivated"
        ? { title: "Access paused.", body: "Your Le Kiosque access has been paused. Nothing has been deleted — message Yana and she'll sort it out." }
        : reason === "pending"
          ? { title: "Almost there.", body: "We're waiting for your payment to be confirmed. Once Yana confirms it, come back and enter your email again." }
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
              <SignOutButton className={`${styles.btn} ${styles.btnGhost}`} label="Use a different email" />
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
