// Review harness: run a set of representative scenarios through the pure
// scoring engine and print human-readable results. This is how you sanity-check
// the routing logic and content weights BEFORE the Phase 2 UI exists.
//
//   npm run explain
//
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { score } from '../src/engine/score.js';
import type { AnswerMap, Content } from '../src/engine/model.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const content = parse(
  readFileSync(resolve(root, 'content/content.yaml'), 'utf8'),
  { strict: true },
) as Content;

const scenarios: { name: string; answers: AnswerMap }[] = [
  {
    name: 'Well-scoped packaged task, low build appetite (should steer to a light SKU)',
    answers: { scenario: 'packaged_task', data_residency: 'none', build_appetite: 'low', control: 'managed' },
  },
  {
    name: 'Same task BUT regional data residency (should disqualify Cowork/Scout)',
    answers: { scenario: 'packaged_task', data_residency: 'regional', build_appetite: 'low', control: 'managed' },
  },
  {
    name: 'Bespoke org workflow, engineers ready, managed control',
    answers: { scenario: 'custom_workflow', data_residency: 'none', build_appetite: 'high', control: 'managed' },
  },
  {
    name: 'Broad platform, pro-code control (should recommend Foundry)',
    answers: { scenario: 'broad_platform', data_residency: 'none', build_appetite: 'high', control: 'procode' },
  },
  {
    name: 'Only one question answered (should be low/none confidence, provisional)',
    answers: { scenario: 'custom_workflow' },
  },
  {
    name: 'Nothing answered (no clear fit)',
    answers: {},
  },
];

const nameById = new Map(content.approaches.map((a) => [a.id, a.name]));
const bar = '─'.repeat(78);

for (const s of scenarios) {
  const r = score(s.answers, content);
  console.log(bar);
  console.log('SCENARIO: ' + s.name);
  console.log('answers:  ' + JSON.stringify(s.answers));
  console.log('');
  if (r.top) {
    console.log(
      `  RECOMMEND: ${r.top.name}` +
        `   (points ${r.top.points}/${r.top.maxPossible}, fit ${(r.top.fit * 100).toFixed(0)}%)`,
    );
  } else {
    console.log('  RECOMMEND: (none — no clear fit)');
  }
  console.log(`  CONFIDENCE: ${r.confidence.toUpperCase()}` + (r.noClearFit ? '  [no clear fit]' : ''));
  if (r.tie) console.log('  NOTE: exact tie at the top');
  console.log('');
  console.log('  Ranked:');
  for (const a of r.ranked) {
    const fit = `${(a.fit * 100).toFixed(0)}%`;
    const strong = a.strongFit ? '  ★ ' + a.strongFitReasons.join('; ') : '';
    console.log(`    ${a.points.toString().padStart(2)} pts  ${a.name.padEnd(18)} fit ${fit}${strong}`);
  }
  if (r.disqualified.length) {
    console.log('');
    console.log('  Disqualified:');
    for (const a of r.disqualified) {
      console.log(`    ✗ ${(nameById.get(a.approachId) ?? a.approachId).padEnd(18)} ${a.disqualifiedReasons.join('; ')}`);
    }
  }
  if (r.assumptions.length) {
    console.log('');
    console.log('  Assumptions:');
    for (const a of r.assumptions) console.log('    · ' + a);
  }
  console.log('');
}
console.log(bar);
console.log(`content version ${content.version}, last reviewed ${content.lastReviewed}`);
