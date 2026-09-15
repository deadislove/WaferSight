# Contributing to WaferSight

Thanks for your interest in contributing. This document covers how the
project is organized, the workflow contributions are expected to follow,
and how to get a change merged.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
By participating, you're expected to uphold it.

## Getting Started

```bash
git clone <this-repo>
cd WaferSight
npm install
npm run dev
```

See [`README.md`](./README.md) for prerequisites and
[`docs/technical/PROJECT_DESIGN.md`](./docs/technical/PROJECT_DESIGN.md)
for the full architecture.

## Project Workflow: Spec-First

Non-trivial features in this repo are designed before they're built:

1. **Propose** — write a spec in `spec/future/` describing the problem,
   scope decisions, and acceptance criteria.
2. **Review** — get it reviewed/approved before implementation starts.
3. **Implement** — build it.
4. **Verify** — prove it works against the real, running app (see
   "Verification" below), not just a passing typecheck.
5. **Document** — move the spec to `spec/done/` with the verification
   evidence recorded in the file itself, and fix up any relative links.

Browse `spec/done/` for examples of the expected format and level of detail
before writing a new spec.

## Making Changes

- **Type safety**: `npx tsc -b --noEmit` must pass with no errors.
- **Linting**: `npm run lint` must pass.
- **No dead scope creep**: keep changes scoped to what the task actually
  needs — avoid speculative abstractions, unused flags, or refactors
  unrelated to the change at hand.
- **Comments**: default to none. Only add a comment when the *why* isn't
  obvious from the code itself (a non-obvious constraint, a workaround, a
  subtle invariant) — not to restate what the code already says.
- **i18n**: this app ships in English and Traditional Chinese
  (`src/i18n/locales/{en,zh-TW}.json`). Any new user-facing string in a
  React component must go through `useTranslation()`'s `t()` — never a
  hardcoded literal. See [`spec/done/i18n-support.md`](./spec/done/i18n-support.md)
  for the established scope and patterns (including the deliberate
  exclusions — mock data content and backend/IPC error strings).
- **Local-first, no cloud AI**: the renderer never calls an external API.
  Data flows through `window.electronAPI` → `ipcMain.handle` → a
  main-process service → SQLite. The one exception is the ONNX defect
  classifier, which runs entirely client-side via WASM — see
  [`spec/done/ai-defect-detection.md`](./spec/done/ai-defect-detection.md).
- **Deterministic mock data**: anything under `src/mocks/` must use the
  project's seeded pseudo-random helper, never `Math.random()`, so mock
  output is reproducible across runs.

## Verification

Passing `tsc`/lint is necessary but not sufficient. Before calling a change
done, exercise the actual running app — launch the real Electron build
(e.g. via Playwright's `_electron`), click through the affected flow, and
confirm the output (screenshots, exported files, console/log output) rather
than assuming it works because the types check out. See existing specs in
`spec/done/` for the level of verification expected.

## Commit Messages

Keep commit messages focused on *why* a change was made, not just what
changed. Reference the relevant spec file where useful.

## Reporting Bugs / Requesting Features

Open an issue describing the problem or proposal. For security
vulnerabilities, do **not** open a public issue — see
[`SECURITY.md`](./SECURITY.md) instead.

## Questions

Reach out to the maintainer, Da-Wei Lin:

- Email: dawei.lin7689@gmail.com
- LinkedIn: https://www.linkedin.com/in/da-wei-lin-689a35107/

## License

By contributing, you agree that your contributions will be licensed under
the project's [MIT License](./LICENSE).
