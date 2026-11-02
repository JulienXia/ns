/**
 * NativeSense evaluation dataset (v2).
 *
 * 35 sentences across the 7 categories from the product spec:
 *   A. Already natural expressions          — must NOT be rewritten
 *   B. Grammatically correct but awkward    — must be flagged, with alternatives
 *   C. Genuine grammar errors               — must be flagged as incorrect
 *   D. Casual slang and internet expressions— must be recognized as natural
 *   E. Formal and academic writing          — must be recognized as natural in context
 *   F. Expressions with regional differences— must not be called wrong; note the variety
 *   G. Sarcasm and nuanced conversational   — must be recognized, not "corrected"
 *
 * The expected fields express *our* judgment (what a good coach should say).
 * They are used by the eval script (`npm run eval`) to spot-check the model and
 * by humans reviewing the report. A model that rewrites natural English is a
 * product-quality failure — so no_correction_needed is the primary signal.
 */

export const EVAL_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type EvalCategory = (typeof EVAL_CATEGORIES)[number];

export type EvalNaturalness = 'natural' | 'mostly_natural' | 'awkward' | 'unnatural';
export type EvalGrammar = 'correct' | 'minor_errors' | 'incorrect';

export interface EvalCase {
  /** Stable id, e.g. "A1". */
  id: string;
  category: EvalCategory;
  text: string;
  /** Context passed to the AI; empty means no context given. */
  context?: string;
  expected_no_correction_needed: boolean;
  expected_naturalness: EvalNaturalness;
  expected_grammar_status: EvalGrammar;
  /** What to look for during human review of the model's explanation. */
  note: string;
}

