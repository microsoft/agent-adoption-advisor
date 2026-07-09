// Derive a per-cell "how well does this card fit this platform" tier for the
// card-game comparison chart. PURE: reads the same rules the scoring engine
// uses, so the chart can never disagree with the recommendation.
//
// The chart is the honest face of the tool: a ✔ is a defining fit, a ◐ is
// "workable, not its sweet spot", a ✕ is "not what this platform is for", and a
// hard-blocked cell is a compliance/prereq wall the engine also enforces.

import type { Content, QuestionId, OptionId, ApproachId } from '../engine/model.js';

export type MatchTier = 'strong' | 'partial' | 'none' | 'blocked';

export const TIER_GLYPH: Record<MatchTier, string> = {
  strong: '\u2713', // ✓
  partial: '\u25D0', // ◐
  none: '\u00D7', // ×
  blocked: '\u2298', // ⊘ (hard-blocked / ruled out)
};

export const TIER_LABEL: Record<MatchTier, string> = {
  strong: 'Strong fit',
  partial: 'Partial fit',
  none: 'Not a fit',
  blocked: 'Ruled out',
};

/**
 * Tier for one (approach, question, option) triple.
 *
 *   blocked  — a disqualifier or a wrong required-prereq answer hard-blocks it.
 *   strong   — a strong-fit rule matches, or the weight is a defining signal.
 *   partial  — some positive weight, but not the platform's home turf.
 *   none     — no signal.
 */
export function matchTier(
  content: Content,
  question: QuestionId,
  option: OptionId,
  approach: ApproachId,
): MatchTier {
  const r = content.rules;

  for (const d of r.disqualifiers) {
    if (d.approach === approach && d.question === question && d.option === option) {
      return 'blocked';
    }
  }

  // A required prereq answered with a different option also hard-blocks.
  for (const p of r.requiredPrereqs) {
    if (p.approach === approach && p.question === question && p.option !== option) {
      return 'blocked';
    }
  }

  for (const s of r.strongFits) {
    if (s.approach === approach && s.question === question && s.option === option) {
      return 'strong';
    }
  }

  let points = 0;
  for (const w of r.weights) {
    if (w.approach === approach && w.question === question && w.option === option) {
      if (w.points > points) points = w.points;
    }
  }

  if (points >= 4) return 'strong';
  if (points >= 2) return 'partial';
  return 'none';
}
