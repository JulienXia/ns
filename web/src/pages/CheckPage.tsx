import { useState } from 'react';
import { analyze, createEntry } from '../api/client';
import {
  CONTEXT_PRESETS,
  GRAMMAR_META,
  NATURALNESS_META,
  type AnalysisResult,
  type ExplanationLanguage,
  type Severity,
} from '../types';

const SEVERITY_LABELS: Record<Severity, string> = {
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
};

interface Props {
  onGoToBank: () => void;
}

export default function CheckPage({ onGoToBank }: Props) {
  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const [language, setLanguage] = useState<ExplanationLanguage>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [saved, setSaved] = useState(false);

  const canAnalyze = text.trim().length > 0 && !loading;

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    try {
      const analysis = await analyze(text.trim(), context, language);
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setError(null);
    const improvements = [
      result.recommended_expression,
      result.alternatives[0]?.expression,
    ].filter((x): x is string => Boolean(x));
    try {
      await createEntry({
        original: result.original || text.trim(),
        improved: improvements[0],
        context: context || undefined,
        rating: result.naturalness,
        summary: result.overall_assessment,
        explanations: [
          result.detailed_explanation,
          ...(result.learning_takeaway ? [result.learning_takeaway] : []),
        ],
        vocabulary: [],
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    }
  }

  const meta = result ? NATURALNESS_META[result.naturalness] : null;
  const grammar = result ? GRAMMAR_META[result.grammar_status] : null;

  return (
    <div className="check-page">
      <section className="card">
        <h2>Check your English</h2>
        <p className="hint">
          Write a sentence, paragraph, or chat message. NativeSense tells you how
          natural it sounds — not just whether the grammar is correct.
        </p>

        <textarea
          className="input-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I have a technological problem on my win computer."
          rows={6}
          maxLength={5000}
        />

        <div className="controls">
          <label>
            <span className="label">Context</span>
            <select value={context} onChange={(e) => setContext(e.target.value)}>
              {CONTEXT_PRESETS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="label">Explanations in</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ExplanationLanguage)}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>

          <button className="btn-primary" onClick={handleAnalyze} disabled={!canAnalyze}>
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
      </section>

      {loading && (
        <section className="card loading-card" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Thinking like a native speaker… this can take a few seconds.</p>
        </section>
      )}

      {!loading && !result && !error && (
        <section className="card empty-card">
          <p>
            Enter something above — a phrase, a whole sentence, even a casual
            text message — and NativeSense will coach you on how a fluent speaker
            would actually say it. If it's already natural, it will say so.
          </p>
        </section>
      )}

      {!loading && result && meta && grammar && (
        <section className="card result-card" aria-live="polite">
          <div className="result-head">
            <div className={`nat-badge ${meta.className}`}>
              <span className="nat-label">{meta.label}</span>
              <span className="nat-caption">{meta.caption}</span>
            </div>
            <div className="result-summary">
              <p>{result.overall_assessment}</p>
              <p className="grammar-line">
                <span className={`gram-chip ${grammar.className}`}>{grammar.label}</span>
              </p>
            </div>
          </div>

          <div className="section">
            <h3>What you meant</h3>
            <p className="intended-meaning">{result.intended_meaning}</p>
          </div>

          {result.no_correction_needed ? (
            <div className="section">
              <div className="no-fix-box">
                <p className="no-fix-title">
                  No correction needed — your expression already works.
                </p>
                <p className="no-fix-text">{result.detailed_explanation}</p>
              </div>
            </div>
          ) : (
            <>
              {result.recommended_expression && (
                <div className="section">
                  <h3>More natural way to say it</h3>
                  <div className="recommended-box">
                    <p className="recommended-text">{result.recommended_expression}</p>
                  </div>
                </div>
              )}

              {result.issues.length > 0 && (
                <div className="section">
                  <h3>What to look at</h3>
                  {result.issues.map((issue, i) => (
                    <div key={i} className="issue-row">
                      <div className="issue-top">
                        {issue.severity && (
                          <span className={`tag tag-${issue.severity}`}>
                            {SEVERITY_LABELS[issue.severity]}
                          </span>
                        )}
                        <span className="tag tag-aspect">{issue.issue_type}</span>
                      </div>
                      <p className="issue-what">{issue.original_segment}</p>
                      <p className="issue-why">{issue.explanation}</p>
                    </div>
                  ))}
                </div>
              )}

              {result.alternatives.length > 0 && (
                <div className="section">
                  <h3>Natural alternatives</h3>
                  {result.alternatives.map((alt, i) => (
                    <div key={i} className="alt-row">
                      <p className="alt-text">{alt.expression}</p>
                      <div className="alt-meta">
                        <span className="tag tag-tone">{alt.tone}</span>
                        {alt.context && <span className="alt-contexts">{alt.context}</span>}
                      </div>
                      {alt.nuance && <p className="alt-note">{alt.nuance}</p>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="section">
            <h3>Why (the detail)</h3>
            <p className="deep-explain">{result.detailed_explanation}</p>
          </div>

          {result.regional_notes && (
            <div className="section">
              <h3>Regional notes</h3>
              <p className="deep-explain">{result.regional_notes}</p>
            </div>
          )}

          {result.learning_takeaway && (
            <div className="section">
              <h3>Takeaway</h3>
              <div className="takeaway-box">
                <p className="takeaway-text">{result.learning_takeaway}</p>
              </div>
            </div>
          )}

          <div className="save-area">
            {saved ? (
              <p className="saved-note">
                Saved to your Learning Bank.{' '}
                <button className="link-btn" onClick={onGoToBank}>
                  Open Learning Bank
                </button>
              </p>
            ) : (
              <button className="btn-secondary" onClick={handleSave}>
                Save to Learning Bank
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
