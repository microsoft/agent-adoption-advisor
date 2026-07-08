import type { AnswerMap, Content } from '../engine/model.js';
import type { ScoreResult } from '../engine/score.js';
import {
  Alternatives,
  Assumptions,
  NextStep,
  ProsCons,
  RecommendationCard,
  ScenarioSummary,
  WhyNot,
  indexApproaches,
} from './result-parts.js';

interface ResultsProps {
  content: Content;
  answers: AnswerMap;
  result: ScoreResult;
  /** Navigate to the printable one-pager for the current answers. */
  onCreateOnePager: () => void;
}

/**
 * Composes the recommendation in the design doc's fixed section order:
 *   1 scenario → 2 recommendation → 3 alternatives → 4 pros/cons →
 *   5 why-not → 6 assumptions → 7 next step.
 * Pure over (content, answers, result). The same section components render the
 * export one-pager, so screen and print never drift.
 */
export function Results({ content, answers, result, onCreateOnePager }: ResultsProps) {
  const approaches = indexApproaches(content);
  return (
    <section className="results" aria-label="Advisor recommendation">
      <ScenarioSummary content={content} answers={answers} />
      <RecommendationCard result={result} approaches={approaches} />
      <Alternatives result={result} />
      <ProsCons result={result} approaches={approaches} />
      <WhyNot result={result} approaches={approaches} />
      <Assumptions result={result} />
      <NextStep result={result} />

      <div className="results__actions no-print">
        <button type="button" className="btn btn--primary" onClick={onCreateOnePager}>
          Create shareable one-pager
        </button>
      </div>
    </section>
  );
}
