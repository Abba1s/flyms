/**
 * Shared pipeline for sop-generate and sop-rewrite: protections, program facts, the Claude
 * call and server-sent events. No answer or letter text is ever logged or stored.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clientIp, enforceRateLimit, verifyTurnstile } from './abuse.ts';
import { corsHeaders, HttpError, json, log, readJson } from './http.ts';
import { SOP_TEMPLATES, sectionTitle, sopSectionIds, type SopStreamEvent } from './sop.ts';
import {
  SECTION_MARKER,
  SOP_SYSTEM_PROMPT,
  SectionStreamParser,
  type ProgramFacts,
} from './sopText.ts';

export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false },
  },
);

const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5';
const EFFORT = Deno.env.get('CLAUDE_EFFORT') ?? 'medium';
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
/** Local development without an API key: a clearly-labelled template draft, no AI call. */
const MOCK = !API_KEY && Deno.env.get('SOP_MOCK') === '1';

function berlinDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

/** Bot check, global daily budget and per-visitor limit — in that order. */
export async function protect(
  req: Request,
  body: { turnstileToken?: unknown },
  bucket: string,
  perIp: number,
  globalCap: number,
) {
  const ip = clientIp(req);
  await verifyTurnstile(body.turnstileToken, ip);
  const { data } = await admin
    .from('usage_daily')
    .select('count')
    .eq('day', berlinDate())
    .eq('bucket', bucket)
    .maybeSingle();
  if ((data?.count ?? 0) >= globalCap) {
    throw new HttpError(
      429,
      'The SOP writer has reached today’s limit. Please try again tomorrow — your answers are saved.',
    );
  }
  await enforceRateLimit(admin, ip, bucket, perIp);
}

/** Program facts come from the database, never from the client. */
export async function loadProgramFacts(programId: string | null): Promise<ProgramFacts | null> {
  if (!programId) return null;
  const { data, error } = await admin
    .from('v_public_program_detail')
    .select('name, university_name, city, specializations, highlights, letter_note')
    .eq('id', programId)
    .maybeSingle();
  if (error || !data) throw new HttpError(400, 'That program is no longer available');
  return {
    name: data.name,
    university: data.university_name,
    city: data.city,
    specializations: (data.specializations as { name: string }[]).map((s) => s.name),
    highlights: (data.highlights as { text: string }[]).map((h) => h.text),
    letterNote: data.letter_note,
  };
}

export function envInt(name: string, fallback: number): number {
  const n = Number(Deno.env.get(name));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

type Emit = (event: SopStreamEvent) => void;

/** Stream Claude's output as text chunks; `onRestart` fires if a refusal fallback switches models mid-stream. */
async function streamClaude(
  prompt: string,
  maxTokens: number,
  onText: (t: string) => void,
  onRestart: () => void,
  signal: AbortSignal,
): Promise<{ stopReason: string | null; usage: unknown }> {
  if (!API_KEY) throw new HttpError(503, 'The SOP writer is not configured yet');
  const client = new Anthropic({ apiKey: API_KEY });
  // Server-side refusal fallback ("default" routing) is on by default for Opus-tier models.
  const params = {
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT },
    system: [{ type: 'text', text: SOP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt }],
  } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming;
  const stream = client.beta.messages.stream(params, { signal });
  for await (const event of stream) {
    if (
      event.type === 'content_block_start' &&
      (event.content_block.type as string) === 'fallback'
    ) {
      onRestart();
    } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onText(event.delta.text);
    }
  }
  const final = await stream.finalMessage();
  return { stopReason: final.stop_reason, usage: final.usage };
}

