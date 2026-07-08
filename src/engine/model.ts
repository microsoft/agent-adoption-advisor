// Domain model for the Agent Adoption Advisor.
//
// The scoring engine is a PURE function over (answers, content). No DOM, no
// network, no time, no randomness. Same inputs always produce byte-identical
// output. That determinism is what makes a recommendation defensible.
//
// Rule primitives (why additive points alone are not enough):
//
//   weighted points  -- soft signal, "this answer nudges toward approach X"
//   disqualifier      -- HARD block, "this answer means approach X cannot be used"
//   required_prereq   -- approach X is only valid if a specific answer is present
//   strong_fit        -- approach X is an unusually good match for this answer
//
// Without disqualifiers, five soft "nice-to-have" answers could outvote one
// hard blocker (e.g. a data-residency requirement Cowork cannot meet), and the
// tool would confidently recommend something indefensible. See eng review
// Issue 6.

export type ApproachId = string;
export type QuestionId = string;
export type OptionId = string;

/** questionId -> chosen optionId. A missing/undefined value = unanswered. */
export type AnswerMap = Record<QuestionId, OptionId | undefined>;

export interface Option {
  id: OptionId;
  label: string;
}

export interface Question {
  id: QuestionId;
  prompt: string;
  options: Option[];
}

export interface Approach {
  id: ApproachId;
  name: string;
  /** One-line positioning shown on the recommendation card. */
  summary: string;
  pros: string[];
  cons: string[];
  whenNotToUse: string;
}

export interface WeightRule {
  question: QuestionId;
  option: OptionId;
  approach: ApproachId;
  points: number;
}

export interface DisqualifierRule {
  question: QuestionId;
  option: OptionId;
  approach: ApproachId;
  reason: string;
}

/**
 * Approach is only valid when `question` is answered with `option`. If the
 * question is answered with any OTHER option, the approach is disqualified. If
 * the question is unanswered, the prereq is recorded as an assumption instead
 * of a disqualification (we do not punish missing input, we flag it).
 */
export interface RequiredPrereqRule {
  approach: ApproachId;
  question: QuestionId;
  option: OptionId;
  reason: string;
}

export interface StrongFitRule {
  question: QuestionId;
  option: OptionId;
  approach: ApproachId;
  reason: string;
}

export interface ConfidenceThresholds {
  /** Normalized margin (0..1) at/above which confidence is High. */
  highMargin: number;
  /** Normalized margin at/above which confidence is at least Medium. */
  mediumMargin: number;
  /** Absolute fit (0..1) below which the top approach is "no clear fit". */
  minFit: number;
}

export interface RulesModel {
  weights: WeightRule[];
  disqualifiers: DisqualifierRule[];
  requiredPrereqs: RequiredPrereqRule[];
  strongFits: StrongFitRule[];
  confidence: ConfidenceThresholds;
}

export interface Content {
  /** Content schema version, e.g. "2026.07". Stamped on the one-pager. */
  version: string;
  /** ISO date the content was last reviewed by an SME. */
  lastReviewed: string;
  questions: Question[];
  approaches: Approach[];
  rules: RulesModel;
}
