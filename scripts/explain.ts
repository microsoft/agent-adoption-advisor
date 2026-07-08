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
    name: 'Well-scoped packaged task, no-code business team (should steer to a light SKU)',
    answers: {
      job: 'automate_task', builder: 'business', grounding: 'm365', integration: 'surface_only',
      sensitivity: 'standard', governance: 'self_serve', extensibility: 'none', reach: 'individual',
      autonomy: 'assistive', appetite: 'configure',
    },
  },
  {
    name: 'Same task BUT regulated data residency (should disqualify the M365-surface SKUs)',
    answers: {
      job: 'automate_task', builder: 'business', grounding: 'm365', integration: 'surface_only',
      sensitivity: 'regulated', governance: 'self_serve', extensibility: 'none', reach: 'individual',
      autonomy: 'assistive', appetite: 'configure',
    },
  },
  {
    name: 'Research and retrieval, business user, M365 content (should favor Scout)',
    answers: {
      job: 'research', builder: 'business', grounding: 'm365', integration: 'surface_only',
      sensitivity: 'standard', governance: 'self_serve', extensibility: 'none', reach: 'individual',
      autonomy: 'assistive', appetite: 'configure',
    },
  },
  {
    name: 'Bespoke governed workflow, maker, SaaS connectors (should favor Copilot Studio)',
    answers: {
      job: 'workflow', builder: 'maker', grounding: 'saas_connectors', integration: 'connectors',
      sensitivity: 'standard', governance: 'central_alm', extensibility: 'some', reach: 'org',
      autonomy: 'semi', appetite: 'invest',
    },
  },
  {
    name: 'Pro-code platform, engineers, custom data + API, autonomous (should recommend Copilot Studio)',
    answers: {
      job: 'platform', builder: 'engineer', grounding: 'custom_data', integration: 'custom_api',
      sensitivity: 'restricted', governance: 'mlops', extensibility: 'full', reach: 'external',
      autonomy: 'autonomous', appetite: 'invest',
    },
  },
  {
    name: 'Only the job answered (should be low/none confidence, provisional)',
    answers: { job: 'workflow' },
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
