import { describe, it, expect } from 'vitest';
import type { ApproachScore, ScoreResult } from '../engine/score.js';
import { confidenceCopy, nextStep } from './present.js';

function approach(name: string): ApproachScore {
  return {
    approachId: name.toLowerCase(),
    name,
    points: 0,
    maxPossible: 10,
    fit: 0.8,
    disqualified: false,
    disqualifiedReasons: [],
    strongFit: false,
    strongFitReasons: [],
  };
}

function result(overrides: Partial<ScoreResult>): ScoreResult {
  return {
    ranked: [],
    disqualified: [],
    top: null,
    runnerUp: null,
    margin: 0,
    normalizedMargin: 0,
    confidence: 'none',
    unknownCount: 0,
    noClearFit: false,
    assumptions: [],
    tie: false,
    ...overrides,
  };
}

describe('confidenceCopy', () => {
  it('carries a label, blurb, and tone for every level', () => {
    for (const c of ['high', 'medium', 'low', 'none'] as const) {
      const copy = confidenceCopy(c);
      expect(copy.tone).toBe(c);
      expect(copy.label.length).toBeGreaterThan(0);
      expect(copy.blurb.length).toBeGreaterThan(0);
    }
  });
});

describe('nextStep', () => {
  it('steers to an expert review when there is no clear fit', () => {
    const s = nextStep(result({ noClearFit: true, confidence: 'none' }));
    expect(s).toMatch(/solution-architect/i);
  });

  it('names the top and runner-up for a low-confidence pilot', () => {
    const top = approach('Cowork');
    const runnerUp = approach('Scout');
    const s = nextStep(result({ top, runnerUp, confidence: 'low' }));
    expect(s).toMatch(/Pilot Cowork/);
    expect(s).toMatch(/compare it against Scout/);
  });

  it('is confident and forward-moving at high confidence', () => {
    const top = approach('Copilot Studio');
    const s = nextStep(result({ top, confidence: 'high' }));
    expect(s).toMatch(/Move forward with a scoped Copilot Studio pilot/);
  });

  it('appends a nudge to answer remaining questions', () => {
    const top = approach('Cowork');
    const s = nextStep(result({ top, confidence: 'high', unknownCount: 3 }));
    expect(s).toMatch(/Answer the remaining 3 questions/);
  });

  it('uses singular phrasing for one unanswered question', () => {
    const top = approach('Cowork');
    const s = nextStep(result({ top, confidence: 'high', unknownCount: 1 }));
    expect(s).toMatch(/remaining 1 question\b/);
  });
});
