/** Rewrite one SOP section (regenerate / more specific / shorter / more formal), streamed. */
import { HttpError } from '../_shared/http.ts';
import { sopRewriteSchema } from '../_shared/sop.ts';
import { buildRewritePrompt } from '../_shared/sopText.ts';
import { envInt, loadProgramFacts, protect, serveSop, sseResponse } from '../_shared/sopAi.ts';

serveSop(async (req, body) => {
  const parsed = sopRewriteSchema.safeParse(body);
  if (!parsed.success)
    throw new HttpError(400, 'Please check your answers', parsed.error.flatten());
  await protect(
    req,
    body,
    'sop_rewrite',
    envInt('REWRITE_DAILY_LIMIT_PER_IP', 20),
    envInt('SOP_GLOBAL_DAILY_CAP', 500) * 4,
  );

  const program = await loadProgramFacts(parsed.data.programId);
  return sseResponse(req, {
    prompt: buildRewritePrompt(parsed.data, program),
    maxTokens: 2000,
    template: parsed.data.template,
    sections: [parsed.data.sectionId],
    answers: parsed.data.answers,
    logEvent: 'sop.rewrite',
  });
});
