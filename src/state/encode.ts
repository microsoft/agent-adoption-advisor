// Compact, non-PII encoding of a user's answers for the shareable one-pager URL.
//
// The state carries ONLY option choices — no free text, no identity, nothing
// personal. It is positional: one digit per question, in content order.
//
//   format:  s1~<contentVersion>~<digits>
//   digits:  one char per question; '0' = unanswered, '1'..'9' = 1-based
//            index into that question's options (we assume <=9 options).
//
//   example: s1~2026.07~1302000000
//            └┬┘ └──┬──┘ └────┬────┘
//         schema  content    q1=opt1, q2=opt3, q3=unanswered, ...
//            tag   version
//
// Positional encoding is only meaningful against the exact content version it
// was produced from: if a question is added/reordered, old digits would map to
// the wrong options. So we embed the content version and REJECT on mismatch
// (eng review Issue 8 — defensive decode, reject unknown versions).

import type { AnswerMap, Content } from '../engine/model.js';

/** Bump when the wire format itself changes (not when content changes). */
export const STATE_SCHEMA = 's1';

const SEP = '~';

export type DecodeError =
  | 'empty'
  | 'malformed'
  | 'unknown-schema'
  | 'version-mismatch'
  | 'length-mismatch'
  | 'option-out-of-range';

export type DecodeResult =
  | { ok: true; answers: AnswerMap }
  | { ok: false; reason: DecodeError };

/** Encode answers to the compact wire string for `?state=`. Pure. */
export function encodeState(answers: AnswerMap, content: Content): string {
  const digits = content.questions
    .map((q) => {
      const chosen = answers[q.id];
      if (chosen == null) return '0';
      const idx = q.options.findIndex((o) => o.id === chosen);
      // Unknown option id (stale answer) encodes as unanswered rather than
      // producing an out-of-range digit.
      if (idx < 0) return '0';
      if (idx + 1 > 9) throw new Error('encodeState: >9 options unsupported');
      return String(idx + 1);
    })
    .join('');

  return [STATE_SCHEMA, content.version, digits].join(SEP);
}

/**
 * Decode a wire string back to answers, defensively. Never throws on bad
 * input — returns a typed reason the UI can surface. Rejects any state that
 * was not produced from THIS content version, because positional digits are
 * only meaningful against the version they were encoded from.
 */
export function decodeState(raw: string | null | undefined, content: Content): DecodeResult {
  if (raw == null || raw.length === 0) return { ok: false, reason: 'empty' };

  const parts = raw.split(SEP);
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };

  const [schema, version, digits] = parts;
  if (schema !== STATE_SCHEMA) return { ok: false, reason: 'unknown-schema' };
  if (version !== content.version) return { ok: false, reason: 'version-mismatch' };
  if (digits.length !== content.questions.length) {
    return { ok: false, reason: 'length-mismatch' };
  }

  const answers: AnswerMap = {};
  for (let i = 0; i < content.questions.length; i++) {
    const q = content.questions[i];
    const ch = digits[i];
    if (ch < '0' || ch > '9') return { ok: false, reason: 'malformed' };
    const idx = ch.charCodeAt(0) - '0'.charCodeAt(0);
    if (idx === 0) continue; // unanswered
    if (idx > q.options.length) return { ok: false, reason: 'option-out-of-range' };
    answers[q.id] = q.options[idx - 1].id;
  }

  return { ok: true, answers };
}
