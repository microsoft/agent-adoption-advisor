import type { AnswerMap, Content } from '../engine/model.js';
import type { ScoreResult } from '../engine/score.js';
import { confidenceCopy, nextStep } from './present.js';
import { ConfidenceBadge, indexApproaches } from './result-parts.js';

interface LivePanelProps {
  content: Content;
  answers: AnswerMap;
  result: ScoreResult;
  onCreateOnePager: () => void;
  onToggleDetail: () => void;
  detailOpen: boolean;
}

function pct(fit: number): string {
  return `${Math.round(fit * 100)}%`;
}

interface Bar {
  id: string;
  name: string;
  fit: number;
  out: boolean;
}

/**
 * Right-hand live recommendation. Recomputes on every answer (the parent
 * re-scores), so the lead approach, confidence, and the per-approach fit bars
 * shift in real time as the customer answers. Sticky on desktop so it stays in
 * view while the questionnaire scrolls; the fit bars animate their width via
 * CSS so the "what changed" is felt, not just read.
 */
export function LivePanel({
  content,
  answers,
  result,
  onCreateOnePager,
  onToggleDetail,
  detailOpen,
}: LivePanelProps) {
  const approaches = indexApproaches(content);
  const total = content.questions.length;
  const answeredCount = content.questions.filter((q) => answers[q.id] != null).length;
  const anyAnswered = answeredCount > 0;
  const c = confidenceCopy(result.confidence);
  const top = result.top;
  const topApproach = top ? approaches.get(top.approachId) : undefined;

  const bars: Bar[] = [
    ...result.ranked.map((s) => ({ id: s.approachId, name: s.name, fit: s.fit, out: false })),
    ...result.disqualified.map((s) => ({ id: s.approachId, name: s.name, fit: 0, out: true })),
  ];

  return (
    <aside className="livepanel" aria-label="Live recommendation">
      <div className="livepanel__sticky">
        <p className="livepanel__eyebrow">{anyAnswered ? 'Live recommendation' : 'Recommendation'}</p>

        <div aria-live="polite">
          {!anyAnswered ? (
            <div className="livepanel__empty">
              <p className="livepanel__empty-h">Start answering</p>
              <p className="livepanel__empty-p">
                Pick an option on the left. The lead approach and the fit for every option update
                here as you go.
              </p>
            </div>
          ) : top == null || result.noClearFit ? (
            <div className="livepanel__lead livepanel__lead--none">
              <h2 className="livepanel__name">No clear fit</h2>
              <ConfidenceBadge result={result} />
              <p className="livepanel__blurb">{c.blurb}</p>
            </div>
          ) : (
            <div className="livepanel__lead">
              <div className="livepanel__headline">
                <h2 className="livepanel__name">{top.name}</h2>
                <ConfidenceBadge result={result} />
              </div>
              {topApproach && <p className="livepanel__summary">{topApproach.summary}</p>}
              <p className="livepanel__fit">Fit {pct(top.fit)}</p>
            </div>
          )}

          {anyAnswered && bars.length > 0 && (
            <ul className="fitbars" aria-label="Fit by approach">
              {bars.map((b, i) => (
                <li
                  key={b.id}
                  className={`fitbar${i === 0 && !b.out ? ' fitbar--top' : ''}${b.out ? ' fitbar--out' : ''}`}
                >
                  <span className="fitbar__name">{b.name}</span>
                  <span className="fitbar__track">
                    <span className="fitbar__fill" style={{ width: b.out ? '0%' : pct(b.fit) }} />
                  </span>
                  <span className="fitbar__val">{b.out ? 'ruled out' : pct(b.fit)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="livepanel__progress" aria-live="polite">
          {answeredCount} of {total} answered
          {answeredCount < total ? ' · answer more to sharpen' : ' · complete'}
        </p>

        {anyAnswered && <p className="livepanel__next">{nextStep(result)}</p>}

        <div className="livepanel__actions no-print">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onToggleDetail}
            aria-expanded={detailOpen}
            disabled={!anyAnswered}
          >
            {detailOpen ? 'Hide full breakdown' : 'Full breakdown'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onCreateOnePager}
            disabled={!anyAnswered}
          >
            Create one-pager
          </button>
        </div>
      </div>
    </aside>
  );
}
