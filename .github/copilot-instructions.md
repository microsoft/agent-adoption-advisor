# Agent Adoption Advisor

A fully client-side, deterministic questionnaire that helps enterprise teams pick the
right Microsoft agent approach. **No backend, no telemetry, no LLM, no auth.** Vite +
React 18 + TypeScript SPA.

## Commands

- `npm run dev` — dev server (runs `content:build` first via `predev`).
- `npm run build` — full gate: `content:build` → `content:validate` → `tsc --noEmit` → `vite build`.
- `npm test` — run the Vitest suite once. `npm run test:watch` for watch mode.
- Run a single test file: `npx vitest run src/engine/score.test.ts`.
- Run tests matching a name: `npx vitest run -t "disqualifier"`.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run content:build` — compile `content/content.yaml` → `public/content.json`.
- `npm run content:validate` — schema + semantic validation of the compiled JSON.
- `npm run explain` — print routing results for representative scenarios (reviewer sanity check).

## Architecture

Data flows one direction: **YAML content → compiled JSON → pure scoring engine → React UI**.

1. **Content is authored once, in `content/content.yaml`** (single source of truth). SMEs
   edit questions, approaches, and scoring rules here.
2. **Build step (`scripts/build-content.ts`) compiles it to `public/content.json`.** The
   browser NEVER parses YAML — `src/ui/useContent.ts` fetches the compiled JSON. Do not
   add a YAML parser to the client, and do not hand-edit `public/content.json` (it is
   git-ignored and regenerated).
3. **Validation gate (`scripts/validate-content.ts`)** runs in the build. Layer 1 is
   JSON Schema (`schema/content.schema.json`); layer 2 is `src/content/validate.ts`, which
   catches things the schema can't: dangling rule references, duplicate ids, orphan rules,
   mis-ordered confidence thresholds. A bad SME edit must break the build here.
4. **Scoring engine (`src/engine/score.ts`) is a PURE function** `score(answers, content)`.
   No DOM, no `Date`, no `Math.random`, no I/O — same inputs always produce byte-identical
   output. Ordering is stabilized with an `approachId` tie-break. Preserve this purity; it
   is what makes a recommendation defensible and testable.
5. **UI (`src/ui/`, `src/App.tsx`)** is a thin layer over the engine. Routing between the
   split questionnaire view and the print one-pager is done by reading `?view=` and
   `?state=` off the URL — there is no router library.

## Key conventions

- **`.js` extensions in relative imports** even though the source is `.ts`/`.tsx` (e.g.
  `import { score } from './engine/score.js'`). Keep this — it matches the ESM/`module: ESNext`
  setup. Do not drop the extension.
- **Scoring rule vocabulary** (see `src/engine/model.ts`): `weights` are soft nudges,
  `disqualifiers` are hard blocks, `requiredPrereqs` gate an approach on a specific answer
  (unanswered → recorded as an assumption, not a disqualification), `strongFits` give a
  decisive bonus. Confidence is **downgrade-only** and forced to `none` when the top fit is
  below the floor — a wide margin between two poor options is NOT confidence.
- **Presentation copy lives in pure helpers** (`src/ui/present.ts`), not inside components,
  so screen and print one-pager render byte-identical text and stay unit-testable without a DOM.
- **Shareable state (`src/state/encode.ts`) is compact, positional, and non-PII**: one digit
  per question, version-stamped. Decoding is defensive and REJECTS state from a different
  content version (positional digits are only meaningful against the version that produced them).
  If you add/reorder questions, old links intentionally stop decoding.
- **Vitest environment is `node` by default** (`vite.config.ts`). Component tests that need a
  DOM opt in per-file with a `// @vitest-environment jsdom` comment on line 1. `jsdom` is
  pinned to v24 on purpose (v25+ pulls an ESM-only CSS parser that breaks under Node 21).
- When changing content shape, update all three in lockstep: `content/content.yaml`, the
  TypeScript types in `src/engine/model.ts`, and `schema/content.schema.json`.
