const FAQ: { q: string; a: string }[] = [
  {
    q: 'What does FlyMS cover?',
    a: "Master's programs at German universities in every field. Each program shows its application windows, key requirements and costs, with a link to the official page.",
  },
  {
    q: 'What do "Open now", "Closing soon" and "Opening soon" mean?',
    a: 'Open now: today is inside the application window. Closing soon: open, with 14 days or fewer left. Opening soon: the window opens within the next 60 days. Dates are calculated in German time, and a deadline counts as open until the end of that day.',
  },
  {
    q: 'How accurate are the dates?',
    a: 'Each program shows when its details were last verified. Universities change deadlines every year, so always confirm on the official page before you apply. If something is wrong, please report it.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. Saved programs are stored only in your browser. Use Settings → Export backup to keep a copy or move it to another device.',
  },
  {
    q: 'Is Winter or Summer intake better?',
    a: 'Winter semester (starting October) has far more programs. Summer semester (starting April) has fewer, but competition can be lower. Deadlines for both are often 6–9 months before the start.',
  },
];

const GLOSSARY: { term: string; meaning: string }[] = [
  {
    term: 'uni-assist',
    meaning:
      'A central service that checks international applications for many German universities. It charges a fee per application.',
  },
  {
    term: 'VPD',
    meaning:
      'Vorprüfungsdokumentation — a uni-assist document that converts your grades to the German scale. Some universities ask you to apply with a VPD.',
  },
  {
    term: 'APS',
    meaning:
      'Akademische Prüfstelle — a certificate verifying your academic documents, required for applicants from some countries (e.g. India, China, Vietnam).',
  },
  {
    term: 'MOI',
    meaning:
      'Medium of Instruction letter — confirms your previous degree was taught in English. Some programs accept it instead of IELTS/TOEFL.',
  },
  {
    term: 'NC',
    meaning:
      'Numerus clausus — restricted admission. Places are limited and selection depends on grades or other criteria.',
  },
  { term: 'ECTS', meaning: 'European credits. A two-year master is usually 120 ECTS.' },
  {
    term: 'Semester contribution',
    meaning:
      'A fee every student pays each semester (often €150–€400). It usually includes a public transport ticket. It is not tuition.',
  },
  {
    term: 'Blocked account',
    meaning:
      'A bank account with a fixed amount for living costs, required for most student visas. You can withdraw a monthly amount.',
  },
  { term: 'TestDaF / DSH', meaning: 'German language tests accepted for German-taught programs.' },
];

export function FaqPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">FAQ & glossary</h1>

      <section aria-labelledby="faq" className="flex flex-col gap-3">
        <h2 id="faq" className="text-xl font-semibold">
          Questions
        </h2>
        {FAQ.map((item) => (
          <details key={item.q} className="group rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="mr-2 inline-block text-muted transition-transform group-open:rotate-90">
                ›
              </span>
              {item.q}
            </summary>
            <p className="mt-2 pl-5 text-sm text-muted">{item.a}</p>
          </details>
        ))}
      </section>

      <section aria-labelledby="glossary" className="flex flex-col gap-3">
        <h2 id="glossary" className="text-xl font-semibold">
          Glossary
        </h2>
        <dl className="divide-y divide-border rounded-lg border border-border bg-surface">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="grid gap-1 p-4 sm:grid-cols-[180px_1fr] sm:gap-4">
              <dt className="font-semibold">{g.term}</dt>
              <dd className="text-sm text-muted">{g.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
