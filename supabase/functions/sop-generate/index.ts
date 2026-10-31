/** Generate a full SOP draft, streamed section by section. */
import { HttpError } from '../_shared/http.ts';
import { sopGenerateSchema, sopSectionIds, SOP_LENGTHS } from '../_shared/sop.ts';
import { buildGeneratePrompt } from '../_shared/sopText.ts';
import { envInt, loadProgramFacts, protect, serveSop, sseResponse } from '../_shared/sopAi.ts';

serveSop(async (req, body) => {
  // Validate before spending the visitor's daily allowance.
  const parsed = sopGenerateSchema.safeParse(body);
  if (!parsed.success)
    throw new HttpError(400, 'Please check your answers', parsed.error.flatten());
  await protect(
    req,
    body,
    'sop_generate',
    envInt('SOP_DAILY_LIMIT_PER_IP', 5),
    envInt('SOP_GLOBAL_DAILY_CAP', 500),
  );

  const program = await loadProgramFacts(parsed.data.programId);
  return sseResponse(req, {
    prompt: buildGeneratePrompt(parsed.data, program),
    // Roughly 2 tokens per word of prose plus headroom for markers.
    maxTokens: SOP_LENGTHS[parsed.data.length] * 3 + 1000,
    template: parsed.data.template,
    sections: sopSectionIds,
    answers: parsed.data.answers,
    logEvent: 'sop.generate',
  });
});
