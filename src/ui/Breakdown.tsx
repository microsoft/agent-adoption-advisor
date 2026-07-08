import type { AnswerMap, Content } from '../engine/model.js';
import type { ScoreResult } from '../engine/score.js';
import {
  Assumptions,
  ProsCons,
  ScenarioSummary,
  WhyNot,
  indexApproaches,
} from './result-parts.js';

interface BreakdownProps {
  content: Content;
  answers: AnswerMap;
  result: ScoreResult;
}

/**
 * The detailed reasoning, revealed on demand from the live panel. Deliberately
 * omits the recommendation, ranked list, and next step — those live in the
 * always-visible LivePanel, so repeating them here would be noise. Reuses the
 * same section components as the one-pager, so screen and print never drift.
 */
export function Breakdown({ content, answers, result }: BreakdownProps) {
  const approaches = indexApproaches(content);
  return (
    <section className="breakdown" aria-label="Full breakdown">
      <ScenarioSummary content={content} answers={answers} />
      <ProsCons result={result} approaches={approaches} />
      <WhyNot result={result} approaches={approaches} />
      <Assumptions result={result} />
    </section>
  );
}
