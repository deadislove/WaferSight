# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows spec-driven development — each entry links to its
corresponding spec in [`spec/done/`](./spec/done) for full design rationale
and verification evidence.

## [Unreleased]

### Added

- Public-facing project documentation: `README.md`, `LICENSE`,
  `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, this changelog,
  and `.github/` issue/PR templates + CI workflow.
- Bilingual UI support (English / Traditional Chinese) — see
  [`spec/done/i18n-support.md`](./spec/done/i18n-support.md).
- Continuous model improvement: human-in-the-loop calibration layer for
  the AI defect classifier — see
  [`spec/done/continuous-model-improvement.md`](./spec/done/continuous-model-improvement.md).
- Process parameter simulation ("what-if" wafer defect map synthesis) —
  see [`spec/done/process-parameter-simulation.md`](./spec/done/process-parameter-simulation.md).
- Real-time alerts with a notification bell and simulated push channel —
  see [`spec/done/realtime-alerts.md`](./spec/done/realtime-alerts.md).
- AI defect detection via a locally-run ONNX CNN trained on the public
  WM-811K dataset — see [`spec/done/ai-defect-detection.md`](./spec/done/ai-defect-detection.md).
- Process/SPC monitoring with Western Electric rule violation detection —
  see [`spec/done/process-spc-monitoring.md`](./spec/done/process-spc-monitoring.md).
- Quality dashboard with KPI cards and trend charts — see
  [`spec/done/quality-dashboard.md`](./spec/done/quality-dashboard.md).
- Interactive 3D wafer/die visualization (three.js) — see
  [`spec/done/wafer-3d-view.md`](./spec/done/wafer-3d-view.md).
- Quality data foundation: simulated remote sync into local encrypted
  SQLite — see [`spec/done/quality-data-foundation.md`](./spec/done/quality-data-foundation.md).
- Admin user management with role-gated access — see
  [`spec/done/admin-user-management.md`](./spec/done/admin-user-management.md).

### Fixed

- Two-scheduler background worker split (local-only vs. network-dependent)
  to fix an unhandled-promise-rejection crash on window close — see
  [`spec/done/main-process-window-lifecycle-crash.md`](./spec/done/main-process-window-lifecycle-crash.md).

### Security

- JWT-based authentication with role verification on every privileged IPC
  handler.
- Per-install randomly generated database encryption key and JWT secret.

## Versioning Note

This project has not yet cut a `1.0.0` release (`package.json` version is
`0.0.0`); entries above are grouped under **[Unreleased]** until the first
tagged release. Once released, this file will follow
[Semantic Versioning](https://semver.org/).
