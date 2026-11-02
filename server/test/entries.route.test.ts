import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app';
import { JsonFileStore } from '../src/storage/jsonFileStore';
import {
  JsonFileLearningBankRepository,
  type BankEntry,
} from '../src/storage/learningBankRepository';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nativesense-route-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function appWithRepo() {
  const repo = new JsonFileLearningBankRepository(
    new JsonFileStore<BankEntry[]>(path.join(dir, 'entries.json'), []),
  );
  return createApp({ learningBank: repo });
}

const validBody = {
  original: 'I have a headache in my head.',
  improved: 'I have a headache.',
  context: 'Casual chat',
  rating: 'mostly_natural',
  score: 72,
  summary: 'Just a redundant phrase.',
  explanations: ['Remove "in my head".'],
  vocabulary: ['headache'],
};

describe('Learning Bank API', () => {
  it('POST /api/entries creates an entry and defaults improved to original', async () => {
    const res = await request(appWithRepo())
      .post('/api/entries')
      .send({ original: 'Hello world' });
    expect(res.status).toBe(201);
    expect(res.body.entry.improved).toBe('Hello world');
    expect(res.body.entry.notes).toBe('');
  });

  it('POST /api/entries rejects missing original', async () => {
    const res = await request(appWithRepo()).post('/api/entries').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('POST /api/entries rejects an out-of-range score', async () => {
    const res = await request(appWithRepo())
      .post('/api/entries')
      .send({ original: 'x', score: 101 });
    expect(res.status).toBe(400);
  });

  it('GET /api/entries lists and searches', async () => {
    await request(appWithRepo()).post('/api/entries').send(validBody);

    const all = await request(appWithRepo()).get('/api/entries');
    expect(all.status).toBe(200);
    expect(all.body.entries).toHaveLength(1);

    const search = await request(appWithRepo()).get('/api/entries?q=headache');
    expect(search.body.entries).toHaveLength(1);

    const miss = await request(appWithRepo()).get('/api/entries?q=zzz');
    expect(miss.body.entries).toHaveLength(0);
  });

  it('GET /api/entries/:id returns 404 for a missing entry', async () => {
    const res = await request(appWithRepo()).get('/api/entries/nope');
    expect(res.status).toBe(404);
  });

  it('PATCH /api/entries/:id updates notes', async () => {
    const created = await request(appWithRepo()).post('/api/entries').send(validBody);
    const id = created.body.entry.id;

    const patched = await request(appWithRepo())
      .patch(`/api/entries/${id}`)
      .send({ notes: 'My personal note' });
    expect(patched.status).toBe(200);
    expect(patched.body.entry.notes).toBe('My personal note');
    expect(patched.body.entry.original).toBe(validBody.original);
  });

  it('PATCH /api/entries/:id returns 404 for a missing entry', async () => {
    const res = await request(appWithRepo())
      .patch('/api/entries/nope')
      .send({ notes: 'x' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/entries/:id removes and then 404s', async () => {
    const created = await request(appWithRepo()).post('/api/entries').send(validBody);
    const id = created.body.entry.id;

    const removed = await request(appWithRepo()).delete(`/api/entries/${id}`);
    expect(removed.status).toBe(204);

    const again = await request(appWithRepo()).delete(`/api/entries/${id}`);
    expect(again.status).toBe(404);
  });
});
