// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { matchTier } from './match.js';
import { loadContent } from '../test/fixture.js';

const content = loadContent();

describe('matchTier', () => {
  it('marks a strong-fit rule as strong', () => {
    // research is the conversational Copilot's home turf (strongFit rule).
    expect(matchTier(content, 'job', 'research', 'agent_builder')).toBe('strong');
  });

  it('marks a defining weight (>=4) as strong even without a strong-fit rule', () => {
    // grounding=m365 gives Agent Builder 4 points.
    expect(matchTier(content, 'grounding', 'm365', 'agent_builder')).toBe('strong');
  });

  it('marks a mid weight (2-3) as partial', () => {
    // grounding=m365 gives Cowork 3 points.
    expect(matchTier(content, 'grounding', 'm365', 'cowork_skills')).toBe('partial');
  });

  it('marks no signal as none', () => {
    // grounding=custom_data gives Agent Builder nothing.
    expect(matchTier(content, 'grounding', 'custom_data', 'agent_builder')).toBe('none');
  });

  it('marks a disqualifier as blocked', () => {
    // regulated data hard-blocks the M365-surface SKUs.
    expect(matchTier(content, 'sensitivity', 'regulated', 'agent_builder')).toBe('blocked');
    expect(matchTier(content, 'sensitivity', 'regulated', 'cowork_skills')).toBe('blocked');
  });

  it('blocked takes precedence over any positive weight', () => {
    // Even if a weight existed, the disqualifier wins.
    expect(matchTier(content, 'sensitivity', 'regulated', 'scout_skills')).toBe('blocked');
  });
});
