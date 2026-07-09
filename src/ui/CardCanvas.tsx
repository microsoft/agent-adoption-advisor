import { useState } from 'react';
import type { AnswerMap, Content, Question } from '../engine/model.js';
import type { ScoreResult } from '../engine/score.js';
import { matchTier, TIER_GLYPH, TIER_LABEL, type MatchTier } from './match.js';
import { ConfidenceBadge } from './result-parts.js';
import { nextStep } from './present.js';

interface CardCanvasProps {
  content: Content;
  answers: AnswerMap;
  result: ScoreResult;
  onPlace: (questionId: string, optionId: string) => void;
  onClear: (questionId: string) => void;
  onReset: () => void;
  onCreateOnePager: () => void;
}

const DND_MIME = 'application/x-advisor-card';

function parsePayload(raw: string): { q: string; o: string } | null {
  const sep = raw.indexOf('::');
  if (sep < 0) return null;
  return { q: raw.slice(0, sep), o: raw.slice(sep + 2) };
}

/** The four-platform "type badge" shown on every card and board tile. */
function TypePips({
  content,
  questionId,
  optionId,
}: {
  content: Content;
  questionId: string;
  optionId: string;
}) {
  return (
    <span className="tcard__pips" aria-hidden="true">
      {content.approaches.map((a) => {
        const tier = matchTier(content, questionId, optionId, a.id);
        return (
          <span
            key={a.id}
            className={`tpip tpip--${tier}`}
            title={`${a.name}: ${TIER_LABEL[tier]}`}
          >
            {TIER_GLYPH[tier]}
          </span>
        );
      })}
    </span>
  );
}

/** A draggable / clickable scenario card in the tray. */
function TrayCard({
  content,
  question,
  optionId,
  label,
  onPlace,
}: {
  content: Content;
  question: Question;
  optionId: string;
  label: string;
  onPlace: (q: string, o: string) => void;
}) {
  return (
    <button
      type="button"
      className="tcard"
      draggable
      onClick={() => onPlace(question.id, optionId)}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MIME, `${question.id}::${optionId}`);
        e.dataTransfer.setData('text/plain', `${question.id}::${optionId}`);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <span className="tcard__label">{label}</span>
      <TypePips content={content} questionId={question.id} optionId={optionId} />
    </button>
  );
}

/**
 * Card-game view. Left = a tray of scenario cards grouped by dimension. Middle
 * = a board the user drags (or clicks) the cards that match their scenario
 * onto — they need not place every card. Right = a live comparison chart that
 * scores the four platforms across the placed cards, plus the recommendation
 * the pure engine derives from the very same answers.
 */
