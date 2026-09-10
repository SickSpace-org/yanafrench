import Link from "next/link";
import { site, whatsappUrl } from "@/lib/site";
import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand"><Wordmark/><p>French, with direction.</p></div>
        <div className="footer__col">
          <span className="footer__heading">Programs</span>
          <Link href="/courses">Courses</Link>
          <Link href="/tef-tcf">TEF / TCF</Link>
          <Link href="/delf">DELF</Link>
          <Link href="/find-your-batch">Find your batch</Link>
          <Link href="/le-hub">Le Hub</Link>
        </div>
        <div className="footer__col">
          <span className="footer__heading">Learn</span>
          <Link href="/results">Results</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/about">About Yana</Link>
        </div>
        <div className="footer__col">
          <span className="footer__heading">Contact</span>
          <a href={whatsappUrl()} target="_blank" rel="noreferrer">WhatsApp ↗</a>
          <a href={site.instagram} target="_blank" rel="noreferrer">Instagram ↗</a>
          <a href={site.linkedin} target="_blank" rel="noreferrer">LinkedIn ↗</a>
        </div>
      </div>
      <div className="container footer__bottom"><span>© 2026 The Français Hub · by Yana Budhiraja</span><span>Online French tutoring · Delhi, India</span></div>
    </footer>
  );
}
