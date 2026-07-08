import { describe, it, expect } from 'vitest';
import { validateContent } from './validate.js';
import type { Content } from '../engine/model.js';

function base(): Content {
  return {
    version: 't',
    lastReviewed: '2026-07-08',
    questions: [
      { id: 'q1', prompt: 'q1', options: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }] },
    ],
    approaches: [
      { id: 'alpha', name: 'A', summary: 's', pros: ['p'], cons: ['c'], whenNotToUse: 'w' },
      { id: 'beta', name: 'B', summary: 's', pros: ['p'], cons: ['c'], whenNotToUse: 'w' },
    ],
    rules: {
      confidence: { highMargin: 0.3, mediumMargin: 0.12, minFit: 0.4 },
      strongFitBonus: 10,
      disqualifiers: [],
      requiredPrereqs: [],
      strongFits: [],
      weights: [{ question: 'q1', option: 'a', approach: 'alpha', points: 5 }],
    },
  };
}

describe('validateContent', () => {
  it('passes a well-formed content object', () => {
    expect(validateContent(base())).toEqual([]);
  });

  it('flags a weight pointing at an unknown approach', () => {
    const c = base();
    c.rules.weights.push({ question: 'q1', option: 'a', approach: 'ghost', points: 1 });
    expect(validateContent(c).some((e) => e.includes('unknown approach "ghost"'))).toBe(true);
  });

  it('flags a rule pointing at an unknown option', () => {
    const c = base();
    c.rules.disqualifiers.push({ question: 'q1', option: 'zzz', approach: 'alpha', reason: 'r' });
    expect(validateContent(c).some((e) => e.includes('unknown option "zzz"'))).toBe(true);
  });

  it('flags a rule pointing at an unknown question', () => {
    const c = base();
    c.rules.strongFits.push({ question: 'nope', option: 'a', approach: 'alpha', reason: 'r' });
    expect(validateContent(c).some((e) => e.includes('unknown question "nope"'))).toBe(true);
  });

  it('flags duplicate approach ids', () => {
    const c = base();
    c.approaches.push({ id: 'alpha', name: 'dup', summary: 's', pros: ['p'], cons: ['c'], whenNotToUse: 'w' });
    expect(validateContent(c).some((e) => e.includes('duplicate approach id "alpha"'))).toBe(true);
  });

  it('flags misordered confidence thresholds', () => {
    const c = base();
    c.rules.confidence = { highMargin: 0.1, mediumMargin: 0.2, minFit: 0.4 };
    expect(validateContent(c).some((e) => e.includes('highMargin must be greater'))).toBe(true);
  });
});
