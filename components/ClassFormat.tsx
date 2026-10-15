import { WhatsAppLink } from "./WhatsAppLink";
import { Reveal } from "./Reveal";
import { IconOnline, IconStudents, IconCalendar, IconGuidance } from "./Icons";

const details = [
  ["01", "100% online", IconOnline],
  ["02", "Up to 5 students", IconStudents],
  ["03", "Batches based on availability", IconCalendar],
  ["04", "Direct guidance from Yana", IconGuidance],
] as const;

export function ClassFormat() {
  return (
    <section className="section class-format">
      <div className="container class-format__grid">
        <Reveal><p className="eyebrow">The format</p><h2>Your class.<br/><em>Your progress.</em></h2></Reveal>
        <Reveal className="class-format__details" delay={.1}>
          {details.map(([n, label, Icon]) => (
            <div key={n}>
              <span className="class-format__icon"><Icon/></span>
              <span className="class-format__num">{n}</span>
              <strong>{label}</strong>
            </div>
          ))}
          <WhatsAppLink message="Hi Yana! I found The Français Hub website and would like to ask about current batch availability." className="button button--accent class-format__cta">Ask about availability</WhatsAppLink>
        </Reveal>
      </div>
    </section>
  );
}
