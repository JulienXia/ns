/**
 * Frontend types — these mirror the server's API contract exactly.
 * Keeping them here means the UI and the API can never silently drift apart.
 *
 * v2: four-tier naturalness (no numeric score), explicit intended meaning,
 * a dedicated detailed explanation, regional notes, learning takeaway, and a
 * no-correction flag that drives the "no correction needed" UI state.
 */

export type Naturalness = 'natural' | 'mostly_natural' | 'awkward' | 'unnatural';
export type GrammarStatus = 'correct' | 'minor_errors' | 'incorrect';
export type Severity = 'minor' | 'moderate' | 'major';
export type ExplanationLanguage = 'en' | 'zh';

export interface AnalysisIssue {
  original_segment: string;
  issue_type: string;
  severity?: Severity;
  explanation: string;
}

export interface Alternative {
  expression: string;
  tone: string;
  context: string;
  nuance: string;
}

export interface AnalysisResult {
  original: string;
  intended_meaning: string;
  grammar_status: GrammarStatus;
  naturalness: Naturalness;
  overall_assessment: string;
  issues: AnalysisIssue[];
  recommended_expression: string | null;
  alternatives: Alternative[];
  detailed_explanation: string;
  regional_notes: string;
  learning_takeaway: string;
  no_correction_needed: boolean;
}

/** Display metadata (label + CSS class) for each of the four tiers. */
export const NATURALNESS_META: Record<Naturalness, { label: string; caption: string; className: string }> = {
  natural: { label: 'Natural', caption: 'No correction needed', className: 'nat-natural' },
  mostly_natural: { label: 'Mostly natural', caption: 'Small polish available', className: 'nat-mostly' },
  awkward: { label: 'Awkward', caption: 'Can sound more idiomatic', className: 'nat-awkward' },
  unnatural: { label: 'Unnatural', caption: 'Needs revision', className: 'nat-unnatural' },
};

export const GRAMMAR_META: Record<GrammarStatus, { label: string; className: string }> = {
  correct: { label: 'Grammatically correct', className: 'gram-correct' },
  minor_errors: { label: 'Minor grammar errors', className: 'gram-minor' },
  incorrect: { label: 'Grammar errors', className: 'gram-incorrect' },
};

/** One saved item in the user's personal Learning Bank. */
export interface BankEntry {
  id: string;
  original: string;
  improved: string;
  context?: string;
  rating?: string;
  score?: number;
  summary?: string;
  notes: string;
  explanations: string[];
  vocabulary: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankEntryInput {
  original: string;
  improved?: string;
  context?: string;
  rating?: string;
  score?: number;
  summary?: string;
  notes?: string;
  explanations?: string[];
  vocabulary?: string[];
}

/** The context presets offered in the UI (sent verbatim to the AI). */
export const CONTEXT_PRESETS = [
  { value: '', label: 'No specific context' },
  { value: 'Casual conversation with friends', label: 'Casual chat with friends' },
  { value: 'Online discussions (forums, comment sections)', label: 'Online discussions' },
  { value: 'Academic writing', label: 'Academic writing' },
  { value: 'Professional emails', label: 'Professional emails' },
  { value: 'Social media posts', label: 'Social media posts' },
] as const;
