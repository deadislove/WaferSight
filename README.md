# WaferSight

A local-first Electron desktop application for **AI-assisted semiconductor
quality inspection**. A fab quality engineer can pick a lot/wafer, view it
in an interactive 3D die grid, see where defects are via a real, locally-run
CNN classifier, check whether the process that produced it was
statistically in control, review a quality dashboard, receive real-time
alerts, and export a PDF report. The AI model improves over time from
engineers' own feedback, entirely on-device.

For the full architecture, data flow, database schema, and background-task
design, see [`docs/technical/PROJECT_DESIGN.md`](./docs/technical/PROJECT_DESIGN.md).
For the design rationale and acceptance criteria behind each feature, see
[`spec/done/`](./spec/done).

## Features

- **Authentication & access control** — JWT-based sessions, role-gated
  (`user` / `admin`) IPC handlers, admin user management.
- **Quality data foundation** — a simulated remote sync (`Lot → Wafer →
  Die`) persisted into local, encrypted SQLite.
- **3D wafer / die visualization** — an interactive `three.js` scene with
  rotate/zoom/pan, per-die detail, and defect/process-parameter color modes.
- **AI defect detection** — a CNN trained on the public WM-811K wafer-map
  dataset (95.6% measured test accuracy), run 100% locally via
  `onnxruntime-web` — no network calls, no external API.
- **Continuous model improvement** — a human-in-the-loop calibration layer
  that retrains from engineer feedback in the background, without touching
  the underlying CNN weights.
- **Process parameter simulation** — a "what-if" panel that synthesizes a
  deterministic wafer defect map from process-parameter sliders.
- **Process / SPC monitoring** — control charts with Western Electric rule
  violation detection.
- **Quality dashboard & real-time alerts** — KPI cards, trend charts, and a
  simulated push-alert channel with a notification bell.
- **PDF export** and **bilingual UI** (English / Traditional Chinese, fully
  switchable at runtime, including on the pre-login screens).

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 44 |
| UI | React 19 + TypeScript, Vite 8 |
| Styling | Tailwind CSS |
| Local database | SQLite (`better-sqlite3-multiple-ciphers`, encrypted at rest) |
| Local AI inference | `onnxruntime-web` (WASM), CNN trained offline with PyTorch |
| 3D visualization | `three.js` |
| PDF export | `jspdf` + `jspdf-autotable` |
| i18n | `i18next` + `react-i18next` |
| Packaging | `electron-builder` (NSIS / DMG / AppImage) |

## Project Structure

```text
WaferSight/
├── electron/              # Main process: IPC handlers, services (DB access), background schedulers
│   ├── infra/              # SQLite schema + per-install config/key management
│   ├── services/            # Business logic — the only code allowed to touch the DB
│   └── workers/              # Two independent background schedulers (local-only / network-dependent)
├── src/                    # Renderer process (React)
│   ├── components/           # Shared UI (navbar, charts, 3D wafer scene, language switcher, ...)
│   ├── contexts/              # App-wide state (notifications, quality data)
│   ├── i18n/                   # i18next init + en/zh-TW locale files
│   ├── pages/                   # Route-level pages (auth, admin, quality module)
│   ├── services/                 # Renderer-side IPC wrappers + client-only logic (ONNX inference)
│   └── mocks/                     # Simulated remote data sources, consumed only via the service layer
├── public/models/          # Trained ONNX classifier + labels
├── scripts/train-defect-model/  # One-time, offline PyTorch training pipeline (not part of the app build)
└── spec/                   # Feature specs: spec/future/ (proposed) → spec/done/ (implemented + verified)
```

See [`docs/technical/PROJECT_DESIGN.md`](./docs/technical/PROJECT_DESIGN.md)
for the complete file tree and the reasoning behind this layout.

## Getting Started

### Prerequisites

Node.js 18+ and npm.

### Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Starts Vite in watch mode and launches Electron against the watched build.
Hot reloading applies to both the React renderer and the Electron main
process. On first launch, SQLite auto-initializes `app_database.db` inside
your OS user data directory, and a default `admin` / `123` account is
seeded.

> **⚠️ Change the default admin password immediately.** `admin` / `123` is
> a seeded convenience for local development only — it is *not* safe for
> any real deployment. Log in and change it via the admin user management
> page (or delete the seeded row) before giving anyone else access to an
> install of this app.

## Building

```bash
npm run build
```

Type-checks, builds the production bundle, and packages an installer for
your OS (NSIS on Windows, DMG on macOS, AppImage on Linux) into `release/`.

## Database

The encrypted SQLite database and a per-install config/key file live in
Electron's `userData` directory:

- Windows: `%APPDATA%\WaferSight\app_database.db`
- macOS: `~/Library/Application Support/WaferSight/app_database.db`
- Linux: `~/.config/WaferSight/app_database.db`

The DB encryption key and JWT signing secret are randomly generated per
install (`electron/infra/configManager.ts`) and stored alongside it in
`config.json` — if that file is lost, the existing database cannot be
decrypted. Schema and migrations live in `electron/infra/db.ts`.

## Acknowledgments

The AI defect classifier (`public/models/wafer-defect-classifier.onnx`)
is trained on the public **WM-811K** (aka MIR-WM811K / LSWMD) wafer-map
dataset — ~811K real wafer maps from an actual fab, ~173K labeled with one
of 8 canonical failure patterns. This project redistributes a model
derived from that dataset, so per its license terms, citation is required:

> Ming-Ju Wu, Jyh-Shing Roger Jang, and Jui-Long Chen, "Wafer Map Failure
> Pattern Recognition and Similarity Ranking for Large-Scale Data Sets,"
> IEEE Transactions on Semiconductor Manufacturing, vol. 28, no. 1,
> pp. 1-12, Feb. 2015.

The dataset itself is not included in this repository (see
[`scripts/train-defect-model/README.md`](./scripts/train-defect-model/README.md)
for how to obtain it and reproduce training) — only the exported `.onnx`
model artifact ships with the app.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for
the project's spec-first workflow, coding conventions, and verification
expectations. Participation is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Found a vulnerability? Please don't open a public issue — see
[`SECURITY.md`](./SECURITY.md) for how to report it privately.

## License

This project is licensed under the [MIT License](./LICENSE).

## Author

**Da-Wei Lin**
[dawei.lin7689@gmail.com](mailto:dawei.lin7689@gmail.com) ·
[LinkedIn](https://www.linkedin.com/in/da-wei-lin-689a35107/)
