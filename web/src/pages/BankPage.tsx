import { useCallback, useEffect, useState } from 'react';
import { deleteEntry, listEntries, updateEntry } from '../api/client';
import { NATURALNESS_META, type BankEntry, type Naturalness } from '../types';

/** Renders a stored rating tag. New entries store the v2 naturalness value;
 *  very old entries may carry legacy values — show them as plain text. */
function ratingTag(rating?: string) {
  if (rating && rating in NATURALNESS_META) {
    const meta = NATURALNESS_META[rating as Naturalness];
    return <span className={`tag ${meta.className}-tag`}>{meta.label}</span>;
  }
  return rating ? <span className="tag tag-aspect">{rating}</span> : null;
}

/**
 * Learning Bank page: searchable list of saved expressions with
 * original-vs-improved display, expandable details, inline notes editing,
 * and delete.
 */
export default function BankPage({ onGoToCheck }: { onGoToCheck: () => void }) {
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError('');
    try {
      setEntries(await listEntries(q));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your Learning Bank.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + debounced search.
  useEffect(() => {
    const t = setTimeout(() => {
      void load(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, load]);

  async function handleSaveNotes(id: string) {
    setSavingId(id);
    setError('');
    try {
      const updated = await updateEntry(id, { notes: notesDraft.trim() });
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save your note.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id);
    setError('');
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setConfirmingId(null);
      if (expandedId === id) setExpandedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete this entry.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="card">
      <h2>Learning Bank</h2>
      <p className="hint">
        Your saved expressions — review the original versus the natural way to
        say it, and keep your own notes.
      </p>

      <div className="bank-search">
        <label className="label" htmlFor="bank-search">
          Search your expressions
        </label>
        <input
          id="bank-search"
          type="search"
          className="input-text bank-input"
          placeholder="e.g. headache, casual, email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-card bank-state">
          <span className="spinner" />
          <p>Loading your Learning Bank…</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-card bank-state">
          <p>
            {query.trim()
              ? 'No saved expressions match that search.'
              : 'Nothing saved yet. Analyze a sentence and save it here to build your bank.'}
          </p>
          {!query.trim() && (
            <button className="btn-secondary" onClick={onGoToCheck}>
              Analyze something first
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="bank-count">
            {entries.length} saved expression{entries.length === 1 ? '' : 's'}
          </p>
          <ul className="bank-list">
            {entries.map((entry) => (
              <li key={entry.id} className="bank-item">
                <div className="bank-item-head">
                  <div className="bank-original">
                    <span className="label">Original</span>
                    <p>{entry.original}</p>
                  </div>
                  {entry.improved && (
                    <div className="bank-improved">
                      <span className="label">
                        {entry.improved === entry.original ? 'Kept as is' : 'Improved'}
                      </span>
                      <p>{entry.improved}</p>
                    </div>
                  )}
                  <button
                    className="link-btn"
                    onClick={() =>
                      setExpandedId(expandedId === entry.id ? null : entry.id)
                    }
                  >
                    {expandedId === entry.id ? 'Hide details' : 'Show details'}
                  </button>
                </div>

                <div className="bank-item-meta">
                  {ratingTag(entry.rating)}
                  {entry.context && <span className="tag tag-tone">{entry.context}</span>}
                  {entry.notes && (
                    <span className="bank-note-preview">{entry.notes}</span>
                  )}
                </div>

                {expandedId === entry.id && (
                  <div className="bank-details">
                    {entry.summary && <p className="bank-summary">{entry.summary}</p>}
                    {entry.explanations.length > 0 && (
                      <div className="bank-block">
                        <span className="label">Explanations</span>
                        <ul>
                          {entry.explanations.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {entry.vocabulary.length > 0 && (
                      <div className="bank-block">
                        <span className="label">Vocabulary</span>
                        <div className="bank-vocab">
                          {entry.vocabulary.map((v, i) => (
                            <span key={i} className="tag tag-aspect">
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bank-item-actions">
                  {editingId === entry.id ? (
                    <div className="bank-edit">
                      <textarea
                        className="input-text bank-notes-input"
                        value={notesDraft}
                        onChange={(e) => setNotesDraft(e.target.value)}
                        placeholder="Your personal note…"
                      />
                      <div className="bank-edit-btns">
                        <button
                          className="btn-primary"
                          disabled={savingId === entry.id}
                          onClick={() => void handleSaveNotes(entry.id)}
                        >
                          {savingId === entry.id ? 'Saving…' : 'Save note'}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setEditingId(null);
                            setNotesDraft('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="link-btn"
                      onClick={() => {
                        setEditingId(entry.id);
                        setNotesDraft(entry.notes);
                      }}
                    >
                      {entry.notes ? 'Edit note' : 'Add a note'}
                    </button>
                  )}

                  {confirmingId === entry.id ? (
                    <span className="bank-confirm">
                      <span className="bank-confirm-text">Delete this entry?</span>
                      <button
                        className="link-btn danger"
                        disabled={savingId === entry.id}
                        onClick={() => void handleDelete(entry.id)}
                      >
                        {savingId === entry.id ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        className="link-btn"
                        onClick={() => setConfirmingId(null)}
                      >
                        Keep
                      </button>
                    </span>
                  ) : (
                    <button
                      className="link-btn danger"
                      onClick={() => setConfirmingId(entry.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
