import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { AnswerMap, Content } from '../engine/model.js';
import { encodeState, decodeState, STATE_SCHEMA } from './encode.js';

const content = parse(
  readFileSync(resolve(__dirname, '../../content/content.yaml'), 'utf8'),
  { strict: true },
) as Content;

function firstOption(qIndex: number): string {
  return content.questions[qIndex].options[0].id;
}

describe('state encoding', () => {
  it('round-trips a full answer set', () => {
    const answers: AnswerMap = {};
    for (const q of content.questions) answers[q.id] = q.options[0].id;
    const wire = encodeState(answers, content);
    const decoded = decodeState(wire, content);
    expect(decoded).toEqual({ ok: true, answers });
  });

  it('round-trips a partial answer set (unanswered stays unanswered)', () => {
    const answers: AnswerMap = { [content.questions[0].id]: firstOption(0) };
    const wire = encodeState(answers, content);
    const decoded = decodeState(wire, content);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.answers[content.questions[0].id]).toBe(firstOption(0));
      expect(Object.keys(decoded.answers)).toHaveLength(1);
    }
  });

  it('embeds the state schema tag and content version', () => {
    const wire = encodeState({}, content);
    expect(wire.startsWith(`${STATE_SCHEMA}~${content.version}~`)).toBe(true);
  });

  it('is deterministic — same answers produce the same string', () => {
    const answers: AnswerMap = { [content.questions[1].id]: firstOption(1) };
    expect(encodeState(answers, content)).toBe(encodeState(answers, content));
  });

  it('rejects an empty state', () => {
    expect(decodeState('', content)).toEqual({ ok: false, reason: 'empty' });
    expect(decodeState(null, content)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a malformed state', () => {
    expect(decodeState('garbage', content)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects an unknown schema tag', () => {
    const digits = '0'.repeat(content.questions.length);
    expect(decodeState(`s9~${content.version}~${digits}`, content)).toEqual({
      ok: false,
      reason: 'unknown-schema',
    });
  });

  it('rejects a mismatched content version (stale link)', () => {
    const digits = '0'.repeat(content.questions.length);
    expect(decodeState(`${STATE_SCHEMA}~1999.01~${digits}`, content)).toEqual({
      ok: false,
      reason: 'version-mismatch',
    });
  });

  it('rejects the wrong number of digits', () => {
    const short = '0'.repeat(content.questions.length - 1);
    expect(decodeState(`${STATE_SCHEMA}~${content.version}~${short}`, content)).toEqual({
      ok: false,
      reason: 'length-mismatch',
    });
  });

  it('rejects an option index out of range', () => {
    // First question with fewer than 9 options: pick an index past its end.
    const q0 = content.questions[0];
    const bad = String(q0.options.length + 1) + '0'.repeat(content.questions.length - 1);
    expect(decodeState(`${STATE_SCHEMA}~${content.version}~${bad}`, content)).toEqual({
      ok: false,
      reason: 'option-out-of-range',
    });
  });
});
