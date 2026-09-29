import { WhatsAppLink } from "./WhatsAppLink";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="final-cta">
      <div className="container final-cta__inner">
        <Reveal><p className="eyebrow">Prêt(e) ?</p><h2>Your French journey<br/><em>starts with a conversation.</em></h2></Reveal>
        <Reveal delay={.12}><WhatsAppLink className="button button--accent final-cta__button">Talk to Yana</WhatsAppLink></Reveal>
        <div className="final-cta__mark" aria-hidden="true">ç<span>.</span></div>
      </div>
    </section>
  );
}
