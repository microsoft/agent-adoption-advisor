import { describe, it, expect } from 'vitest';
import { score } from './score.js';
import type { Content } from './model.js';

// Minimal deterministic fixture. Two questions, three approaches.
function fixture(): Content {
  return {
    version: 'test',
    lastReviewed: '2026-07-08',
    questions: [
      {
        id: 'q1',
        prompt: 'q1',
        options: [
          { id: 'a', label: 'a' },
          { id: 'b', label: 'b' },
        ],
      },
      {
        id: 'q2',
        prompt: 'q2',
        options: [
          { id: 'x', label: 'x' },
          { id: 'y', label: 'y' },
        ],
      },
    ],
    approaches: [
      { id: 'alpha', name: 'Alpha', summary: 's', pros: ['p'], cons: ['c'], whenNotToUse: 'w' },
      { id: 'beta', name: 'Beta', summary: 's', pros: ['p'], cons: ['c'], whenNotToUse: 'w' },
      { id: 'gamma', name: 'Gamma', summary: 's', pros: ['p'], cons: ['c'], whenNotToUse: 'w' },
    ],
    rules: {
      confidence: { highMargin: 0.3, mediumMargin: 0.12, minFit: 0.4 },
      strongFitBonus: 10,
      disqualifiers: [],
      requiredPrereqs: [],
      strongFits: [],
      weights: [
        { question: 'q1', option: 'a', approach: 'alpha', points: 5 },
        { question: 'q1', option: 'a', approach: 'beta', points: 1 },
        { question: 'q1', option: 'b', approach: 'gamma', points: 5 },
        { question: 'q2', option: 'x', approach: 'alpha', points: 5 },
        { question: 'q2', option: 'x', approach: 'beta', points: 2 },
        { question: 'q2', option: 'y', approach: 'gamma', points: 5 },
      ],
    },
  };
}

