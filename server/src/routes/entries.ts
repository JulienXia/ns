import { Router } from 'express';
import { z } from 'zod';
import type { LearningBankRepository } from '../storage/learningBankRepository';

const createBodySchema = z.object({
  original: z.string().trim().min(1, 'original is required').max(2000),
  improved: z.string().trim().min(1).max(2000).optional(),
  context: z.string().trim().max(200).optional(),
  rating: z.string().trim().max(40).optional(),
  score: z.number().min(0).max(100).optional(),
  summary: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(5000).optional(),
  explanations: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  vocabulary: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

const updateBodySchema = createBodySchema.partial();

export function createEntriesRouter(repo: LearningBankRepository): Router {
  const router = Router();

  // GET /api/entries?q=... — list all saved items, newest first, with optional search.
  router.get('/entries', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const entries = await repo.list(q);
    res.json({ entries });
  });

  // POST /api/entries — save a new item to the Learning Bank.
  router.post('/entries', async (req, res) => {
    const parsed = createBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: parsed.error.issues[0]?.message ?? 'Invalid input.',
        },
      });
      return;
    }

    const entry = await repo.create({
      original: parsed.data.original,
      improved: parsed.data.improved ?? parsed.data.original,
      context: parsed.data.context,
      rating: parsed.data.rating,
      score: parsed.data.score,
      summary: parsed.data.summary,
      notes: parsed.data.notes ?? '',
      explanations: parsed.data.explanations ?? [],
      vocabulary: parsed.data.vocabulary ?? [],
    });
    res.status(201).json({ entry });
  });

  // GET /api/entries/:id — fetch one saved item.
  router.get('/entries/:id', async (req, res) => {
    const entry = await repo.get(req.params.id);
    if (!entry) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entry not found.' } });
      return;
    }
    res.json({ entry });
  });

  // PATCH /api/entries/:id — edit notes, vocabulary, explanations, etc.
  router.patch('/entries/:id', async (req, res) => {
    const parsed = updateBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: parsed.error.issues[0]?.message ?? 'Invalid input.',
        },
      });
      return;
    }

    const entry = await repo.update(req.params.id, parsed.data);
    if (!entry) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entry not found.' } });
      return;
    }
    res.json({ entry });
  });

  // DELETE /api/entries/:id — remove a saved item.
  router.delete('/entries/:id', async (req, res) => {
    const removed = await repo.remove(req.params.id);
    if (!removed) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Entry not found.' } });
      return;
    }
    res.status(204).end();
  });

  return router;
}
