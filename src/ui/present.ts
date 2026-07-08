// Pure presentation helpers: derive display strings from a ScoreResult.
//
// Kept out of the components so they are unit-testable without a DOM and so the
// screen view and the print one-pager render byte-identical copy. No JSX, no
// side effects.

import type { Confidence, ScoreResult } from '../engine/score.js';

export interface ConfidenceCopy {
  label: string;
  blurb: string;
  /** Stable slug for styling hooks / test assertions. */
  tone: Confidence;
}

const CONFIDENCE_COPY: Record<Confidence, Omit<ConfidenceCopy, 'tone'>> = {
  high: {
    label: 'High confidence',
    blurb: 'The leading approach is a clear fit and well ahead of the alternatives.',
  },
  medium: {
    label: 'Medium confidence',
    blurb: 'The leading approach fits, but a close alternative is worth weighing.',
  },
  low: {
    label: 'Low confidence',
    blurb:
      'The leading approach edges ahead, but the margin is thin — treat it as a starting point, not a verdict.',
  },
  none: {
    label: 'No clear fit',
    blurb:
      'No approach cleanly fits these answers. Revisit the constraints, or talk to a solution architect.',
  },
};

export function confidenceCopy(c: Confidence): ConfidenceCopy {
  return { ...CONFIDENCE_COPY[c], tone: c };
}

/**
 * Confidence as a neutral filled-pip scale (engineered, not stoplight-colored).
 * high = 3/3, medium = 2/3, low = 1/3, none = 0/3. Pure so the badge renders
 * byte-identical on screen and in the print one-pager.
 */
export function confidencePips(c: Confidence): { filled: number; total: number } {
  const FILLED: Record<Confidence, number> = { high: 3, medium: 2, low: 1, none: 0 };
  return { filled: FILLED[c], total: 3 };
}

/**
 * Deterministic "suggested next step". Generic on purpose — it references the
 * recommended approach by name but makes no product-specific promises the SMEs
 * haven't signed off. Mirrors the confidence banding: the weaker the fit, the
 * more it steers toward validation / expert review.
 */
export function nextStep(result: ScoreResult): string {
  const top = result.top;
  const runnerUp = result.runnerUp;

  let base: string;
  if (top == null || result.noClearFit) {
    base =
      "Book a solution-architect review — your constraints don't map cleanly to a single approach yet.";
  } else if (result.tie || result.confidence === 'low') {
    const alt = runnerUp ? ` and compare it against ${runnerUp.name}` : '';
    base = `Pilot ${top.name} on one real workflow${alt} before committing.`;
  } else if (result.confidence === 'medium') {
    const alt = runnerUp ? ` Keep ${runnerUp.name} as the fallback.` : '';
    base = `Validate ${top.name} with a scoped pilot.${alt}`;
  } else {
    base = `Move forward with a scoped ${top.name} pilot — the fit is clear.`;
  }

  if (result.unknownCount > 0) {
    const q = result.unknownCount === 1 ? 'question' : 'questions';
    base += ` Answer the remaining ${result.unknownCount} ${q} to sharpen this.`;
  }

  return base;
}
