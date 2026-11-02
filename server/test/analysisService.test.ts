import { describe, it, expect } from 'vitest';
import {
  AnalysisService,
  AiOutputError,
  extractJson,
  normalizeResult,
} from '../src/ai/analysisService';
import { type AiProvider, AiProviderError, type ChatMessage } from '../src/ai/provider';

/** A provider that plays back canned responses — never touches a real AI. */
class FakeProvider implements AiProvider {
  name = 'fake';
  constructor(private responses: (string | Error)[]) {}

  async chat(_messages: ChatMessage[], _options?: { temperature?: number }): Promise<string> {
    const next = this.responses.shift();
    if (next instanceof Error) throw next;
    if (next === undefined) throw new AiProviderError('no more canned responses');
    return next;
  }
}

/** A complete, valid v2 analysis (four-tier naturalness, no numeric score). */
const validAnalysis = {
  original: 'I have a headache.',
  intended_meaning: 'The speaker has a headache.',
  grammar_status: 'correct',
  naturalness: 'natural',
  overall_assessment: 'This is fine.',
  issues: [],
  recommended_expression: null,
  alternatives: [],
  detailed_explanation: 'Short and natural — nothing to change.',
  regional_notes: '',
  learning_takeaway: '',
  no_correction_needed: true,
};

const validJson = JSON.stringify(validAnalysis);

const service = (responses: (string | Error)[]) =>
  new AnalysisService(new FakeProvider(responses));

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson(validJson)).toEqual(validAnalysis);
  });

  it('strips markdown code fences', () => {
    expect(extractJson('```json\n' + validJson + '\n```')).toEqual(validAnalysis);
  });

  it('tolerates a leading sentence before the JSON object', () => {
    expect(extractJson('Here you go:\n' + validJson)).toEqual(validAnalysis);
  });

  it('throws on non-JSON input', () => {
    expect(() => extractJson('not json at all')).toThrow();
  });
});

describe('normalizeResult', () => {
  it('trims text fields', () => {
    const result = normalizeResult({
      ...validAnalysis,
      overall_assessment: '  Fine, with extra spaces.  ',
      learning_takeaway: '  Keep it short.  ',
    });
    expect(result.overall_assessment).toBe('Fine, with extra spaces.');
    expect(result.learning_takeaway).toBe('Keep it short.');
  });

  it('rejects output missing required fields', () => {
    expect(() => normalizeResult({ naturalness: 'natural' })).toThrow();
  });

  it('rejects an invalid naturalness level', () => {
    expect(() => normalizeResult({ ...validAnalysis, naturalness: 'perfect' })).toThrow();
  });

  it('sanitizes empty secondary fields instead of rejecting the analysis', () => {
    const messy = {
      ...validAnalysis,
      naturalness: 'awkward',
      no_correction_needed: false, // awkward → correction required; required by cross-field rule
      issues: [
        {
          original_segment: '  on my win computer  ',
          issue_type: '  ',
          severity: 'minor',
          explanation: '  "win computer" is not conventional.  ',
        },
      ],
      recommended_expression: '   ',
      alternatives: [
        { expression: '  Try this  ', tone: '', context: '  ', nuance: '' },
        { expression: 'Good one', tone: 'casual', context: 'x', nuance: 'y' },
      ],
    };
    const result = normalizeResult(messy);
    expect(result.issues[0].issue_type).toBe('general'); // default fill
    expect(result.issues[0].original_segment).toBe('on my win computer');
    expect(result.recommended_expression).toBeNull(); // whitespace → null
    expect(result.alternatives).toHaveLength(2);
    expect(result.alternatives[0].tone).toBe('neutral'); // default fill
    expect(result.alternatives[0].nuance).toBe('');
  });

  it('accepts a fix-required result with at least one issue', () => {
    const result = normalizeResult({
      ...validAnalysis,
      no_correction_needed: false,
      naturalness: 'awkward',
      issues: [
        { original_segment: 'win computer', issue_type: 'word choice', explanation: 'Say Windows PC.' },
      ],
      recommended_expression: null,
    });
    expect(result.no_correction_needed).toBe(false);
    expect(result.issues).toHaveLength(1);
  });

  it('accepts a fix-required result with only a recommended expression', () => {
    const result = normalizeResult({
      ...validAnalysis,
      no_correction_needed: false,
      naturalness: 'awkward',
      issues: [],
      recommended_expression: 'I have an issue with my Windows PC.',
    });
    expect(result.recommended_expression).toBe('I have an issue with my Windows PC.');
  });

  it('rejects fix-required output that offers no issue and no rewrite', () => {
    expect(() =>
      normalizeResult({
        ...validAnalysis,
        no_correction_needed: false,
        naturalness: 'awkward',
        issues: [],
        recommended_expression: null,
      }),
    ).toThrow(AiOutputError);
  });

  it('rejects no-correction output that still lists issues', () => {
    expect(() =>
      normalizeResult({
        ...validAnalysis,
        no_correction_needed: true,
        issues: [
          { original_segment: 'x', issue_type: 'word choice', explanation: 'should be y' },
        ],
      }),
    ).toThrow(AiOutputError);
  });

  it('rejects no-correction output that still gives a rewrite', () => {
    expect(() =>
      normalizeResult({
        ...validAnalysis,
        no_correction_needed: true,
        recommended_expression: 'A better version.',
      }),
    ).toThrow(AiOutputError);
  });

  it('allows no-correction output to keep optional stylistic alternatives', () => {
    const result = normalizeResult({
      ...validAnalysis,
      no_correction_needed: true,
      alternatives: [
        { expression: 'Fancier variant', tone: 'formal', context: 'ceremony', nuance: 'rare' },
      ],
    });
    expect(result.alternatives).toHaveLength(1);
  });
});

describe('AnalysisService.analyze', () => {
  it('returns a validated result for well-formed AI output', async () => {
    const result = await service([validJson]).analyze({ text: 'I have a headache.' });
    expect(result.naturalness).toBe('natural');
    expect(result.no_correction_needed).toBe(true);
    expect(result.grammar_status).toBe('correct');
  });

  it('retries once when the first response is unreadable', async () => {
    const result = await service(['not valid json', validJson]).analyze({
      text: 'I have a headache.',
    });
    expect(result.no_correction_needed).toBe(true);
  });

  it('throws AiOutputError when both attempts are unreadable', async () => {
    await expect(
      service(['garbage', 'more garbage']).analyze({ text: 'Hello' }),
    ).rejects.toBeInstanceOf(AiOutputError);
  });

  it('propagates provider errors', async () => {
    await expect(
      service([new AiProviderError('AI is down')]).analyze({ text: 'Hello' }),
    ).rejects.toBeInstanceOf(AiProviderError);
  });
});
