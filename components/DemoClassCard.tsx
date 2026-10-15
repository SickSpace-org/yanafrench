import { Reveal } from "./Reveal";

// Free Demo Class — booked by time slot (components/BookingModal.tsx),
// separately from the Orientation Test.
export function DemoClassCard({ onBook }: { onBook: () => void }) {
  return (
    <Reveal className="orientation-card orientation-card--demo">
      <div className="orientation-card__copy">
        <p className="eyebrow">Try a class first</p>
        <h3>Free Demo Class</h3>
        <p>Join a live online class with Yana, see how the course works and ask your questions. Pick a time slot — at most 5 students per slot.</p>
      </div>
      <ul className="orientation-card__facts">
        <li><strong>Free</strong><span>No payment</span></li>
        <li><strong>Live</strong><span>Online, with Yana</span></li>
        <li><strong>5 max</strong><span>Per slot</span></li>
      </ul>
      <button type="button" className="button button--accent" onClick={onBook}>
        Book a free demo
      </button>
    </Reveal>
  );
}
