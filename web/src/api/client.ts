import type {
  AnalysisResult,
  BankEntry,
  CreateBankEntryInput,
  ExplanationLanguage,
} from '../types';

/**
 * Thin wrapper around the backend API.
 * In development, Vite proxies `/api` to the Express server (see vite.config.ts).
 */
const BASE = '/api';

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function analyze(
  text: string,
  context: string,
  explanationLanguage: ExplanationLanguage,
): Promise<AnalysisResult> {
  const res = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      context: context || undefined,
      explanationLanguage,
    }),
  });
  const data = await handle<{ analysis: AnalysisResult }>(res);
  return data.analysis;
}

export async function listEntries(query = ''): Promise<BankEntry[]> {
  const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const res = await fetch(`${BASE}/entries${qs}`);
  const data = await handle<{ entries: BankEntry[] }>(res);
  return data.entries;
}

export async function createEntry(input: CreateBankEntryInput): Promise<BankEntry> {
  const res = await fetch(`${BASE}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await handle<{ entry: BankEntry }>(res);
  return data.entry;
}

export async function updateEntry(
  id: string,
  patch: Partial<CreateBankEntryInput>,
): Promise<BankEntry> {
  const res = await fetch(`${BASE}/entries/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await handle<{ entry: BankEntry }>(res);
  return data.entry;
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await fetch(`${BASE}/entries/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    await handle(res);
  }
}
