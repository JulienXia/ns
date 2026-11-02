import { AiOutputSchema, type AnalysisResult, type AnalyzeInput } from './types';
import { type AiProvider, AiProviderError } from './provider';
import { SYSTEM_PROMPT, buildUserMessage } from './prompts';

/** Thrown when the AI's output could not be parsed or validated as the expected JSON. */
export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiOutputError';
  }
}

/**
 * Extracts a JSON object from raw model output. Small models sometimes wrap
 * the JSON in markdown code fences or add a leading sentence, so we tolerate
 * those rather than failing outright.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  // Strip markdown code fences if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;

  // If there is stray text around the object, take the first {...} region.
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return JSON.parse(candidate.slice(start, end + 1));
  }
  return JSON.parse(candidate);
}

/**
 * Validates raw model output against the schema and normalizes it.
 * Small local models occasionally emit empty strings in secondary fields
 * (e.g. an alternative with an empty "tone" or an empty recommended_expression
 * instead of null); rather than failing the whole analysis over cosmetics,
 * we trim everything, drop empty entries, and fill sensible defaults.
 * Core fields (original, intended_meaning, overall_assessment, issue
 * segments, alternative expressions, detailed_explanation) are still
 * strictly required by the schema.
 */
/**
 * Cross-field consistency gate (v2). The model's single boolean
 * `no_correction_needed` must agree with the concrete correction it offers:
 *   - when correction IS required, it must name at least one issue OR give a
 *     recommended expression (never "this needs fixing" with no fix);
 *   - when NO correction is needed, it must not simultaneously list issues or
 *     a rewrite (contradictory instruction).
 * Alternatives are exempt: a natural sentence may still carry optional
 * stylistic variants. Violations raise AiOutputError so the service's one
 * corrective retry gives the model a chance to make the output consistent.
 */
function assertCrossFieldConsistency(result: AnalysisResult): void {
  if (!result.no_correction_needed && result.issues.length === 0 && !result.recommended_expression) {
    throw new AiOutputError(
      'Inconsistent analysis: no_correction_needed=false but neither any issue nor a recommended_expression was provided.',
    );
  }
  if (result.no_correction_needed && (result.issues.length > 0 || result.recommended_expression)) {
    throw new AiOutputError(
      'Inconsistent analysis: no_correction_needed=true but issues or a recommended_expression was provided.',
    );
  }
}

export function normalizeResult(raw: unknown): AnalysisResult {
  const parsed = AiOutputSchema.parse(raw);
  const result: AnalysisResult = {
    ...parsed,
    original: parsed.original.trim(),
    intended_meaning: parsed.intended_meaning.trim(),
    overall_assessment: parsed.overall_assessment.trim(),
    issues: parsed.issues
      .map((i) => ({
        original_segment: i.original_segment.trim(),
        issue_type: i.issue_type.trim() || 'general',
        severity: i.severity,
        explanation: i.explanation.trim(),
      }))
      .filter((i) => i.original_segment.length > 0 || i.explanation.length > 0),
    recommended_expression: parsed.recommended_expression?.trim() || null,
    alternatives: parsed.alternatives
      .map((a) => ({
        expression: a.expression.trim(),
        tone: a.tone.trim() || 'neutral',
        context: a.context.trim(),
        nuance: a.nuance.trim(),
      }))
      .filter((a) => a.expression.length > 0),
    detailed_explanation: parsed.detailed_explanation.trim(),
    regional_notes: parsed.regional_notes.trim(),
    learning_takeaway: parsed.learning_takeaway.trim(),
  };
  assertCrossFieldConsistency(result);
  return result;
}

export class AnalysisService {
  constructor(private readonly provider: AiProvider) {}

  /**
   * Runs the full analysis: sends the coach prompt + user text to the AI,
   * parses the response, validates it against the schema, and retries once
   * if the model produced unreadable output.
   */
  async analyze(input: AnalyzeInput): Promise<AnalysisResult> {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: buildUserMessage(input) },
    ];

    const raw = await this.callProvider(messages, 0.3);

    try {
      return normalizeResult(extractJson(raw));
    } catch (firstError) {
      // One corrective retry: small models occasionally wrap, truncate, or
      // drift out of the schema. Give them one explicit chance to fix it.
      try {
        const retry = await this.callProvider(
          [
            ...messages,
            { role: 'assistant' as const, content: raw },
            {
              role: 'user' as const,
              content:
                'Your previous response was not valid JSON matching the required schema. Output ONLY the JSON object again, exactly matching the schema. No explanations, no code fences.',
            },
          ],
          0.2,
        );
        return normalizeResult(extractJson(retry));
      } catch (retryError) {
        if (retryError instanceof AiOutputError || retryError instanceof AiProviderError) {
          throw retryError;
        }
        throw new AiOutputError(
          `The AI produced unreadable output: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
        );
      }
    }
  }

  private async callProvider(
    messages: Parameters<AiProvider['chat']>[0],
    temperature: number,
  ): Promise<string> {
    try {
      return await this.provider.chat(messages, { temperature });
    } catch (err) {
      if (err instanceof AiProviderError) {
        throw err;
      }
      throw new AiProviderError(
        `AI request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
