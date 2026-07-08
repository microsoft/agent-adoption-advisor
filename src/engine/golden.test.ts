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
  // A full, sensible answer set for a light-SKU scenario. Individual helpers
  // override just the dimensions under test.
  const packagedTask = {
    job: 'automate_task',
    builder: 'business',
    grounding: 'm365',
    integration: 'surface_only',
    sensitivity: 'standard',
    governance: 'self_serve',
    extensibility: 'none',
    reach: 'individual',
    autonomy: 'assistive',
    appetite: 'configure',
  };
  const platformBuild = {
    job: 'platform',
    builder: 'engineer',
    grounding: 'custom_data',
    integration: 'custom_api',
    sensitivity: 'restricted',
    governance: 'mlops',
    extensibility: 'full',
    reach: 'external',
    autonomy: 'autonomous',
    appetite: 'invest',
  };
  const bespokeWorkflow = {
    job: 'workflow',
    builder: 'maker',
    grounding: 'saas_connectors',
    integration: 'connectors',
    sensitivity: 'standard',
    governance: 'central_alm',
    extensibility: 'some',
    reach: 'org',
    autonomy: 'semi',
    appetite: 'invest',
  };

  it('GOLDEN: recommends a packaged skill over a custom build when the task fits', () => {
    // The trust-defining case: a no-code business team with a packaged-task
    // scenario should be steered to Cowork, NOT the heavier Copilot Studio
    // build. The tool must be willing to recommend away from the heavier SKU.
    const r = score(packagedTask, content);
    expect(r.top?.approachId).toBe('cowork_skills');
    // Copilot Studio (the heavier custom build) must not win: either it ranks
    // below Cowork, or it is disqualified outright. Both prove the tool steers
    // away from over-building.
    const rankedIds = r.ranked.map((s) => s.approachId);
    const studioRank = rankedIds.indexOf('copilot_studio');
    const coworkRank = rankedIds.indexOf('cowork_skills');
    const studioDisqualified = r.disqualified.some((s) => s.approachId === 'copilot_studio');
    expect(studioDisqualified || studioRank > coworkRank).toBe(true);
  });

  it('GOLDEN: regional data residency disqualifies Cowork and Scout', () => {
    const r = score({ ...packagedTask, sensitivity: 'regulated' }, content);
    const blocked = r.disqualified.map((s) => s.approachId);
    expect(blocked).toContain('cowork_skills');
    expect(blocked).toContain('scout_skills');
    expect(r.ranked.map((s) => s.approachId)).not.toContain('cowork_skills');
  });

  it('GOLDEN: a restricted compliance posture leaves Copilot Studio as the surviving fit', () => {
    // Even a light-looking task, once the data posture is restricted, rules out
    // the M365-surface SKUs — Copilot Studio is the only approach that can meet
    // the boundary, so it must be the recommendation.
    const r = score({ ...packagedTask, sensitivity: 'restricted' }, content);
    const blocked = r.disqualified.map((s) => s.approachId);
    expect(blocked).toContain('cowork_skills');
    expect(blocked).toContain('scout_skills');
    expect(blocked).toContain('agent_builder');
    expect(r.top?.approachId).toBe('copilot_studio');
  });

  it('GOLDEN: a broad pro-code platform scenario recommends Copilot Studio', () => {
    const r = score(platformBuild, content);
    expect(r.top?.approachId).toBe('copilot_studio');
  });

  it('GOLDEN: a bespoke governed workflow recommends Copilot Studio', () => {
    const r = score(bespokeWorkflow, content);
    expect(r.top?.approachId).toBe('copilot_studio');
  });

  it('GOLDEN: a research/quick-answers job recommends the conversational entry (Agent Builder), not Scout', () => {
    // Per the Copilot Work Spectrum, "ask/quick answers" is Copilot Chat's home
    // (Agent Builder here) — NOT Scout. Scout is the always-on autonomy end.
    const r = score({ ...packagedTask, job: 'research' }, content);
    expect(r.top?.approachId).toBe('agent_builder');
    expect(r.top?.approachId).not.toBe('scout_skills');
  });

  it('GOLDEN: an always-on autonomous scenario recommends Scout', () => {
    // Scout's defining signal is autonomy=autonomous ("authorize" end of the
    // spectrum). With no competing job claim, an always-on no-code agent lands
    // on Scout over the lighter interactive/delegate SKUs.
    const { job: _job, ...noJob } = packagedTask;
    const r = score({ ...noJob, autonomy: 'autonomous' }, content);
    expect(r.top?.approachId).toBe('scout_skills');
  });

  it('GOLDEN: fully unanswered -> no clear fit, confidence none', () => {
    const r = score({}, content);
    expect(r.noClearFit).toBe(true);
    expect(r.confidence).toBe('none');
  });

  it('GOLDEN: deterministic across runs on real content', () => {
    expect(JSON.stringify(score(platformBuild, content))).toBe(
      JSON.stringify(score(platformBuild, content)),
    );
  });
});
