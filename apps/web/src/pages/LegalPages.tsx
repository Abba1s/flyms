import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Operator details — fill in before launch (required for a GDPR privacy notice / Impressum). */
const OPERATOR = {
  name: '[Operator name — to be filled in]',
  contact: '[Contact email — to be filled in]',
  updated: '31 October 2026',
};

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4 text-[15px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {children}
    </article>
  );
}

export function PrivacyPage() {
  return (
    <Doc title="Privacy">
      <p className="text-sm text-muted">Last updated {OPERATOR.updated}</p>
      <p>
        Universal Travel and Education Consultancy is built to work without accounts and to keep as
        little personal data as possible. This page explains exactly what is processed and why.
      </p>

      <h2>Data that stays on your device</h2>
      <ul>
        <li>
          Saved programs, your application tracker, notes and SOP drafts are stored only in your
          browser (local storage). We never receive them.
        </li>
        <li>A copy of the program list is cached in your browser so the app works offline.</li>
        <li>
          You can export, import or delete all of this in{' '}
          <Link to="/settings" className="text-primary underline">
            Settings
          </Link>
          .
        </li>
      </ul>

      <h2>Data you send us</h2>
      <ul>
        <li>
          <strong>Contributions, reports, questions and reviews:</strong> the content you write plus
          your name and email (phone optional) — used only to review your submission and reply.
          Reviews show the display name you choose. Submissions are kept until handled and can be
          deleted on request.
        </li>
        <li>
          <strong>SOP writer:</strong> your answers are sent to our server and to Anthropic (the
          provider of the Claude AI model) to write the draft, then discarded by us — we do not
          store or log your answers or the letter. Anthropic processes the request under its own
          commercial terms and privacy policy.
        </li>
      </ul>

      <h2>Abuse protection</h2>
      <ul>
        <li>
          Forms and the SOP writer use Cloudflare Turnstile to block bots. Cloudflare processes
          technical data such as your IP address for this check.
        </li>
        <li>
          To enforce daily limits we store a one-way hash of your IP address combined with a secret
          that changes every day. Hashes are deleted after 48 hours and cannot be turned back into
          an IP address.
        </li>
      </ul>

      <h2>Other services</h2>
      <ul>
        <li>
          Map tiles are loaded from OpenStreetMap or our map provider, which receives your IP
          address when tiles load.
        </li>
        <li>
          If analytics are enabled, we use a cookie-less, privacy-friendly service (Plausible) that
          counts visits and anonymous events without personal profiles.
        </li>
        <li>
          Our hosting and database providers keep short-lived technical logs to run and secure the
          service.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Universal Travel and Education Consultancy itself sets no tracking cookies. Cloudflare
        Turnstile may set a strictly necessary cookie while you submit a form.
      </p>

      <h2>Your rights</h2>
      <p>
        Under the GDPR you can ask for access to, correction or deletion of personal data we hold
        about you (in practice: submissions you sent), and you can complain to a data protection
        authority. Contact: {OPERATOR.contact}.
      </p>
      <p className="text-sm text-muted">Operator: {OPERATOR.name}</p>
    </Doc>
  );
}

export function AboutPage() {
  return (
    <Doc title="About Universal Travel and Education Consultancy">
      <img
        src="/logo-full.png"
        alt="Universal Travel and Education Consultancy logo"
        width={480}
        height={488}
        className="h-auto w-64 self-start rounded-lg bg-white p-3"
      />
      <p>
        Universal Travel and Education Consultancy helps international students find master’s
        programs in Germany in any field, see on a map where admissions are open right now, keep
        track of applications and draft a Statement of Purpose.
      </p>
      <h2>Where the data comes from</h2>
      <p>
        Program details are collected from official university pages and from contributions that an
        admin checks before publishing. Every program shows when it was last verified. Universities
        change deadlines and requirements every year — always confirm on the official page before
        you apply, and{' '}
        <Link to="/contribute" className="text-primary underline">
          tell us
        </Link>{' '}
        when something is out of date.
      </p>
      <h2>Independent</h2>
      <p>
        Universal Travel and Education Consultancy is not affiliated with any university,
        uni-assist, DAAD or the German government. It is free and has no paid placements.
      </p>
      <h2>The SOP writer</h2>
      <p>
        Drafts are written by an AI model from your own answers and are a starting point to
        personalise — not a finished letter. It is designed not to invent facts: anything missing
        becomes a [placeholder] for you to fill in.
      </p>
      <p className="text-sm text-muted">
        <Link to="/privacy" className="underline">
          Privacy
        </Link>{' '}
        · Contact: {OPERATOR.contact}
      </p>
    </Doc>
  );
}
