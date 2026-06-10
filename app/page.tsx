import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageSquareText, Sparkles, TimerReset } from "lucide-react";

const steps = [
  { icon: MessageSquareText, number: "01", title: "Tutor reflects", text: "Capture what clicked, what needs work, and where to go next." },
  { icon: Sparkles, number: "02", title: "The week takes shape", text: "Turn one expert reflection into five focused 15-minute sessions." },
  { icon: TimerReset, number: "03", title: "Practice stays light", text: "Short, varied activities help students build momentum every day." },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="eyebrow"><span /> Between-session learning, made purposeful</div>
        <h1>A great tutoring hour should last <em>all week.</em></h1>
        <p className="hero-copy">Practice Loop turns a tutor&apos;s lesson reflection into a simple, personalised week of practice that keeps learning moving.</p>
        <div className="hero-actions">
          <Link className="button" href="/dashboard">Open tutor dashboard <ArrowRight size={17} /></Link>
          <a href="#how-it-works" className="text-link">See how it works</a>
        </div>
        <div className="hero-proof">
          <div><strong>5 × 15</strong><span>minutes of focused practice</span></div>
          <div><strong>1</strong><span>thoughtful tutor reflection</span></div>
          <div><strong>0</strong><span>generic worksheets</span></div>
        </div>
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
      </section>

      <section className="home-section" id="how-it-works">
        <div className="section-intro">
          <span className="kicker">A considered rhythm</span>
          <h2>Human insight sets the direction. Practice builds the habit.</h2>
        </div>
        <div className="steps-grid">
          {steps.map(({ icon: Icon, number, title, text }) => (
            <article className="step-card" key={number}>
              <div className="step-icon"><Icon size={21} /></div>
              <span className="step-number">{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="promise-panel">
        <div>
          <span className="kicker">Built for the space between sessions</span>
          <h2>Small enough to start.<br />Useful enough to matter.</h2>
        </div>
        <ul>
          <li><CheckCircle2 size={18} /> Grounded in the tutor&apos;s real lesson</li>
          <li><CheckCircle2 size={18} /> Shaped around each student&apos;s needs</li>
          <li><CheckCircle2 size={18} /> Clear progress for the next conversation</li>
        </ul>
      </section>
    </main>
  );
}
