import { randomUUID } from 'crypto';
import { JsonFileStore } from './jsonFileStore';

/** One saved item in the user's personal Learning Bank. */
export interface BankEntry {
  id: string;
  /** The user's original expression. */
  original: string;
  /** The improved / recommended expression (equals original when already natural). */
  improved: string;
  context?: string;
  rating?: string;
  score?: number;
  summary?: string;
  /** Personal note written by the user. */
  notes: string;
  /** Explanations saved from the analysis. */
  explanations: string[];
  /** Useful words and phrases worth reviewing. */
  vocabulary: string[];
  createdAt: string;
  updatedAt: string;
}

export type CreateBankEntry = Omit<BankEntry, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateBankEntry = Partial<Omit<BankEntry, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Repository interface for the Learning Bank.
 * The rest of the app only knows this interface, so the JSON-file
 * implementation below can later be swapped for SQLite or Postgres
 * without touching routes or the frontend.
 */
export interface LearningBankRepository {
  list(query?: string): Promise<BankEntry[]>;
  get(id: string): Promise<BankEntry | null>;
  create(input: CreateBankEntry): Promise<BankEntry>;
  update(id: string, patch: UpdateBankEntry): Promise<BankEntry | null>;
  remove(id: string): Promise<boolean>;
}

export class JsonFileLearningBankRepository implements LearningBankRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly store: JsonFileStore<BankEntry[]>) {}

  /**
   * Serializes read-modify-write operations so two concurrent requests
   * can never overwrite each other's change.
   */
  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  list(query = ''): Promise<BankEntry[]> {
    return this.runExclusive(async () => {
      const entries = await this.store.read();
      const q = query.trim().toLowerCase();
      if (!q) return [...entries].sort(byNewest);
      return entries
        .filter((e) =>
          [e.original, e.improved, e.notes, ...e.explanations, ...e.vocabulary].some((field) =>
            field.toLowerCase().includes(q),
          ),
        )
        .sort(byNewest);
    });
  }

  get(id: string): Promise<BankEntry | null> {
    return this.runExclusive(async () => {
      const entries = await this.store.read();
      return entries.find((e) => e.id === id) ?? null;
    });
  }

  create(input: CreateBankEntry): Promise<BankEntry> {
    return this.runExclusive(async () => {
      const entries = await this.store.read();
      const now = new Date().toISOString();
      const entry: BankEntry = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      entries.push(entry);
      await this.store.write(entries);
      return entry;
    });
  }

  update(id: string, patch: UpdateBankEntry): Promise<BankEntry | null> {
    return this.runExclusive(async () => {
      const entries = await this.store.read();
      const index = entries.findIndex((e) => e.id === id);
      if (index === -1) return null;
      const updated: BankEntry = {
        ...entries[index],
        ...patch,
        id,
        createdAt: entries[index].createdAt,
        updatedAt: new Date().toISOString(),
      };
      entries[index] = updated;
      await this.store.write(entries);
      return updated;
    });
  }

  remove(id: string): Promise<boolean> {
    return this.runExclusive(async () => {
      const entries = await this.store.read();
      const next = entries.filter((e) => e.id !== id);
      if (next.length === entries.length) return false;
      await this.store.write(next);
      return true;
    });
  }
}

function byNewest(a: BankEntry, b: BankEntry): number {
  return b.createdAt.localeCompare(a.createdAt);
}
