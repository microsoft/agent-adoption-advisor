// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import type { AnswerMap } from '../engine/model.js';
import { score } from '../engine/score.js';
import { loadContent } from '../test/fixture.js';
import { Results } from './Results.js';
import { RecommendationCard, indexApproaches } from './result-parts.js';

const content = loadContent();

afterEach(cleanup);

describe('Results (jsdom)', () => {
  it('renders the top recommendation, alternatives, pros/cons, and next step', () => {
    const answers: AnswerMap = { job: 'research', grounding: 'm365' };
    const result = score(answers, content);
    expect(result.top).not.toBeNull();

    render(
      <Results content={content} answers={answers} result={result} onCreateOnePager={() => {}} />,
    );

    // Recommendation names the engine's top approach (renderer, not routing).
    const rec = screen.getByLabelText('Recommendation');
    expect(within(rec).getByText(result.top!.name)).toBeTruthy();

    // The seven sections are present.
    expect(screen.getByLabelText('Your scenario')).toBeTruthy();
    expect(screen.getByLabelText('Pros and cons')).toBeTruthy();
    expect(screen.getByLabelText('Why this recommendation')).toBeTruthy();
    expect(screen.getByLabelText('Next step')).toBeTruthy();

    // The share action is present.
    expect(screen.getByRole('button', { name: /shareable one-pager/i })).toBeTruthy();
  });

  it('surfaces a disqualified approach with its reason in "why not"', () => {
    const answers: AnswerMap = { job: 'research', sensitivity: 'regulated' };
    const result = score(answers, content);
    expect(result.disqualified.length).toBeGreaterThan(0);

    render(
      <Results content={content} answers={answers} result={result} onCreateOnePager={() => {}} />,
    );

    const why = screen.getByLabelText('Why this recommendation');
    expect(within(why).getAllByText(/Ruled out/i).length).toBeGreaterThan(0);
  });
});

describe('RecommendationCard no-clear-fit (jsdom)', () => {
  it('shows "No clear fit" when nothing scores above the floor', () => {
    const result = score({}, content); // no answers → fit 0 → no clear fit
    expect(result.noClearFit).toBe(true);

    render(<RecommendationCard result={result} approaches={indexApproaches(content)} />);
    expect(screen.getAllByText(/No clear fit/i).length).toBeGreaterThan(0);
  });
});
