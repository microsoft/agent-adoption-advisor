import type { Approach, Content } from '../engine/model.js';
import type { ApproachScore, ScoreResult } from '../engine/score.js';
import { confidenceCopy, confidencePips, nextStep } from './present.js';

type ApproachIndex = Map<string, Approach>;

export function indexApproaches(content: Content): ApproachIndex {
  return new Map(content.approaches.map((a) => [a.id, a]));
}

function pct(fit: number): string {
  return `${Math.round(fit * 100)}%`;
}

/** (1) Scenario summary — echo the customer's answers back to them. */
export function ScenarioSummary({ content, answers }: { content: Content; answers: Record<string, string | undefined> }) {
  const answered = content.questions.filter((q) => answers[q.id] != null);
  if (answered.length === 0) return null;
  return (
    <section className="result-section" aria-label="Your scenario">
      <h2 className="result-section__title">Your scenario</h2>
      <dl className="scenario">
        {answered.map((q) => {
          const opt = q.options.find((o) => o.id === answers[q.id]);
          return (
            <div key={q.id} className="scenario__row">
              <dt className="scenario__q">{q.prompt}</dt>
              <dd className="scenario__a">{opt?.label ?? '—'}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** Confidence pill, reused on screen and in the one-pager. */
export function ConfidenceBadge({ result }: { result: ScoreResult }) {
  const c = confidenceCopy(result.confidence);
  const { filled, total } = confidencePips(result.confidence);
  return (
    <span className={`badge badge--${c.tone}`} title={c.blurb}>
      <span className="badge__pips" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`badge__pip badge__pip--${i < filled ? 'on' : 'off'}`} />
        ))}
      </span>
      {c.label}
    </span>
  );
}

/** (2) Primary recommendation + confidence. */
export function RecommendationCard({
  result,
  approaches,
}: {
  result: ScoreResult;
  approaches: ApproachIndex;
}) {
  const c = confidenceCopy(result.confidence);

  if (result.top == null || result.noClearFit) {
    return (
      <section className="result-section recommendation recommendation--none" aria-label="Recommendation">
        <p className="recommendation__eyebrow">Recommendation</p>
        <h2 className="recommendation__name">No clear fit</h2>
        <ConfidenceBadge result={result} />
        <p className="recommendation__summary">{c.blurb}</p>
      </section>
    );
  }

  const approach = approaches.get(result.top.approachId);
  return (
    <section className="result-section recommendation" aria-label="Recommendation">
      <p className="recommendation__eyebrow">Recommended approach</p>
      <div className="recommendation__headline">
        <h2 className="recommendation__name">{result.top.name}</h2>
        <ConfidenceBadge result={result} />
      </div>
      {approach && <p className="recommendation__summary">{approach.summary}</p>}
      <p className="recommendation__blurb">{c.blurb}</p>
      <p className="recommendation__fit">Fit {pct(result.top.fit)}</p>
    </section>
  );
}

/** (3) Ranked alternatives. */
export function Alternatives({ result }: { result: ScoreResult }) {
  const alts = result.ranked.slice(1);
  if (alts.length === 0) return null;
  return (
    <section className="result-section" aria-label="Alternatives">
      <h2 className="result-section__title">Alternatives, ranked</h2>
      <ol className="alternatives">
        {alts.map((a) => (
          <li key={a.approachId} className="alternatives__item">
            <span className="alternatives__name">{a.name}</span>
            <span className="alternatives__fit">Fit {pct(a.fit)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** (4) Pros / cons per approach — every approach the customer might weigh. */
export function ProsCons({
  result,
  approaches,
}: {
  result: ScoreResult;
  approaches: ApproachIndex;
}) {
  const shown = result.ranked;
  if (shown.length === 0) return null;
  return (
    <section className="result-section" aria-label="Pros and cons">
      <h2 className="result-section__title">Pros and cons</h2>
      <div className="proscons">
        {shown.map((s) => {
          const a = approaches.get(s.approachId);
          if (!a) return null;
          return (
            <article key={s.approachId} className="proscons__card">
              <h3 className="proscons__name">{a.name}</h3>
              <ul className="proscons__list proscons__list--pro">
                {a.pros.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <ul className="proscons__list proscons__list--con">
                {a.cons.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <p className="proscons__whennot">
                <strong>When not to use:</strong> {a.whenNotToUse}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** (5) Why this / why not the others. */
export function WhyNot({
  result,
  approaches,
}: {
  result: ScoreResult;
  approaches: ApproachIndex;
}) {
  const top = result.top;
  const whyThis =
    top && top.strongFitReasons.length > 0
      ? top.strongFitReasons.join('; ')
      : top
        ? `Best overall match for your answers (fit ${pct(top.fit)}).`
        : null;

  const others: { name: string; reason: string }[] = [];
  for (const s of result.ranked.slice(1)) {
    others.push({ name: s.name, reason: whyLower(s, approaches) });
  }
  for (const s of result.disqualified) {
    others.push({
      name: s.name,
      reason:
        s.disqualifiedReasons.length > 0
          ? `Ruled out: ${s.disqualifiedReasons.join('; ')}`
          : 'Ruled out by a hard constraint in your answers.',
    });
  }

  if (whyThis == null && others.length === 0) return null;

  return (
    <section className="result-section" aria-label="Why this recommendation">
      <h2 className="result-section__title">Why this, not the others</h2>
      {top && whyThis && (
        <p className="whynot__this">
          <strong>{top.name}:</strong> {whyThis}
        </p>
      )}
      {others.length > 0 && (
        <ul className="whynot__others">
          {others.map((o) => (
            <li key={o.name}>
              <strong>{o.name}:</strong> {o.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function whyLower(s: ApproachScore, approaches: ApproachIndex): string {
  const a = approaches.get(s.approachId);
  if (a && a.cons.length > 0) {
    return `${a.cons[0]} (fit ${pct(s.fit)}).`;
  }
  return `Scored lower for your priorities (fit ${pct(s.fit)}).`;
}

/** (6) Stated assumptions. */
export function Assumptions({ result }: { result: ScoreResult }) {
  if (result.assumptions.length === 0) return null;
  return (
    <section className="result-section" aria-label="Assumptions">
      <h2 className="result-section__title">Assumptions</h2>
      <ul className="assumptions">
        {result.assumptions.map((a, i) => (
          <li key={i}>{a}</li>
        ))}
      </ul>
    </section>
  );
}

/** (7) Suggested next step. */
export function NextStep({ result }: { result: ScoreResult }) {
  return (
    <section className="result-section next-step" aria-label="Next step">
      <h2 className="result-section__title">Suggested next step</h2>
      <p>{nextStep(result)}</p>
    </section>
  );
}
