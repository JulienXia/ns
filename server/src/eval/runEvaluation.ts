/**
 * NativeSense evaluation runner (M8).
 *
 * Runs the model over the evaluation dataset and writes a reviewable report:
 *   eval/results/eval-<timestamp>.json
 *
 * Usage (from the server workspace):
 *   npm run eval                 # all 35 cases
 *   npm run eval -- --limit 10   # first 10 cases (quick spot-check)
 *   npm run eval -- --ids A1,B2,C3
 *   npm run eval -- --categories A,B
 *
 * The report compares the model's judgment against our expected labels.
 * no_correction_needed agreement is the headline signal: a coach that rewrites
 * already-natural English is a product-quality failure.
 *
 * The report is a snapshot for HUMAN review — it does not gate the build.
 * Explanations are requested in Chinese so the product owner can audit them.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnalysisService } from '../ai/analysisService';
import { createProvider } from '../ai/provider';
import { config } from '../config';
import { analyzeWithRetries } from './retry';
import { EVALUATION_SET, type EvalCase } from '../../test/fixtures/evaluation-set';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../eval/results');

interface EvalOutcome {
  id: string;
  category: string;
  text: string;
  context: string;
  expected: {
    no_correction_needed: boolean;
    naturalness: string;
    grammar_status: string;
  };
  actual: {
    no_correction_needed: boolean;
    naturalness: string;
    grammar_status: string;
    overall_assessment: string;
    detailed_explanation: string;
    recommended_expression: string | null;
  } | null;
  matches: {
    no_correction_needed: boolean;
    naturalness: boolean;
    grammar_status: boolean;
  };
  /** Total attempts including the first (1 = first-try success). */
  attempts?: number;
  /** How many transient-error retries were performed before success/failure. */
  retries?: number;
  error?: string;
}

function parseArgs(argv: string[]): { limit?: number; ids?: Set<string>; categories?: Set<string> } {
  const out: { limit?: number; ids?: Set<string>; categories?: Set<string> } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--limit') out.limit = Number(argv[i + 1]);
    if (arg === '--ids') out.ids = new Set(argv[i + 1]?.split(',').map((s) => s.trim()).filter(Boolean));
    if (arg === '--categories') {
      out.categories = new Set(argv[i + 1]?.split(',').map((s) => s.trim()).filter(Boolean));
    }
  }
  return out;
}

function selectCases(opts: ReturnType<typeof parseArgs>): EvalCase[] {
  let cases = EVALUATION_SET;
  if (opts.ids && opts.ids.size > 0) {
    cases = cases.filter((c) => opts.ids!.has(c.id));
  } else if (opts.categories && opts.categories.size > 0) {
    cases = cases.filter((c) => opts.categories!.has(c.category));
  } else if (opts.limit !== undefined) {
    cases = cases.slice(0, opts.limit);
  }
  if (cases.length === 0) {
    throw new Error('No evaluation cases matched the given filters.');
  }
  return cases;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cases = selectCases(opts);
  const provider = createProvider(config);
  const service = new AnalysisService(provider);

  console.log(
    `NativeSense eval · provider=${provider.name} model=${config.aiModel} · ${cases.length} case(s)`,
  );
  console.log('─'.repeat(72));

  const outcomes: EvalOutcome[] = [];
  for (const c of cases) {
    const expected = {
      no_correction_needed: c.expected_no_correction_needed,
      naturalness: c.expected_naturalness,
      grammar_status: c.expected_grammar_status,
    };
    const outcome: EvalOutcome = {
      id: c.id,
      category: c.category,
      text: c.text,
      context: c.context ?? '',
      expected,
      actual: null,
      matches: { no_correction_needed: false, naturalness: false, grammar_status: false },
    };
    try {
      const { result: r, attempts, retries } = await analyzeWithRetries(service, {
        text: c.text,
        context: c.context,
        explanationLanguage: 'zh',
      });
      outcome.attempts = attempts;
      outcome.retries = retries;
      outcome.actual = {
        no_correction_needed: r.no_correction_needed,
        naturalness: r.naturalness,
        grammar_status: r.grammar_status,
        overall_assessment: r.overall_assessment,
        detailed_explanation: r.detailed_explanation,
        recommended_expression: r.recommended_expression,
      };
      outcome.matches = {
        no_correction_needed: r.no_correction_needed === c.expected_no_correction_needed,
        naturalness: r.naturalness === c.expected_naturalness,
        grammar_status: r.grammar_status === c.expected_grammar_status,
      };
    } catch (err) {
      outcome.error = err instanceof Error ? err.message : String(err);
    }
    outcomes.push(outcome);

    const retryNote =
      (outcome.retries ?? 0) > 0 ? ` (retry x${outcome.retries})` : '';
    const mark = outcome.error ? 'ERR' : outcome.matches.no_correction_needed ? 'OK ' : '!! ';
    console.log(
      `${mark} ${outcome.id} [${outcome.category}] expected=${expected.naturalness}/${
        expected.no_correction_needed ? 'keep' : 'fix'
      } actual=${
        outcome.actual ? `${outcome.actual.naturalness}/${outcome.actual.no_correction_needed ? 'keep' : 'fix'}` : '—'
      }${retryNote}${outcome.error ? ` error=${outcome.error.slice(0, 120)}` : ''}`,
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `eval-${stamp}.json`);
  await writeFile(file, JSON.stringify({ meta: { provider: provider.name, model: config.aiModel, date: new Date().toISOString() }, outcomes }, null, 2), 'utf8');

  const done = outcomes.filter((o) => !o.error);
  const stats = {
    cases: outcomes.length,
    errors: outcomes.length - done.length,
    no_correction_agreement: done.filter((o) => o.matches.no_correction_needed).length / done.length,
    naturalness_exact: done.filter((o) => o.matches.naturalness).length / done.length,
    grammar_exact: done.filter((o) => o.matches.grammar_status).length / done.length,
  };
  console.log('─'.repeat(72));
  console.log(
    `no-correction agreement: ${(stats.no_correction_agreement * 100).toFixed(0)}% · ` +
      `naturalness exact: ${(stats.naturalness_exact * 100).toFixed(0)}% · ` +
      `grammar exact: ${(stats.grammar_exact * 100).toFixed(0)}% · errors: ${stats.errors}`,
  );
  console.log(`Report written to ${file}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
