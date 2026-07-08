import type { Content } from '../engine/model.js';

/**
 * Semantic cross-reference checks the JSON Schema cannot express. Pure: takes a
 * parsed content object, returns a list of human-readable errors (empty = OK).
 * Every rule that points at a question/option/approach must resolve, and every
 * id must be unique. A dangling reference means a rule silently never fires,
 * which would ship a wrong recommendation.
 */
export function validateContent(content: Content): string[] {
  const errors: string[] = [];

  const questionIds = new Set<string>();
  const optionIds = new Map<string, Set<string>>();
  for (const q of content.questions) {
    if (questionIds.has(q.id)) errors.push(`duplicate question id "${q.id}"`);
    questionIds.add(q.id);
    const opts = new Set<string>();
    for (const o of q.options) {
      if (opts.has(o.id))
        errors.push(`duplicate option id "${o.id}" in question "${q.id}"`);
      opts.add(o.id);
    }
    optionIds.set(q.id, opts);
  }

  const approachIds = new Set<string>();
  for (const a of content.approaches) {
    if (approachIds.has(a.id)) errors.push(`duplicate approach id "${a.id}"`);
    approachIds.add(a.id);
  }

  const checkQO = (question: string, option: string, where: string) => {
    if (!questionIds.has(question)) {
      errors.push(`${where}: unknown question "${question}"`);
      return;
    }
    if (!optionIds.get(question)!.has(option)) {
      errors.push(`${where}: unknown option "${option}" for question "${question}"`);
    }
  };
  const checkApproach = (approach: string, where: string) => {
    if (!approachIds.has(approach))
      errors.push(`${where}: unknown approach "${approach}"`);
  };

  const r = content.rules;
  r.weights.forEach((w, i) => {
    checkQO(w.question, w.option, `weights[${i}]`);
    checkApproach(w.approach, `weights[${i}]`);
  });
  r.disqualifiers.forEach((d, i) => {
    checkQO(d.question, d.option, `disqualifiers[${i}]`);
    checkApproach(d.approach, `disqualifiers[${i}]`);
  });
  r.requiredPrereqs.forEach((p, i) => {
    checkQO(p.question, p.option, `requiredPrereqs[${i}]`);
    checkApproach(p.approach, `requiredPrereqs[${i}]`);
  });
  r.strongFits.forEach((s, i) => {
    checkQO(s.question, s.option, `strongFits[${i}]`);
    checkApproach(s.approach, `strongFits[${i}]`);
  });

  // Confidence thresholds must be internally ordered.
  if (r.confidence.highMargin <= r.confidence.mediumMargin) {
    errors.push('confidence.highMargin must be greater than mediumMargin');
  }

  return errors;
}
