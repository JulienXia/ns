import { z } from 'zod';

/**
 * Four-tier naturalness classification (replaces the old 0–100 score).
 * The AI must pick exactly one qualitative category — never a numeric score.
 */
export const NATURALNESS_LEVELS = ['natural', 'mostly_natural', 'awkward', 'unnatural'] as const;
export type Naturalness = (typeof NATURALNESS_LEVELS)[number];

/** Grammar, judged separately from naturalness. */
export const GRAMMAR_STATUSES = ['correct', 'minor_errors', 'incorrect'] as const;
export type GrammarStatus = (typeof GRAMMAR_STATUSES)[number];

export const SEVERITIES = ['minor', 'moderate', 'major'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const EXPLANATION_LANGUAGES = ['en', 'zh'] as const;
export type ExplanationLanguage = (typeof EXPLANATION_LANGUAGES)[number];

/**
 * What the AI is allowed to produce. Every analysis response is validated
 * against this schema before it reaches the client, so a bad or malformed
 * AI response can never crash the app or produce garbage on screen.
 *
 * v2: follows the "evaluate first, correct only when necessary, explain in
 * depth" pipeline — four-tier naturalness (no numeric score), explicit
 * intended meaning, a dedicated detailed explanation, regional notes, and a
 * no-correction flag that is the product's core quality gate.
 */
export const AiOutputSchema = z.object({
  /** Echo of the user's text, so the output is self-contained. */
  original: z.string().trim().min(1).max(5000),

  /** The coach's understanding of what the user is trying to say. */
  intended_meaning: z.string().trim().min(1).max(1000),

  /** Grammar, judged separately from naturalness. */
  grammar_status: z.enum(GRAMMAR_STATUSES),

  /** Four-tier naturalness for the given context. */
  naturalness: z.enum(NATURALNESS_LEVELS),

  /** 1–3 sentences of friendly, coach-style overall feedback. */
  overall_assessment: z.string().trim().min(1).max(1500),

  /** Real problems only (empty when there are none). */
  issues: z
    .array(
      z.object({
        original_segment: z.string().trim().min(1).max(500),
        issue_type: z.string().trim().max(100),
        severity: z.enum(SEVERITIES).optional(),
        explanation: z.string().trim().min(1).max(1200),
      }),
    )
    .max(8),

  /**
   * A natural rewrite of the whole text, or null when none is needed.
   * Whitespace-only is tolerated and normalized to null (small models
   * sometimes do that instead of emitting null).
   */
  recommended_expression: z.string().trim().max(2000).nullable(),

  /** 0–4 alternative phrasings (empty when the original is natural). */
  alternatives: z
    .array(
      z.object({
        expression: z.string().trim().min(1).max(500),
        tone: z.string().trim().max(100),
        context: z.string().trim().max(500),
        nuance: z.string().trim().max(1000),
      }),
    )
    .max(4),

  /** Core differentiator: the WHY behind the assessment, in accessible language. */
  detailed_explanation: z.string().trim().min(1).max(3000),

  /** Regional notes (AmE vs BrE, etc.); may be empty. */
  regional_notes: z.string().trim().max(1000),

  /** One memorable takeaway the learner can reuse; may be empty. */
  learning_takeaway: z.string().trim().max(1000),

  /** True when the original is already natural and needs no correction. */
  no_correction_needed: z.boolean(),
});

export type AnalysisResult = z.infer<typeof AiOutputSchema>;

export interface AnalyzeInput {
  text: string;
  context?: string;
  explanationLanguage?: ExplanationLanguage;
}
