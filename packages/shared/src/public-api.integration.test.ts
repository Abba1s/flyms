/**
 * Runs only when FLYMS_API_URL and FLYMS_ANON_KEY point at a Supabase instance
 * (e.g. local: `supabase start`). Checks the public views match the shared schemas.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fieldSchema, publicProgramSchema, specializationSchema } from './schemas';
import { berlinToday, getProgramStatus } from './status';

const url = process.env.FLYMS_API_URL;
const key = process.env.FLYMS_ANON_KEY;

async function get(path: string) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key!, authorization: `Bearer ${key}` },
  });
  return { status: res.status, body: (await res.json()) as unknown };
}

describe.skipIf(!url || !key)('public API (anon)', () => {
  it('serves programs matching publicProgramSchema', async () => {
    const { status, body } = await get('v_public_programs?select=*');
    expect(status).toBe(200);
    const programs = z.array(publicProgramSchema).parse(body);
    expect(programs.length).toBeGreaterThan(0);
    // Every program yields a computable status.
    const today = berlinToday();
    for (const p of programs)
      expect(getProgramStatus(p.intakes, today).status).toBeTypeOf('string');
  });

  it('serves fields and specializations', async () => {
    const fields = z.array(fieldSchema).parse((await get('fields?select=*')).body);
    const specs = z.array(specializationSchema).parse((await get('specializations?select=*')).body);
    expect(fields).toHaveLength(12);
    expect(specs.length).toBeGreaterThan(100);
  });

  it('hides moderation tables', async () => {
    const { body } = await get('change_requests?select=*');
    expect(body).toEqual([]);
  });
});
