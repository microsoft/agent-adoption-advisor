import type {
  AnswerMap,
  ApproachId,
  Content,
  ConfidenceThresholds,
} from './model.js';

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface ApproachScore {
  approachId: ApproachId;
  name: string;
  /** Summed weighted points from answers, among non-disqualified approaches. */
  points: number;
  /** Sum of the best attainable points for this approach across all questions. */
  maxPossible: number;
  /** points / maxPossible, in [0,1]. Absolute goodness-of-fit. */
  fit: number;
  disqualified: boolean;
  disqualifiedReasons: string[];
  strongFit: boolean;
  strongFitReasons: string[];
}

export interface ScoreResult {
  /** Non-disqualified approaches, sorted by points desc, then approachId asc. */
  ranked: ApproachScore[];
  /** Disqualified approaches, with reasons, sorted by approachId asc. */
  disqualified: ApproachScore[];
  top: ApproachScore | null;
  runnerUp: ApproachScore | null;
  /** top.points - runnerUp.points; 0 when fewer than two ranked approaches. */
  margin: number;
  /** margin normalized by top.maxPossible, in [0,1]. */
  normalizedMargin: number;
  confidence: Confidence;
  /** Count of unanswered questions. */
  unknownCount: number;
  /**
   * True when no approach cleanly fits: every approach disqualified, OR the top
   * approach's absolute fit is below the configured minimum. A big margin
   * between two poor options must NOT read as high confidence (eng review
   * Issue 7).
   */
  noClearFit: boolean;
  /** Human-readable assumptions the result depends on (unknowns, prereqs). */
  assumptions: string[];
  /** True when at least one exact tie exists at the top (equal points). */
  tie: boolean;
}

/**
 * Deterministic scoring pipeline:
 *
 *   answers ─┐
 *            ├─► apply disqualifiers + required-prereqs ─► live vs. blocked set
 *   content ─┘
 *            │
 *            ├─► sum weighted points over the LIVE set only
 *            ├─► compute maxPossible per approach → absolute fit
 *            ├─► sort (points desc, id asc) → ranked
 *            ├─► margin = #1 − #2 ; normalize by maxPossible
 *            └─► confidence = f(normalizedMargin, fit, unknowns, noClearFit)
 *
 * Pure: no Date, no Math.random, no I/O. Stable ordering via approachId
 * tie-break so equal-point approaches never reorder run to run.
 */
export function score(answers: AnswerMap, content: Content): ScoreResult {
  const { approaches, questions, rules } = content;
  const answered = questions.filter((q) => answers[q.id] != null);
  const unknownCount = questions.length - answered.length;

  const assumptions: string[] = [];

  // Precompute max attainable points per approach (best option per question).
  const maxByApproach = new Map<ApproachId, number>();
  for (const a of approaches) maxByApproach.set(a.id, 0);
  for (const q of questions) {
    const bestPerApproach = new Map<ApproachId, number>();
    for (const w of rules.weights) {
      if (w.question !== q.id) continue;
      const prev = bestPerApproach.get(w.approach) ?? 0;
      if (w.points > prev) bestPerApproach.set(w.approach, w.points);
    }
    for (const [approach, best] of bestPerApproach) {
      maxByApproach.set(approach, (maxByApproach.get(approach) ?? 0) + best);
    }
  }

  const scores: ApproachScore[] = approaches.map((a) => {
    const disqualifiedReasons: string[] = [];
    const strongFitReasons: string[] = [];

    // Explicit disqualifiers: a chosen option hard-blocks this approach.
    for (const d of rules.disqualifiers) {
      if (d.approach !== a.id) continue;
      if (answers[d.question] === d.option) disqualifiedReasons.push(d.reason);
    }

    // Required prereqs: approach valid only if the required option is chosen.
    // Answered-wrong → disqualify. Unanswered → record as an assumption.
    for (const p of rules.requiredPrereqs) {
      if (p.approach !== a.id) continue;
      const given = answers[p.question];
      if (given == null) {
        assumptions.push(
          `${a.name}: assumes "${p.reason}" (unanswered — confirm before relying on this).`,
        );
      } else if (given !== p.option) {
        disqualifiedReasons.push(p.reason);
      }
    }

    // Weighted points (only meaningful if it survives disqualification).
    let points = 0;
    for (const w of rules.weights) {
      if (w.approach !== a.id) continue;
      if (answers[w.question] === w.option) points += w.points;
    }

    // Strong-fit markers.
    for (const s of rules.strongFits) {
      if (s.approach !== a.id) continue;
      if (answers[s.question] === s.option) strongFitReasons.push(s.reason);
    }

    const maxPossible = maxByApproach.get(a.id) ?? 0;
    const fit = maxPossible > 0 ? points / maxPossible : 0;

    return {
      approachId: a.id,
      name: a.name,
      points,
      maxPossible,
      fit,
      disqualified: disqualifiedReasons.length > 0,
      disqualifiedReasons,
      strongFit: strongFitReasons.length > 0,
      strongFitReasons,
    };
  });

  const ranked = scores
    .filter((s) => !s.disqualified)
    .sort((a, b) => b.points - a.points || a.approachId.localeCompare(b.approachId));
  const disqualified = scores
    .filter((s) => s.disqualified)
    .sort((a, b) => a.approachId.localeCompare(b.approachId));

  const top = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const margin = top && runnerUp ? top.points - runnerUp.points : 0;
  const normalizedMargin =
    top && top.maxPossible > 0 ? margin / top.maxPossible : 0;
  const tie = top != null && runnerUp != null && top.points === runnerUp.points;

  const noClearFit =
    top == null || top.fit < rules.confidence.minFit;

  const confidence = computeConfidence(
    { top, normalizedMargin, unknownCount, noClearFit },
    rules.confidence,
  );

  if (unknownCount > 0) {
    assumptions.push(
      `${unknownCount} question(s) unanswered — recommendation is provisional.`,
    );
  }

  return {
    ranked,
    disqualified,
    top,
    runnerUp,
    margin,
    normalizedMargin,
    confidence,
    unknownCount,
    noClearFit,
    assumptions,
    tie,
  };
}

/**
 * Confidence is NOT margin alone. A large gap between two poorly-fitting
 * options is not confidence — it is "no clear fit". We start from the margin
 * band, then downgrade for: no clear fit, low absolute fit, and unanswered
 * questions. Downgrade only, never upgrade. (Eng review Issue 7.)
 */
function computeConfidence(
  ctx: {
    top: ApproachScore | null;
    normalizedMargin: number;
    unknownCount: number;
    noClearFit: boolean;
  },
  t: ConfidenceThresholds,
): Confidence {
  if (ctx.top == null || ctx.noClearFit) return 'none';

  let level: Confidence;
  if (ctx.normalizedMargin >= t.highMargin) level = 'high';
  else if (ctx.normalizedMargin >= t.mediumMargin) level = 'medium';
  else level = 'low';

  // Downgrade one step if the top option's absolute fit is only marginally
  // above the floor (weak positive) — margin can be wide by accident.
  if (ctx.top.fit < t.minFit + (1 - t.minFit) * 0.25) level = downgrade(level);

  // Downgrade one step if two or more questions are unanswered.
  if (ctx.unknownCount >= 2) level = downgrade(level);

  return level;
}

function downgrade(c: Confidence): Confidence {
  if (c === 'high') return 'medium';
  if (c === 'medium') return 'low';
  return 'low';
}
