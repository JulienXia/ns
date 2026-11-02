import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { AnalysisService } from '../src/ai/analysisService';
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

function appWith(provider: AiProvider) {
  return createApp({ analysisService: new AnalysisService(provider) });
}

describe('POST /api/analyze', () => {
  it('returns a validated analysis for valid input', async () => {
    const res = await request(appWith(new FakeProvider([JSON.stringify(validAnalysis)])))
      .post('/api/analyze')
      .send({ text: 'I have a headache.', context: 'Casual chat' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.no_correction_needed).toBe(true);
    expect(res.body.analysis.naturalness).toBe('natural');
  });

  it('rejects missing text with 400', async () => {
    const res = await request(appWith(new FakeProvider([])))
      .post('/api/analyze')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('rejects empty text with 400', async () => {
    const res = await request(appWith(new FakeProvider([])))
      .post('/api/analyze')
      .send({ text: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects text longer than 5000 characters', async () => {
    const res = await request(appWith(new FakeProvider([])))
      .post('/api/analyze')
      .send({ text: 'a'.repeat(5001) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });

  it('returns 502 AI_UNAVAILABLE when the provider fails', async () => {
    const res = await request(appWith(new FakeProvider([new AiProviderError('AI is down')])))
      .post('/api/analyze')
      .send({ text: 'Hello' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('returns 502 AI_OUTPUT_INVALID when the AI output is unreadable', async () => {
    const res = await request(appWith(new FakeProvider(['garbage', 'more garbage'])))
      .post('/api/analyze')
      .send({ text: 'Hello' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_OUTPUT_INVALID');
  });
});