/** Deterministic placeholder draft for local development (SOP_MOCK=1 and no API key). */
async function mockStream(
  sectionIds: readonly string[],
  answers: Record<string, string>,
  onText: (t: string) => void,
) {
  const facts = Object.values(answers).filter(Boolean);
  for (const [i, id] of sectionIds.entries()) {
    const text = `${sectionIds.length > 1 ? `${SECTION_MARKER(id)}\n` : ''}[MOCK DRAFT — local development, no AI] ${
      facts[i % Math.max(facts.length, 1)] ?? '[add details]'
    } [add a concrete example for this section]\n`;
    for (const piece of text.match(/.{1,12}/gs) ?? []) {
      onText(piece);
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  return { stopReason: 'end_turn', usage: null };
}

/**
 * Run a generation and stream it as server-sent events.
 * `sections` = all section ids (multi-section letter) or one id (rewrite, no markers).
 */
export function sseResponse(
  req: Request,
  opts: {
    prompt: string;
    maxTokens: number;
    template: keyof typeof SOP_TEMPLATES;
    sections: readonly (typeof sopSectionIds)[number][];
    answers: Record<string, string>;
    logEvent: string;
  },
): Response {
  const template = SOP_TEMPLATES[opts.template];
  const encoder = new TextEncoder();
  const started = Date.now();

  // Stop the Claude call (and its cost) if the visitor disconnects.
  const abort = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      abort.abort();
    },
    async start(controller) {
      const emit: Emit = (e) => {
        if (!abort.signal.aborted)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      const single = opts.sections.length === 1 ? opts.sections[0]! : null;
      let parser = new SectionStreamParser();
      let sectionStarted = false;

      const onText = (t: string) => {
        if (single) {
          if (!sectionStarted) {
            emit({ type: 'section', id: single, title: sectionTitle(template, single) });
            sectionStarted = true;
          }
          emit({ type: 'delta', id: single, text: t });
          return;
        }
        for (const e of parser.feed(t)) {
          emit(
            e.type === 'section'
              ? { type: 'section', id: e.id, title: sectionTitle(template, e.id) }
              : e,
          );
        }
      };
      const onRestart = () => {
        parser = new SectionStreamParser();
        sectionStarted = false;
        emit({ type: 'restart' });
      };

      try {
        const result = MOCK
          ? await mockStream(opts.sections, opts.answers, onText)
          : await streamClaude(opts.prompt, opts.maxTokens, onText, onRestart, abort.signal);
        for (const e of single ? [] : parser.end()) {
          emit(
            e.type === 'section'
              ? { type: 'section', id: e.id, title: sectionTitle(template, e.id) }
              : e,
          );
        }
        if (result.stopReason === 'refusal') {
          emit({
            type: 'error',
            message: 'The writer could not draft this. Try rephrasing your answers.',
          });
        } else {
          emit({ type: 'done' });
        }
        log(opts.logEvent, {
          template: opts.template,
          stop_reason: result.stopReason,
          ms: Date.now() - started,
          usage: result.usage,
          mock: MOCK,
        });
      } catch (err) {
        if (abort.signal.aborted) {
          log(`${opts.logEvent}.cancelled`, { ms: Date.now() - started });
          return;
        }
        const status =
          err instanceof HttpError
            ? err.status
            : err instanceof Anthropic.RateLimitError
              ? 429
              : 502;
        const message =
          err instanceof HttpError
            ? err.message
            : status === 429
              ? 'The writer is busy. Please try again in a minute.'
              : 'The writer had a problem. Please try again.';
        log(`${opts.logEvent}.error`, {
          status,
          name: err instanceof Error ? err.name : 'unknown',
        });
        emit({ type: 'error', message, status });
      } finally {
        if (!abort.signal.aborted) controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

/** Common request handling: method, JSON body and error responses before streaming starts. */
export function serveSop(
  handler: (req: Request, body: Record<string, unknown>) => Promise<Response>,
) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
    if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);
    try {
      const body = (await readJson(req)) as Record<string, unknown>;
      return await handler(req, body);
    } catch (err) {
      if (err instanceof HttpError)
        return json(req, { error: err.message, details: err.details }, err.status);
      log('sop.unhandled', { message: String(err) });
      return json(req, { error: 'Something went wrong' }, 500);
    }
  });
}

export type { SupabaseClient };
