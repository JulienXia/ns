import { describe, it, expect } from 'vitest';
import { AnalysisService, AiOutputError } from '../src/ai/analysisService';
import { type AiProvider, AiProviderError, type ChatMessage } from '../src/ai/provider';
import {
  analyzeWithRetries,
  isTransientProviderError,
  MAX_EVAL_RETRIES,
} from '../src/eval/retry';

const validJson = JSON.stringify({
  original: 'I have a headache.',
  intended_meaning: 'The speaker has a headache.',
  grammar_status: 'correct',
  naturalness: 'natural',
  overall_assessment: 'This is fine.',
  issues: [],
  recommended_expression: null,
  alternatives: [],
  detailed_explanation: 'Short and natural.',
  regional_notes: '',
  learning_takeaway: '',
  no_correction_needed: true,
});

/** Provider that returns canned responses/errors in order. */
class FakeProvider implements AiProvider {
  name = 'fake';
  calls = 0;
  constructor(private responses: (string | Error)[]) {}

  async chat(_messages: ChatMessage[], _options?: { temperature?: number }): Promise<string> {
    this.calls += 1;
    const next = this.responses.shift();
    if (next instanceof Error) throw next;
    if (next === undefined) throw new AiProviderError('no more canned responses');
    return next;
  }
}

describe('isTransientProviderError', () => {
  it('treats HTTP 500 as transient', () => {
    expect(
      isTransientProviderError(
        new AiProviderError('AI provider returned HTTP 500: {"error":{"message":"prediction aborted"}}'),
      ),
    ).toBe(true);
  });

  it('treats fetch failures as transient', () => {
    expect(isTransientProviderError(new AiProviderError('AI request failed: fetch failed'))).toBe(true);
  });

  it('does not retry 4xx provider errors', () => {
    expect(
      isTransientProviderError(new AiProviderError('AI provider returned HTTP 401: unauthorized')),
    ).toBe(false);
  });

  it('does not retry schema/output errors', () => {
    expect(isTransientProviderError(new AiOutputError('not valid json'))).toBe(false);
  });

  it('does not retry unrelated errors', () => {
    expect(isTransientProviderError(new Error('something else broke'))).toBe(false);
  });
});

describe('analyzeWithRetries', () => {
  it('returns first-try result without retrying', async () => {
    const provider = new FakeProvider([validJson]);
    const { result, attempts, retries } = await analyzeWithRetries(
      new AnalysisService(provider),
      { text: 'x' },
      { delayMs: 0 },
    );
    expect(result.no_correction_needed).toBe(true);
    expect(attempts).toBe(1);
    expect(retries).toBe(0);
    expect(provider.calls).toBe(1);
  });

  it('retries on a transient 500 and then succeeds', async () => {
    const provider = new FakeProvider([
      new AiProviderError('AI provider returned HTTP 500: boom'),
      validJson,
    ]);
    const { result, attempts, retries } = await analyzeWithRetries(
      new AnalysisService(provider),
      { text: 'x' },
      { delayMs: 0 },
    );
    expect(result.no_correction_needed).toBe(true);
    expect(attempts).toBe(2);
    expect(retries).toBe(1);
    expect(provider.calls).toBe(2);
  });

  it('gives up after MAX_EVAL_RETRIES transient failures', async () => {
    const provider = new FakeProvider(
      Array.from({ length: MAX_EVAL_RETRIES + 1 }, () => new AiProviderError('AI request failed: fetch failed')),
    );
    await expect(
      analyzeWithRetries(new AnalysisService(provider), { text: 'x' }, { delayMs: 0 }),
    ).rejects.toBeInstanceOf(AiProviderError);
    // 1 initial + MAX_EVAL_RETRIES retries = MAX_EVAL_RETRIES + 1 provider calls
    expect(provider.calls).toBe(MAX_EVAL_RETRIES + 1);
  });

  it('does not retry on a permanent schema error', async () => {
    // Two bad outputs: the first fails parse, the service's one corrective retry
    // also fails parse; the runner must NOT add extra retries on top of that.
    const provider = new FakeProvider(['garbage output', 'still garbage']);
    await expect(
      analyzeWithRetries(new AnalysisService(provider), { text: 'x' }, { delayMs: 0 }),
    ).rejects.toBeInstanceOf(AiOutputError);
    // 1 initial + 1 internal corrective retry = 2 provider calls; no runner retry.
    expect(provider.calls).toBe(2);
  });
});
