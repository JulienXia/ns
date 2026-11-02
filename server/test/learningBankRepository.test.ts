import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { JsonFileStore } from '../src/storage/jsonFileStore';
import {
  JsonFileLearningBankRepository,
  type BankEntry,
} from '../src/storage/learningBankRepository';

let dir: string;
let repo: JsonFileLearningBankRepository;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nativesense-test-'));
  repo = new JsonFileLearningBankRepository(
    new JsonFileStore<BankEntry[]>(path.join(dir, 'entries.json'), []),
  );
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const base = {
  original: 'I have a headache in my head.',
  improved: 'I have a headache.',
  notes: '',
  explanations: ['Remove the redundant "in my head".'],
  vocabulary: ['headache'],
};

describe('JsonFileLearningBankRepository', () => {
  it('creates an entry with id and timestamps', async () => {
    const entry = await repo.create(base);
    expect(entry.id).toBeTruthy();
    expect(entry.createdAt).toBeTruthy();
    expect(entry.updatedAt).toBe(entry.createdAt);
    expect(entry.original).toBe(base.original);
  });

  it('reads the entry back from the file', async () => {
    const created = await repo.create(base);
    const found = await repo.get(created.id);
    expect(found?.improved).toBe('I have a headache.');
  });

  it('returns null for a missing id', async () => {
    expect(await repo.get('nope')).toBeNull();
  });

  it('lists newest first', async () => {
    const first = await repo.create(base);
    const second = await repo.create({ ...base, original: 'Second one' });
    const entries = await repo.list();
    expect(entries.map((e) => e.id)).toEqual([second.id, first.id]);
  });

  it('searches across original, improved, notes and vocabulary', async () => {
    await repo.create(base);
    await repo.create({
      original: 'Totally different thing',
      improved: 'Something else entirely',
      notes: '',
      explanations: ['Another note'],
      vocabulary: ['invoice'],
    });

    const byOriginal = await repo.list('headache');
    expect(byOriginal).toHaveLength(1);

    const byVocab = await repo.list('invoice');
    expect(byVocab).toHaveLength(1);

    const nothing = await repo.list('zzz');
    expect(nothing).toHaveLength(0);
  });

  it('updates fields and bumps updatedAt', async () => {
    const created = await repo.create(base);
    const updated = await repo.update(created.id, { notes: 'Review tomorrow' });
    expect(updated?.notes).toBe('Review tomorrow');
    expect(updated?.updatedAt).not.toBe(created.updatedAt);
    expect(updated?.original).toBe(created.original); // untouched field preserved
  });

  it('returns null when updating a missing id', async () => {
    expect(await repo.update('nope', { notes: 'x' })).toBeNull();
  });

  it('removes an entry and persists the deletion', async () => {
    const created = await repo.create(base);
    expect(await repo.remove(created.id)).toBe(true);
    expect(await repo.get(created.id)).toBeNull();
    expect(await repo.remove(created.id)).toBe(false);
  });

  it('survives a fresh repository instance (data persisted on disk)', async () => {
    const created = await repo.create(base);
    const freshRepo = new JsonFileLearningBankRepository(
      new JsonFileStore<BankEntry[]>(path.join(dir, 'entries.json'), []),
    );
    expect((await freshRepo.get(created.id))?.original).toBe(base.original);
  });
});