export const EVALUATION_SET: EvalCase[] = [
  // ── A. Already natural ──────────────────────────────────────────────────
  {
    id: 'A1',
    category: 'A',
    text: "I'm running a bit late, could you grab me a coffee?",
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Fully idiomatic casual English; check the model does not "improve" it.',
  },
  {
    id: 'A2',
    category: 'A',
    text: "I'm gonna grab some food, wanna come?",
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Relaxed forms (gonna/wanna) are the point; the few-shot example.',
  },
  {
    id: 'A3',
    category: 'A',
    text: 'Thanks for the help, I really appreciate it.',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Short, warm, and natural; nothing to change.',
  },
  {
    id: 'A4',
    category: 'A',
    text: 'The meeting got moved to 3pm, just so you know.',
    context: 'Professional emails',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Natural semi-formal notice; "just so you know" is idiomatic.',
  },
  {
    id: 'A5',
    category: 'A',
    text: 'Can you send me the report when you get a chance?',
    context: 'Professional emails',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Perfectly polite professional phrasing.',
  },

  // ── B. Grammatically correct but awkward ───────────────────────────────
  {
    id: 'B1',
    category: 'B',
    text: 'I have a technological problem on my win computer.',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: false,
    expected_naturalness: 'awkward',
    expected_grammar_status: 'correct',
    note: 'The user-supplied example: word choice + collocation, not grammar.',
  },
  {
    id: 'B2',
    category: 'B',
    text: 'Let\'s do a meeting tomorrow morning.',
    context: 'Professional emails',
    expected_no_correction_needed: false,
    expected_naturalness: 'awkward',
    expected_grammar_status: 'correct',
    note: '"do a meeting" is non-native; "have a meeting" / "schedule a meeting".',
  },
  {
    id: 'B3',
    category: 'B',
    text: 'My English level is very poor, so I want to practice more.',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: false,
    expected_naturalness: 'awkward',
    expected_grammar_status: 'correct',
    note: '"level is poor" is an odd collocation; "my English is bad/not great".',
  },
  {
    id: 'B4',
    category: 'B',
    text: 'The price of the phone is expensive.',
    context: 'Online discussions (forums, comment sections)',
    expected_no_correction_needed: false,
    expected_naturalness: 'awkward',
    expected_grammar_status: 'correct',
    note: 'Prices are high, not expensive; "the phone is expensive".',
  },
  {
    id: 'B5',
    category: 'B',
    text: 'I will give you a reply as soon as possible.',
    context: 'Professional emails',
    expected_no_correction_needed: false,
    expected_naturalness: 'mostly_natural',
    expected_grammar_status: 'correct',
    note: 'Understandable but stiff; "I will get back to you as soon as possible."',
  },

  // ── C. Genuine grammar errors ──────────────────────────────────────────
  {
    id: 'C1',
    category: 'C',
    text: "He don't like coffee.",
    context: 'None given',
    expected_no_correction_needed: false,
    expected_naturalness: 'unnatural',
    expected_grammar_status: 'incorrect',
    note: 'Subject-verb agreement: he doesn\'t. The few-shot example.',
  },
  {
    id: 'C2',
    category: 'C',
    text: 'She have two cats and a dog.',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: false,
    expected_naturalness: 'unnatural',
    expected_grammar_status: 'incorrect',
    note: 'Third-person singular: she has.',
  },
  {
    id: 'C3',
    category: 'C',
    text: 'I am agree with you.',
    context: 'None given',
    expected_no_correction_needed: false,
    expected_naturalness: 'unnatural',
    expected_grammar_status: 'incorrect',
    note: '"agree" is a verb; "I agree with you."',
  },
  {
    id: 'C4',
    category: 'C',
    text: 'He go to school by bus every day.',
    context: 'None given',
    expected_no_correction_needed: false,
    expected_naturalness: 'unnatural',
    expected_grammar_status: 'incorrect',
    note: 'Third-person singular: he goes.',
  },
  {
    id: 'C5',
    category: 'C',
    text: 'Yesterday I go to the park.',
    context: 'None given',
    expected_no_correction_needed: false,
    expected_naturalness: 'unnatural',
    expected_grammar_status: 'incorrect',
    note: 'Past time marker needs past tense: I went.',
  },

  // ── D. Casual slang and internet expressions ───────────────────────────
  {
    id: 'D1',
    category: 'D',
    text: 'That movie was lit, ngl.',
    context: 'Social media posts',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Slang (lit, ngl) is natural here; must not be formalized.',
  },
  {
    id: 'D2',
    category: 'D',
    text: "I can't even right now.",
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Deliberately incomplete internet idiom; recognize it as natural.',
  },
  {
    id: 'D3',
    category: 'D',
    text: "Bruh, that's sus.",
    context: 'Online discussions (forums, comment sections)',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Slang (bruh, sus); must not be corrected into formal English.',
  },
  {
    id: 'D4',
    category: 'D',
    text: 'This video is fire, fr fr.',
    context: 'Social media posts',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Slang; the model should recognize register rather than "fix" it.',
  },
  {
    id: 'D5',
    category: 'D',
    text: "Wanna hang out later? I'm free all day.",
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Casual invitation; natural as-is.',
  },

  // ── E. Formal and academic writing ─────────────────────────────────────
  {
    id: 'E1',
    category: 'E',
    text: 'The results indicate a significant correlation between the two variables.',
    context: 'Academic writing',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Appropriately formal academic register; must not be casualized.',
  },
  {
    id: 'E2',
    category: 'E',
    text: 'This study aims to investigate the effects of sleep on memory consolidation.',
    context: 'Academic writing',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Standard academic phrasing; no correction needed in context.',
  },
  {
    id: 'E3',
    category: 'E',
    text: 'We hereby request that you provide the necessary documentation.',
    context: 'Professional emails',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Formal but appropriate for official correspondence.',
  },
  {
    id: 'E4',
    category: 'E',
    text: 'The aforementioned issues remain unresolved at the time of writing.',
    context: 'Academic writing',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Formal register is appropriate; may be flagged as formal in the note.',
  },
  {
    id: 'E5',
    category: 'E',
    text: 'It is evident from the data that further research is warranted.',
    context: 'Academic writing',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Common academic formula; natural for the register.',
  },

  // ── F. Regional differences ────────────────────────────────────────────
  {
    id: 'F1',
    category: 'F',
    text: "I'll ring you later.",
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'British: "ring" = call. Must not be marked wrong; note the AmE/BrE difference.',
  },
  {
    id: 'F2',
    category: 'F',
    text: 'The car park is full, mate.',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'BrE: car park / mate. AmE: parking lot / dude.',
  },
  {
    id: 'F3',
    category: 'F',
    text: "I've just had a cuppa.",
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'BrE colloquialism; recognize rather than correct.',
  },
  {
    id: 'F4',
    category: 'F',
    text: 'Can I get a soda?',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'AmE: soda. BrE would say soft drink / fizzy drink.',
  },
  {
    id: 'F5',
    category: 'F',
    text: "She's taking the lift to the fifth floor.",
    context: 'Professional emails',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'BrE: lift; AmE: elevator. Neither is wrong.',
  },

  // ── G. Sarcasm and nuanced conversational language ─────────────────────
  {
    id: 'G1',
    category: 'G',
    text: 'Oh great, another Monday.',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Sarcastic; the model should not "fix" the irony.',
  },
  {
    id: 'G2',
    category: 'G',
    text: "Yeah, because that's exactly what I needed.",
    context: 'Online discussions (forums, comment sections)',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Sarcastic retort; recognize the tone.',
  },
  {
    id: 'G3',
    category: 'G',
    text: 'Wow, thanks for pointing that out so helpfully.',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Irony; must not be rewritten as sincere politeness.',
  },
  {
    id: 'G4',
    category: 'G',
    text: "Sure, I'll get right on that.",
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Can be sarcastic or sincere; either way natural and uncorrected.',
  },
  {
    id: 'G5',
    category: 'G',
    text: 'My day is just going swimmingly.',
    context: 'Casual conversation with friends',
    expected_no_correction_needed: true,
    expected_naturalness: 'natural',
    expected_grammar_status: 'correct',
    note: 'Often sarcastic; "swimmingly" is unusual but correct and playful.',
  },
];

/** Look up a case by id — used by the eval runner. */
export function getEvalCase(id: string): EvalCase | undefined {
  return EVALUATION_SET.find((c) => c.id === id);
}