describe('score — weighting and ranking', () => {
  it('produces a clear winner with a large margin -> high confidence', () => {
    const r = score({ q1: 'a', q2: 'x' }, fixture());
    expect(r.top?.approachId).toBe('alpha');
    expect(r.top?.points).toBe(10);
    expect(r.confidence).toBe('high');
    expect(r.noClearFit).toBe(false);
  });

  it('is deterministic: same answers -> identical output', () => {
    const c = fixture();
    const a = score({ q1: 'a', q2: 'x' }, c);
    const b = score({ q1: 'a', q2: 'x' }, c);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('breaks exact ties by approachId, stably, and flags tie=true', () => {
    const c = fixture();
    // Make alpha and gamma both score 5 via disjoint answers is not possible in
    // one answer set; instead craft equal-point via a symmetric fixture.
    c.rules.weights = [
      { question: 'q1', option: 'a', approach: 'gamma', points: 5 },
      { question: 'q1', option: 'a', approach: 'alpha', points: 5 },
    ];
    const r = score({ q1: 'a' }, c);
    expect(r.tie).toBe(true);
    // alpha sorts before gamma by id
    expect(r.ranked.map((s) => s.approachId).slice(0, 2)).toEqual(['alpha', 'gamma']);
  });
});

describe('score — rule primitives', () => {
  it('disqualifier hard-blocks an approach even if it has the most points', () => {
    const c = fixture();
    c.rules.disqualifiers = [
      { question: 'q2', option: 'x', approach: 'alpha', reason: 'blocked' },
    ];
    const r = score({ q1: 'a', q2: 'x' }, c);
    expect(r.disqualified.map((s) => s.approachId)).toContain('alpha');
    expect(r.ranked.map((s) => s.approachId)).not.toContain('alpha');
    expect(r.top?.approachId).not.toBe('alpha');
  });

  it('required prereq disqualifies when the required option is answered otherwise', () => {
    const c = fixture();
    c.rules.requiredPrereqs = [
      { approach: 'alpha', question: 'q1', option: 'a', reason: 'needs a' },
    ];
    const r = score({ q1: 'b', q2: 'x' }, c);
    expect(r.disqualified.map((s) => s.approachId)).toContain('alpha');
  });

  it('required prereq becomes an assumption (not a block) when unanswered', () => {
    const c = fixture();
    c.rules.requiredPrereqs = [
      { approach: 'alpha', question: 'q1', option: 'a', reason: 'needs a' },
    ];
    const r = score({ q2: 'x' }, c);
    expect(r.disqualified.map((s) => s.approachId)).not.toContain('alpha');
    expect(r.assumptions.some((a) => a.includes('needs a'))).toBe(true);
  });

  it('strong fit is surfaced on the matching approach and boosts its score', () => {
    const c = fixture();
    c.rules.strongFits = [
      { question: 'q1', option: 'a', approach: 'alpha', reason: 'great match' },
    ];
    // Without the boost, beta would beat alpha on q1=b,q2=x? Use a case where
    // the boost is what flips the ranking: give beta more raw weight on q1=a,
    // but alpha the strong fit.
    c.rules.weights = [
      { question: 'q1', option: 'a', approach: 'beta', points: 5 },
      { question: 'q1', option: 'a', approach: 'alpha', points: 1 },
    ];
    const r = score({ q1: 'a' }, c);
    const alpha = r.ranked.find((s) => s.approachId === 'alpha');
    expect(alpha?.strongFit).toBe(true);
    expect(alpha?.strongFitReasons).toContain('great match');
    // 1 + 10 bonus = 11 beats beta's 5.
    expect(r.top?.approachId).toBe('alpha');
    expect(alpha?.fit).toBeLessThanOrEqual(1);
  });
});

describe('score — no clear fit and insufficient info', () => {
  it('all approaches disqualified -> confidence none, noClearFit true', () => {
    const c = fixture();
    c.rules.disqualifiers = c.approaches.map((a) => ({
      question: 'q1',
      option: 'a',
      approach: a.id,
      reason: 'blocked',
    }));
    const r = score({ q1: 'a' }, c);
    expect(r.ranked).toHaveLength(0);
    expect(r.confidence).toBe('none');
    expect(r.noClearFit).toBe(true);
  });

  it('low absolute fit -> noClearFit even with a positive margin', () => {
    const c = fixture();
    // Only q1=a answered: alpha gets 5 of its max 10 = 0.5 fit; beta 1/3.
    // Lower minFit floor so we instead force low fit by shrinking answered set.
    c.rules.confidence.minFit = 0.9;
    const r = score({ q1: 'a' }, c);
    expect(r.noClearFit).toBe(true);
    expect(r.confidence).toBe('none');
  });

  it('counts unanswered questions', () => {
    const r = score({ q1: 'a' }, fixture());
    expect(r.unknownCount).toBe(1);
  });
});

describe('score — confidence boundaries', () => {
  // Build a fixture where we can dial the normalized margin precisely.
  function marginFixture(topPoints: number, runnerPoints: number): Content {
    const c = fixture();
    c.rules.strongFits = [];
    c.rules.disqualifiers = [];
    c.rules.weights = [
      { question: 'q1', option: 'a', approach: 'alpha', points: topPoints },
      { question: 'q1', option: 'a', approach: 'beta', points: runnerPoints },
    ];
    // alpha maxPossible = topPoints, so normalizedMargin = (top-runner)/topPoints
    return c;
  }

  it('normalized margin exactly at highMargin -> high (before downgrades)', () => {
    // top=10, runner=7 -> margin 3, normalized 0.3 == highMargin
    const c = marginFixture(10, 7);
    c.rules.confidence.minFit = 0; // avoid fit-based downgrade
    const r = score({ q1: 'a' }, c);
    expect(r.normalizedMargin).toBeCloseTo(0.3, 5);
    expect(r.confidence).toBe('high');
  });

  it('normalized margin just below highMargin -> medium', () => {
    // top=10, runner=8 -> normalized 0.2 (>=0.12, <0.3)
    const c = marginFixture(10, 8);
    c.rules.confidence.minFit = 0;
    const r = score({ q1: 'a' }, c);
    expect(r.confidence).toBe('medium');
  });

  it('normalized margin below mediumMargin -> low', () => {
    // top=10, runner=9.5 -> normalized 0.05 (<0.12)
    const c = marginFixture(10, 9.5);
    c.rules.confidence.minFit = 0;
    const r = score({ q1: 'a' }, c);
    expect(r.confidence).toBe('low');
  });
});
