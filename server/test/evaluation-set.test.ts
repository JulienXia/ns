import { describe, it, expect } from 'vitest';
import {
  EVALUATION_SET,
  EVAL_CATEGORIES,
  type EvalCase,
  type EvalGrammar,
  type EvalNaturalness,
} from './fixtures/evaluation-set';

const NATURALNESS_LEVELS: EvalNaturalness[] = ['natural', 'mostly_natural', 'awkward', 'unnatural'];
const GRAMMAR_LEVELS: EvalGrammar[] = ['correct', 'minor_errors', 'incorrect'];

describe('evaluation dataset structure', () => {
  it('has at least 30 cases covering all 7 categories', () => {
    expect(EVALUATION_SET.length).toBeGreaterThanOrEqual(30);
    for (const cat of EVAL_CATEGORIES) {
      const count = EVALUATION_SET.filter((c) => c.category === cat).length;
      expect(count, `category ${cat} should have at least 4 cases`).toBeGreaterThanOrEqual(4);
    }
  });

  it('has unique, well-formed ids', () => {
    const ids = new Set<string>();
    for (const c of EVALUATION_SET) {
      expect(ids.has(c.id), `duplicate id ${c.id}`).toBe(false);
      ids.add(c.id);
      expect(c.id).toMatch(/^[A-G]\d+$/);
      expect(c.id.startsWith(c.category)).toBe(true);
    }
  });

  it('has no duplicate texts', () => {
    const texts = new Set<string>();
    for (const c of EVALUATION_SET) {
      expect(texts.has(c.text), `duplicate text: ${c.text}`).toBe(false);
      texts.add(c.text);
    }
  });

  it('uses only valid enum values and non-empty required fields', () => {
    for (const c of EVALUATION_SET) {
      expect(NATURALNESS_LEVELS).toContain(c.expected_naturalness);
      expect(GRAMMAR_LEVELS).toContain(c.expected_grammar_status);
      expect(c.text.trim().length).toBeGreaterThan(0);
      expect(c.note.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps the expectation labels internally consistent', () => {
    for (const c of EVALUATION_SET) {
      // "No correction needed" only makes sense for (at worst) mostly-natural text.
      if (c.expected_no_correction_needed) {
        expect(
          ['natural', 'mostly_natural'],
          `${c.id}: no_correction_needed=true but naturalness=${c.expected_naturalness}`,
        ).toContain(c.expected_naturalness);
        expect(c.expected_grammar_status, `${c.id}: no correction but grammar=incorrect`).not.toBe(
          'incorrect',
        );
      }
      // Real grammar errors are never "natural".
      if (c.expected_grammar_status === 'incorrect') {
        expect(['awkward', 'unnatural'], `${c.id}: incorrect grammar but natural`).toContain(
          c.expected_naturalness,
        );
      }
    }
  });
});

describe('evaluation dataset coverage', () => {
  it('covers every scenario class with the right signal distribution', () => {
    const byCategory = (cat: string) => EVALUATION_SET.filter((c) => c.category === cat);

    // A/D/E/F/G: the model must mostly say "no correction needed".
    for (const cat of ['A', 'D', 'E', 'F', 'G']) {
      const cases = byCategory(cat);
      const noCorrection = cases.filter((c) => c.expected_no_correction_needed).length;
      expect(noCorrection, `category ${cat} should be mostly no-correction`).toBeGreaterThanOrEqual(
        cases.length - 1,
      );
    }

    // B/C: the model must flag something.
    for (const cat of ['B', 'C']) {
      const cases = byCategory(cat);
      expect(
        cases.every((c) => !c.expected_no_correction_needed),
        `category ${cat} should always require correction`,
      ).toBe(true);
    }
  });

  it('has at least one case per four-tier naturalness bucket', () => {
    const levels = new Set(EVALUATION_SET.map((c) => c.expected_naturalness));
    expect(levels).toEqual(new Set(['natural', 'mostly_natural', 'awkward', 'unnatural']));
  });
});
