/**
 * Transient-error retry helper for the evaluation runner.
 *
 * Small local models (and Ollama itself) occasionally fail with a temporary
 * HTTP 500 ("token repeat limit reached"), connection reset, or fetch error.
 * Those are infrastructure blips, not model-quality failures, so we retry the
 * whole analysis a bounded number of times with a short delay.
 *
 * Permanent errors — schema/JSON failures (AiOutputError), provider auth or
 * 4xx errors, or any non-provider error — are NOT retried: retrying them
 * would only repeat the same deterministic failure.
 */

import { AnalysisService } from '../ai/analysisService';
import { type AnalyzeInput } from '../ai/types';
import { AiProviderError } from '../ai/provider';

export const MAX_EVAL_RETRIES = 2;
export const EVAL_RETRY_DELAY_MS = 4000;

/**
 * Classifies whether an error thrown during analysis is worth retrying.
 * Only transient provider/transport errors qualify.
 */
export function isTransientProviderError(err: unknown): boolean {
  if (!(err instanceof AiProviderError)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes('http 500') ||
    m.includes('fetch failed') ||
    m.includes('econnrefused') ||
    m.includes('etimedout') ||
    m.includes('timeout') ||
    m.includes('socket hang up') ||
    m.includes('network')
  );
}

export interface RetryOutcome {
  result: Awaited<ReturnType<AnalysisService['analyze']>>;
  /** Total attempts, including the first one (>= 1). */
  attempts: number;
  /** How many retries were performed before success (0 on first try). */
  retries: number;
}

/**
 * Runs one analysis with bounded retries on transient provider errors.
 * Re-throws on permanent errors or after exhausting the retry budget.
 */
export async function analyzeWithRetries(
  service: AnalysisService,
  input: AnalyzeInput,
  opts: { maxRetries?: number; delayMs?: number } = {},
): Promise<RetryOutcome> {
  const maxRetries = opts.maxRetries ?? MAX_EVAL_RETRIES;
  const delayMs = opts.delayMs ?? EVAL_RETRY_DELAY_MS;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await service.analyze(input);
      return { result, attempts: attempt + 1, retries: attempt };
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isTransientProviderError(err)) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
