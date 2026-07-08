// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import type { AnswerMap } from '../engine/model.js';
import { score } from '../engine/score.js';
import { loadContent } from '../test/fixture.js';
import { LivePanel } from './LivePanel.js';
import { Breakdown } from './Breakdown.js';
import { RecommendationCard, indexApproaches } from './result-parts.js';

const content = loadContent();

afterEach(cleanup);

function renderLivePanel(answers: AnswerMap, detailOpen = false) {
  const result = score(answers, content);
  render(
    <LivePanel
      content={content}
      answers={answers}
      result={result}
      onCreateOnePager={() => {}}
      onToggleDetail={() => {}}
      detailOpen={detailOpen}
    />,
  );
  return result;
}

describe('LivePanel (jsdom)', () => {
  it('names the top approach, shows per-approach fit bars, and the share action', () => {
    const answers: AnswerMap = { job: 'research', grounding: 'm365' };
    const result = renderLivePanel(answers);
    expect(result.top).not.toBeNull();

    const panel = screen.getByLabelText('Live recommendation');
    // The panel names the engine's top approach as the lead heading (renderer, not routing).
    expect(within(panel).getByRole('heading', { name: result.top!.name })).toBeTruthy();
    // A live fit bar list is present.
    expect(within(panel).getByLabelText('Fit by approach')).toBeTruthy();
    // Both the breakdown toggle and the one-pager action are present.
    expect(screen.getByRole('button', { name: /full breakdown/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /one-pager/i })).toBeTruthy();
  });

  it('shows an inviting empty state before any answer', () => {
    renderLivePanel({});
    expect(screen.getByText(/start answering/i)).toBeTruthy();
  });
});

describe('Breakdown (jsdom)', () => {
  it('renders scenario, pros/cons, and why-not sections', () => {
    const answers: AnswerMap = { job: 'research', grounding: 'm365' };
    const result = score(answers, content);

    render(<Breakdown content={content} answers={answers} result={result} />);

    expect(screen.getByLabelText('Your scenario')).toBeTruthy();
    expect(screen.getByLabelText('Pros and cons')).toBeTruthy();
    expect(screen.getByLabelText('Why this recommendation')).toBeTruthy();
  });

  it('surfaces a disqualified approach with its reason in "why not"', () => {
    const answers: AnswerMap = { job: 'research', sensitivity: 'regulated' };
    const result = score(answers, content);
    expect(result.disqualified.length).toBeGreaterThan(0);

    render(<Breakdown content={content} answers={answers} result={result} />);

    const why = screen.getByLabelText('Why this recommendation');
    expect(within(why).getAllByText(/Ruled out/i).length).toBeGreaterThan(0);
  });
});

describe('RecommendationCard no-clear-fit (jsdom)', () => {
  it('shows "No clear fit" when nothing scores above the floor', () => {
    const result = score({}, content); // no answers -> fit 0 -> no clear fit
    expect(result.noClearFit).toBe(true);

    render(<RecommendationCard result={result} approaches={indexApproaches(content)} />);
    expect(screen.getAllByText(/No clear fit/i).length).toBeGreaterThan(0);
  });
});
