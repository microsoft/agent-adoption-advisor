import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { score } from './score.js';
import { validateContent } from '../content/validate.js';
import type { Content } from './model.js';

// Golden regression tests run against the REAL authored content, not a fixture.
// They lock in behavior an SME edit must not silently break. If a weight change
// makes the tool stop recommending the lighter option, or lets a disqualified
// approach through, one of these fails and blocks CI.
const content = parse(
  readFileSync(resolve(__dirname, '../../content/content.yaml'), 'utf8'),
  { strict: true },
) as Content;

describe('content/content.yaml — integrity', () => {
  it('has no dangling references or duplicate ids', () => {
    expect(validateContent(content)).toEqual([]);
  });

  it('stamps a version and a last-reviewed date (one-pager currency)', () => {
    expect(content.version).toMatch(/\S/);
    expect(content.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('content/content.yaml — golden scenarios', () => {
  it('GOLDEN: recommends a packaged skill over a custom build when the task fits', () => {
    // The trust-defining case: a low-appetite team with a packaged-task
    // scenario should be steered to Cowork, NOT Foundry. The tool must be
    // willing to recommend away from the heavier SKU.
    const r = score(
      { scenario: 'packaged_task', data_residency: 'none', build_appetite: 'low', control: 'managed' },
      content,
    );
    expect(r.top?.approachId).toBe('cowork_skills');
    // Foundry (the heavy custom build) must not win: either it ranks below
    // Cowork, or it is disqualified outright. Both prove the tool steers away
    // from over-building.
    const rankedIds = r.ranked.map((s) => s.approachId);
    const foundryRank = rankedIds.indexOf('foundry');
    const coworkRank = rankedIds.indexOf('cowork_skills');
    const foundryDisqualified = r.disqualified.some((s) => s.approachId === 'foundry');
    expect(foundryDisqualified || foundryRank > coworkRank).toBe(true);
  });

  it('GOLDEN: regional data residency disqualifies Cowork and Scout', () => {
    const r = score(
      { scenario: 'packaged_task', data_residency: 'regional', build_appetite: 'low', control: 'managed' },
      content,
    );
    const blocked = r.disqualified.map((s) => s.approachId);
    expect(blocked).toContain('cowork_skills');
    expect(blocked).toContain('scout_skills');
    expect(r.ranked.map((s) => s.approachId)).not.toContain('cowork_skills');
  });

  it('GOLDEN: Foundry is disqualified without pro-code control (over-built)', () => {
    const r = score(
      { scenario: 'custom_workflow', data_residency: 'none', build_appetite: 'high', control: 'managed' },
      content,
    );
    expect(r.disqualified.map((s) => s.approachId)).toContain('foundry');
  });

  it('GOLDEN: a broad pro-code platform scenario recommends Foundry', () => {
    const r = score(
      { scenario: 'broad_platform', data_residency: 'none', build_appetite: 'high', control: 'procode' },
      content,
    );
    expect(r.top?.approachId).toBe('foundry');
  });

  it('GOLDEN: fully unanswered -> no clear fit, confidence none', () => {
    const r = score({}, content);
    expect(r.noClearFit).toBe(true);
    expect(r.confidence).toBe('none');
  });

  it('GOLDEN: deterministic across runs on real content', () => {
    const ans = { scenario: 'custom_workflow', data_residency: 'none', build_appetite: 'high', control: 'procode' };
    expect(JSON.stringify(score(ans, content))).toBe(JSON.stringify(score(ans, content)));
  });
});
