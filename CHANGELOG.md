# Changelog

All notable changes to the Agent Adoption Advisor are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-07-08

Initial build. A fully client-side, deterministic questionnaire that helps
enterprise teams pick the right Microsoft agent approach. No telemetry, no LLM,
no auth, no backend.

### Added

- **Scoring engine** (`src/engine/`): pure `score(answers, content)` with soft
  weights, hard disqualifiers, required prerequisites, and strong-fit bonuses.
  Confidence is downgrade-only and forced to `none` when nothing clears the fit
  floor. Deterministic across runs.
- **Content pipeline**: `content/content.yaml` is the single source of truth,
  compiled to `public/content.json` and validated against
  `schema/content.schema.json`. Ten routing questions across job, builder,
  grounding, integration, sensitivity, governance, extensibility, reach,
  autonomy, and appetite.
- **Four approaches** grounded in the "Copilot Work Spectrum" (Ask → Delegate →
  Authorize): Agent Builder, Cowork, Scout, and Copilot Studio.
- **Questionnaire UI** (`src/ui/`): radio-group form over the content, live
  recommendation, ranked alternatives, honest pros/cons, "why not the others",
  assumptions for unanswered questions, and a deterministic next step.
- **Shareable one-pager** (`?view=export`): print-first recommendation page with
  a compact, non-PII, version-stamped URL state. Stale or malformed links are
  rejected with a friendly message.
- **Explain harness** (`npm run explain`): prints routing for representative
  scenarios for reviewer sanity checks.
- Test suite: engine golden/anti-bias tests, content validation, state
  encode/decode, pure presenter, and jsdom component render tests.
