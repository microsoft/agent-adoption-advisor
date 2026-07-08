// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import type { AnswerMap } from '../engine/model.js';
import { encodeState, STATE_SCHEMA } from '../state/encode.js';
import { loadContent } from '../test/fixture.js';
import { ExportView } from './ExportView.js';

const content = loadContent();

afterEach(cleanup);

describe('ExportView (jsdom)', () => {
  it('renders the one-pager for a valid state, stamped with version + date', () => {
    const answers: AnswerMap = { job: 'research', grounding: 'm365' };
    const state = encodeState(answers, content);

    render(<ExportView content={content} state={state} />);

    // Version + last-reviewed stamp is on the page.
    expect(
      screen.getByText(
        new RegExp(`Rules version ${content.version}.*${content.lastReviewed}`),
      ),
    ).toBeTruthy();
    // Share-includes-answers warning is present.
    expect(screen.getByText(/encodes the answers you selected/i)).toBeTruthy();
    // The scenario the customer answered is echoed.
    expect(screen.getByLabelText('Your scenario')).toBeTruthy();
  });

  it('rejects a stale link from a different content version', () => {
    const digits = '0'.repeat(content.questions.length);
    const stale = `${STATE_SCHEMA}~1999.01~${digits}`;

    render(<ExportView content={content} state={stale} />);

    expect(screen.getByText(/Cannot open this one-pager/i)).toBeTruthy();
    expect(screen.getByText(/different version of the recommendation rules/i)).toBeTruthy();
  });

  it('rejects a missing state', () => {
    render(<ExportView content={content} state={null} />);
    expect(screen.getByText(/Cannot open this one-pager/i)).toBeTruthy();
  });
});
