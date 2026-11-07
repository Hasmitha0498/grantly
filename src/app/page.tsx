import { ArrowRight, CalendarCheck2, Scale, ShieldCheck } from 'lucide-react';
import { LandingCtas } from '@/components/onboarding/LandingCtas';

const benefits = [
  { title: 'See why you qualify', body: 'Every requirement is checked line by line, with a plain reason — never a vague match score.', icon: ShieldCheck },
  { title: 'Compare the real costs', body: 'See what each award actually leaves you to pay across the whole program.', icon: Scale },
  { title: 'Know what to do next', body: 'Deadlines, essays and follow-ups turn into one clear next step.', icon: CalendarCheck2 },
];

export default function WelcomePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="grid items-center gap-10 py-4 md:grid-cols-[1.15fr_0.85fr] md:py-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">Your funding journey, made clearer.</p>
          <h1 className="mt-3 text-[2.15rem] font-semibold leading-[1.08] text-ink sm:text-5xl">
            Find your funding. Know your fit. Make your move.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Discover scholarships for your US master’s, understand what they really cover, and keep every application on track.
          </p>
          <LandingCtas />
          <p className="mt-6 max-w-lg text-sm text-muted">
            We help you understand and manage opportunities. Scholarship decisions are always made by the providers.
          </p>
        </div>

        <figure aria-label="Example: comparing two programs" className="card relative overflow-hidden p-6 shadow-[0_20px_50px_-30px_rgba(25,77,67,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Example from the sample journey</p>
          <p className="mt-2 font-display text-lg font-semibold">The biggest award isn’t always the most affordable path.</p>
          <ul className="mt-5 space-y-4">
            {[
              { name: 'Program A', cost: 90, award: 30, left: 60 },
              { name: 'Program B', cost: 70, award: 20, left: 50 },
            ].map((p) => (
              <li key={p.name}>
                <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-muted">
                    ${p.cost}k cost · ${p.award}k potential award
                  </span>
                </div>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-mint" aria-hidden="true">
                  <div className="bg-forest" style={{ width: `${(p.left / 90) * 100}%` }} />
                  <div className="bg-accent/60" style={{ width: `${(p.award / 90) * 100}%` }} />
                </div>
                <p className="mt-1 text-sm">
                  <strong>${p.left}k</strong> left to pay if awarded
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-1 text-sm font-semibold text-forest">
            Program B leaves $10k less to pay <ArrowRight aria-hidden="true" size={15} />
          </p>
        </figure>
      </section>

      <section aria-labelledby="benefits" className="mt-10">
        <h2 id="benefits" className="sr-only">
          What GRANTLY helps with
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {benefits.map(({ title, body, icon: Icon }) => (
            <li key={title} className="card p-5">
              <Icon aria-hidden="true" className="text-forest" size={22} />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-[0.95rem] text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-10 text-center text-xs text-muted">Sample data — not real scholarship offers. All providers and programs in this demo are fictional.</p>
    </div>
  );
}
