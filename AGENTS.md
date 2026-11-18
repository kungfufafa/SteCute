# AGENTS.md

## Project Overview

This repository is a Vue 3 + Vite + TypeScript web Stecute application with an offline-first target architecture.

Current stack:

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia
- Dexie
- Tailwind CSS 4
- Vitest
- Playwright

Current repository status:

- The canonical product and technical source of truth is `docs/stecute-spec.md`.
- The spec documents implemented behavior; unbuilt designs live only in its Roadmap section.

## Source Of Truth

Read these in order before making substantial changes:

1. `docs/README.md`
2. `docs/stecute-spec.md`
3. `docs/stecute-prototype.html` (visual reference only)

Document ownership:

- Product scope, engineering architecture, production decisions, asset rules, and release criteria: `docs/stecute-spec.md` (single consolidated spec).

If the spec and the code disagree:

- The code is the reality; fix the spec (or the code, if it is a bug).
- Do not silently invent behavior that contradicts the spec.
- Designs that are not built yet belong in the spec's Roadmap section, not described as current behavior.

## Working Rules

- Keep the app offline-first.
- Do not introduce mandatory backend dependencies for core v1 flows.
- Do not add login, cloud sync, QR handoff, payments, or kiosk-native assumptions into v1 unless the docs are updated first.
- Do not depend on remote fonts or remote visual assets for core production flows.
- Treat browser capability differences explicitly. `share`, `save to device`, and `print` are capability-based, not guaranteed.
- Keep final render and gallery behavior aligned with the docs: local-only, bounded retention, no surprise uploads.

## Implementation Priorities

When building features, prioritize this sequence:

1. App shell and routing
2. Camera permission and preview
3. Session configuration
4. Multi-shot capture and upload flow
5. Local persistence with Dexie
6. Review and per-shot retake
7. Render pipeline
8. Output actions
9. PWA/offline behavior
10. QA hardening

## Current v1 Constraints

Important constraints already locked in the docs:

- Layouts: `2`, `3`, `4`, `6` pose
- Templates: `Classic`, `Youth`, `Mono`
- Export: PNG default, JPG optional
- Gallery retention: `10` final renders
- Upload formats: JPG, PNG, WebP
- Upload size limit: `10 MB` per file
- Retake per-shot: included in v1
- Event presets: not included in v1
- Auto-reset: not included in v1
- Fonts: production must be self-hosted

## Commands

Install:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Typecheck:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Unit tests:

```bash
npm run test
```

E2E tests:

```bash
npm run test:e2e
```

## Code Guidance

- Prefer TypeScript-first implementations.
- Keep feature boundaries clear rather than pushing everything into `App.vue`.
- Use data-driven configs for layouts and templates.
- Keep heavy image work isolated from view components.
- Prefer Blob-based storage over base64.
- Design for fallback behavior on browsers without advanced APIs.

## Documentation Discipline

When making behavior changes that affect product, flow, architecture, assets, or release criteria:

- update the relevant file in `docs/`
- keep naming consistent with the current doc set
- avoid leaving stale decisions in older docs

## Non-Goals For Agents

Unless explicitly requested, do not:

- rewrite the documentation set from scratch
- add new monetization features
- add server APIs for core flows
- introduce a different frontend framework
- treat the prototype as the only source of truth over the written specs
