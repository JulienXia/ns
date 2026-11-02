import { Router } from 'express';
import { z } from 'zod';
import { AnalysisService, AiOutputError } from '../ai/analysisService';
import { AiProviderError } from '../ai/provider';
import { EXPLANATION_LANGUAGES } from '../ai/types';

const analyzeBodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Please enter some text to analyze.')
    .max(5000, 'Text must be 5000 characters or fewer.'),
  context: z
    .string()
    .trim()
    .max(200, 'Context must be 200 characters or fewer.')
    .optional(),
  explanationLanguage: z.enum(EXPLANATION_LANGUAGES).optional(),
});

export function createAnalyzeRouter(service: AnalysisService): Router {
  const router = Router();

  router.post('/analyze', async (req, res) => {
    const parsed = analyzeBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
      });
      return;
    }

    try {
      const analysis = await service.analyze(parsed.data);
      res.json({ analysis });
    } catch (err) {
      if (err instanceof AiProviderError) {
        res.status(502).json({
          error: { code: 'AI_UNAVAILABLE', message: `The AI service is unavailable: ${err.message}` },
        });
      } else if (err instanceof AiOutputError) {
        res.status(502).json({
          error: { code: 'AI_OUTPUT_INVALID', message: err.message },
        });
      } else {
        console.error('Unexpected error during analysis:', err);
        res.status(500).json({
          error: { code: 'INTERNAL', message: 'An unexpected error occurred. Please try again.' },
        });
      }
    }
  });

  return router;
}