export function CardCanvas({
  content,
  answers,
  result,
  onPlace,
  onClear,
  onReset,
  onCreateOnePager,
}: CardCanvasProps) {
  const [dragOver, setDragOver] = useState(false);
  const placedCount = content.questions.filter((q) => answers[q.id] != null).length;
  const anyPlaced = placedCount > 0;
  const top = result.top;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData('text/plain');
    const parsed = parsePayload(raw);
    if (parsed) onPlace(parsed.q, parsed.o);
  };

  return (
    <div className="cards">
      <header className="cards__head">
        <div>
          <h1 className="app__title">Agent Adoption Advisor</h1>
          <p className="app__lede">
            Deal the cards that match your scenario onto the board. The comparison chart on the
            right scores Agent Builder, Cowork, Scout, and Copilot Studio live — and the engine
            calls the best fit.
          </p>
        </div>
        <p className="cards__count" aria-live="polite">
          {placedCount} / {content.questions.length} placed
        </p>
      </header>

      <div className="cards__grid">
        {/* ---- Tray ---- */}
        <section className="tray" aria-label="Scenario cards">
          <h2 className="cards__zone-title">Deck</h2>
          {content.questions.map((q) => {
            const picked = answers[q.id];
            const remaining = q.options.filter((o) => o.id !== picked);
            return (
              <div key={q.id} className="tray__group">
                <p className="tray__group-title">{q.prompt}</p>
                {picked != null ? (
                  <p className="tray__placed-note">On the board ✓</p>
                ) : (
                  <div className="tray__cards">
                    {remaining.map((o) => (
                      <TrayCard
                        key={o.id}
                        content={content}
                        question={q}
                        optionId={o.id}
                        label={o.label}
                        onPlace={onPlace}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ---- Board ---- */}
        <section
          className={`board${dragOver ? ' board--over' : ''}`}
          aria-label="Your board"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <h2 className="cards__zone-title">Your board</h2>
          {!anyPlaced ? (
            <div className="board__empty">
              <p className="board__empty-h">Drag a card here</p>
              <p className="board__empty-p">
                Or just click a card in the deck. Place the ones that describe your scenario — skip
                the ones that don’t apply.
              </p>
            </div>
          ) : (
            <ul className="board__tiles">
              {content.questions
                .filter((q) => answers[q.id] != null)
                .map((q) => {
                  const opt = q.options.find((o) => o.id === answers[q.id]);
                  if (!opt) return null;
                  return (
                    <li key={q.id} className="btile">
                      <div className="btile__body">
                        <p className="btile__group">{q.prompt}</p>
                        <p className="btile__label">{opt.label}</p>
                        <TypePips content={content} questionId={q.id} optionId={opt.id} />
                      </div>
                      <button
                        type="button"
                        className="btile__remove"
                        aria-label={`Remove ${opt.label}`}
                        onClick={() => onClear(q.id)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>

        {/* ---- Comparison chart ---- */}
        <aside className="chart" aria-label="Platform comparison">
          <div className="chart__sticky">
            <h2 className="cards__zone-title">Comparison</h2>

            <div className="chart__reco" aria-live="polite">
              {!anyPlaced ? (
                <p className="chart__reco-empty">Place a card to see the fit.</p>
              ) : top == null || result.noClearFit ? (
                <div className="chart__reco-lead chart__reco-lead--none">
                  <span className="chart__reco-name">No clear fit</span>
                  <ConfidenceBadge result={result} />
                </div>
              ) : (
                <div className="chart__reco-lead">
                  <span className="chart__reco-eyebrow">Best fit</span>
                  <div className="chart__reco-headline">
                    <span className="chart__reco-name">{top.name}</span>
                    <ConfidenceBadge result={result} />
                  </div>
                </div>
              )}
            </div>

            <div className="chart__scroll">
              <table className="matrix">
                <thead>
                  <tr>
                    <th className="matrix__corner" scope="col">
                      <span className="matrix__corner-label">Dimension</span>
                    </th>
                    {content.approaches.map((a) => (
                      <th
                        key={a.id}
                        scope="col"
                        className={`matrix__ph${top && top.approachId === a.id ? ' matrix__ph--top' : ''}`}
                      >
                        {a.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {content.questions.map((q) => {
                    const picked = answers[q.id];
                    return (
                      <tr key={q.id} className={picked == null ? 'matrix__row--empty' : ''}>
                        <th scope="row" className="matrix__dim">
                          <span className="matrix__dim-q">{q.prompt}</span>
                          {picked != null && (
                            <span className="matrix__dim-a">
                              {q.options.find((o) => o.id === picked)?.label}
                            </span>
                          )}
                        </th>
                        {content.approaches.map((a) => {
                          if (picked == null) {
                            return (
                              <td key={a.id} className="matrix__cell matrix__cell--muted">
                                ·
                              </td>
                            );
                          }
                          const tier: MatchTier = matchTier(content, q.id, picked, a.id);
                          return (
                            <td
                              key={a.id}
                              className={`matrix__cell matrix__cell--${tier}${top && top.approachId === a.id ? ' matrix__cell--top' : ''}`}
                              title={`${a.name}: ${TIER_LABEL[tier]}`}
                            >
                              {TIER_GLYPH[tier]}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="chart__legend" aria-hidden="true">
              <li>
                <span className="tpip tpip--strong">{TIER_GLYPH.strong}</span> strong
              </li>
              <li>
                <span className="tpip tpip--partial">{TIER_GLYPH.partial}</span> partial
              </li>
              <li>
                <span className="tpip tpip--none">{TIER_GLYPH.none}</span> no fit
              </li>
              <li>
                <span className="tpip tpip--blocked">{TIER_GLYPH.blocked}</span> ruled out
              </li>
            </ul>

            {anyPlaced && <p className="chart__next">{nextStep(result)}</p>}

            <div className="chart__actions no-print">
              <button type="button" className="btn btn--ghost" onClick={onReset} disabled={!anyPlaced}>
                Clear board
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={onCreateOnePager}
                disabled={!anyPlaced}
              >
                Create one-pager
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
