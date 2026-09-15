# WaferSight — Project Design

## 1. System Overview

WaferSight is a local-first Electron desktop application for **AI-assisted
semiconductor quality inspection**. A fab quality engineer can pick a
lot/wafer, view it in an interactive 3D die grid, see where defects are (via
a real, locally-run CNN classifier — not a mock), check whether the process
that produced it was statistically in control (SPC), review a quality
dashboard, receive real-time alerts, and export a PDF report. The AI model
improves over time from engineers' own feedback, entirely on-device.

The project started from a generic Electron + React + SQLite template (a
radio-dispatch/check-in demo) and was repositioned into this quality-POC
product; the authentication and user-management layer is the one piece
carried over from that template, now serving as the access-control
foundation for the quality module.

Two properties shape every design decision in this document:

- **Local-first.** All persistent data lives in an encrypted SQLite database
  on the user's machine. The app is fully functional offline.
- **No external AI/network API for fab data.** Semiconductor-industry IT
  policy rules out sending defect/yield data to any external service (no
  OpenAI-style API, no cloud inference). The wafer-defect classifier is a
  CNN trained offline on a public dataset, exported to ONNX, and run
  entirely client-side via `onnxruntime-web` — zero network calls at
  inference time.

## 1.1 Core Features

- **Authentication & Access Control** — username/password login, password
  reset via security question, JWT-based session, role-gated (`user` /
  `admin`) IPC handlers on the main-process side (not just a hidden UI
  toggle).
- **Admin: User Management** — create/update/delete users, role assignment.
- **Quality Data Foundation** — a simulated "remote sync" (`Lot → Wafer →
  Die`) persisted into local SQLite, with a manual refresh control and a
  periodic background pull; every other quality module reads from this
  local store, not from the mock layer directly.
- **3D Wafer / Die Visualization** — an interactive `three.js` scene (an
  `InstancedMesh` die grid on a wafer disc, reused across the 3D view and
  the process-simulation page) with rotate/zoom/pan, per-die click-through
  detail, and a toggle between defect-heatmap and process-parameter
  coloring.
- **AI Defect Detection (real local inference)** — a CNN trained on the
  public WM-811K wafer-map dataset (measured 95.6% test accuracy over
  118,595 held-out samples), classifying a wafer's die pattern into one of
  9 classes (`none`, `Center`, `Donut`, `Edge-Loc`, `Edge-Ring`, `Loc`,
  `Random`, `Scratch`, `Near-full`) via ONNX Runtime Web (WASM backend), plus
  a defect Pareto chart across wafers.
- **Continuous Model Improvement (human-in-the-loop calibration)** — a
  lightweight linear calibration layer sits on top of the frozen CNN's
  output. Engineers confirm or correct each classification; confirmations
  accumulate as feedback samples and periodically retrain the calibration
  layer (pure-TypeScript SGD, no Python/GPU dependency) in the background,
  without ever touching the underlying CNN weights.
- **Process Parameter Simulation** — a 5-slider "what-if" panel (etch
  time, chamber pressure, mechanical stress, temperature deviation, RF
  power) that synthesizes a deterministic wafer defect map, so an engineer
  can explore how process drift would visually manifest, reusing the same
  3D wafer scene and the CNN classifier.
- **Process / SPC Monitoring** — time-series process-parameter charts with
  Individual-Moving-Range control charts and Western Electric rule
  violation detection, correlated back to affected lots/wafers.
- **Quality Dashboard** — KPI cards (yield %, defect rate, active SPC
  alarms, lots reviewed) and trend charts.
- **Real-Time Alerts** — SPC-violation / high-defect-rate alerts delivered
  via a simulated push channel, with a notification bell and live badge
  count.
- **Reporting / Export** — PDF export (`jspdf` + `jspdf-autotable`) of
  defect-detection and simulation results, correctly rendering CJK text.
- **Bilingual UI (i18n)** — full English / Traditional Chinese switching at
  runtime (`i18next` + `react-i18next`), including on the pre-login
  screens, with the selection persisted independently of the auth session.

## 2. Project File Structure

```
WaferSight/
├── electron/                        # Main process (Node.js context)
│   ├── main.ts                      # App entrypoint: window lifecycle, IPC handler registration, scheduler wiring
│   ├── preload.ts                   # contextBridge — the only surface the renderer can call into the main process through
│   ├── declarations.d.ts
│   ├── infra/
│   │   ├── db.ts                    # SQLite schema (CREATE TABLE), migrations, default admin seed
│   │   └── configManager.ts         # Generates/persists a per-install random DB encryption key + JWT secret to userData/config.json
│   ├── services/                    # Business logic, one file per domain — the only code allowed to touch `db`
│   │   ├── authService.ts           # register/login/resetPassword, verifyToken/verifyAdmin (JWT)
│   │   ├── userService.ts           # Admin user CRUD
│   │   ├── qualityDataService.ts    # Simulated remote sync → SQLite; getWafers/getDies/getLastSyncedAt
│   │   └── modelCalibrationService.ts # Feedback CRUD, calibration_state CRUD, retrainNow() (SGD loop)
│   └── workers/                     # Background schedulers — see §9
│       ├── backgroundWorker.ts      # Generic local-only scheduler (registers + protects tasks; no business logic of its own)
│       ├── networkBackgroundWorker.ts # Generic network-dependent scheduler (owns the connectivity check)
│       ├── qualitySyncWorker.ts     # Task: pull quality data, broadcast on success
│       ├── calibrationWorker.ts     # Task: retrain calibration layer every 10 min (self-throttled)
│       └── netStatusWorker.ts       # Task: broadcast online/offline transitions only
│
├── src/                              # Renderer process (Chromium context, React)
│   ├── App.tsx                       # Login screen + top-level view switch (login/register/forgot-password/home)
│   ├── main.tsx                      # React root
│   ├── components/
│   │   ├── navbar.tsx / bottombar.tsx
│   │   ├── languageSwitcher.tsx      # Reusable EN/zh-TW <select>, used pre- and post-login
│   │   ├── notificationBell.tsx / toast.tsx / modal.tsx / errorModal.tsx / loadingSpinner.tsx / exportModalContent.tsx
│   │   ├── charts/                   # statTile.tsx, lineChart.tsx, controlChart.tsx
│   │   └── three/waferScene.tsx      # Shared three.js wafer+die-grid scene (wafer view + process simulation)
│   ├── contexts/
│   │   ├── notificationContext.tsx   # App-wide alert/toast state
│   │   └── qualityDataContext.tsx    # App-wide wafer/lot data + the auto-feedback-on-sync effect (must be app-wide, not page-scoped)
│   ├── i18n/
│   │   ├── index.ts                  # i18next init, setLanguage(), localStorage persistence
│   │   └── locales/{en,zh-TW}.json
│   ├── constants/alertLabels.ts      # Fixed label dictionaries (severity/status), i18n-keyed
│   ├── pages/
│   │   ├── home.tsx / auth/{register,forgetpassword}.tsx / subpages/userProfilePage.tsx
│   │   ├── admin/adminHome.tsx
│   │   ├── admin/subpages/{userManagePage,modelTuningPage}.tsx
│   │   └── subpages/quality/
│   │       ├── qualityDashboardPage.tsx
│   │       ├── waferViewPage.tsx
│   │       ├── defectDetectionPage.tsx
│   │       ├── processMonitoringPage.tsx
│   │       ├── processSimulationPage.tsx
│   │       └── alertsPage.tsx
│   ├── services/                     # Renderer-side thin wrappers around window.electronAPI (IPC) or pure client-side logic
│   │   ├── auth/{authService,registerService}.ts
│   │   ├── user/userManageServices.ts
│   │   ├── profile/profileServices.ts
│   │   ├── export/exportServices.tsx # PDF report generation (jspdf/jspdf-autotable)
│   │   └── quality/
│   │       ├── lotFoundationService.ts / qualityDashboardService.ts / processMonitoringService.ts / alertsService.ts
│   │       ├── defectInferenceService.ts # ONNX model load + inference + calibration application (client-side, no IPC)
│   │       ├── calibrationService.ts     # IPC wrapper: submit feedback, get/update calibration state, retrain
│   │       ├── autoFeedbackService.ts    # Auto-submits engineer-implicit feedback on each data sync
│   │       └── waferSimulationService.ts # Deterministic synthetic wafer-map generator (process simulation)
│   └── mocks/                        # Mock data sources, consumed only by the service layer above
│       ├── api/{qualityDataApi,alertsApi}.ts   # Simulated remote endpoints (Lot/Wafer/Die, push alerts)
│       └── data/quality/{qualityDashboardMocks,processMonitoringMocks}.ts
│
├── public/
│   ├── models/
│   │   ├── wafer-defect-classifier.onnx        # Trained CNN, exported from scripts/train-defect-model
│   │   └── wafer-defect-classifier-labels.json
│   └── ort/                          # onnxruntime-web WASM runtime assets, served locally (no CDN)
│
├── scripts/train-defect-model/       # One-time, offline Python training pipeline (not part of the Electron build)
│   ├── train.py                      # WM-811K → CNN → ONNX export
│   ├── requirements.txt
│   └── README.md
│
├── spec/
│   ├── done/                         # Implemented + verified feature specs (source of truth for "why", not just "what")
│   └── future/                       # Specs awaiting review/approval before implementation begins
│
├── docs/technical/
│   └── PROJECT_DESIGN.md             # This document
│
├── index.html / vite.config.ts / tailwind.config.js / postcss.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── package.json
```

## 3. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────-─┐
│                          Renderer Process                             │
│                    (Chromium — src/, React + TypeScript)              │
│                                                                       │
│  Pages/Components → Contexts → Renderer Services                      │
│                                     │                                 │
│               ┌─────────────────────┼───────────────────────┐         │
│               │                     │                       │         │
│      window.electronAPI    onnxruntime-web (WASM)      three.js       │
│         (IPC bridge)         local CNN inference      3D wafer scene  │
│               │             (no IPC, no network)     (no IPC needed)  │
└───────────────┼───────────────────────────────────────────────────────┘
                 │ contextBridge (preload.ts)
                 │ every call attaches jwt_token from localStorage
┌───────────────┼─────────────────────────────────────────────────────────────┐
│               ▼                    Main Process (Node.js)                   │
│         ipcMain.handle(...)                                                 │
│               │                                                             │
│   ┌───────────┴───────────┐                                                 │
│   │   Services layer       │   authService / userService /                  │
│   │  (owns all DB access)  │   qualityDataService / modelCalibrationService │
│   └───────────┬───────────┘                                                 │
│               │                                                             │
│      electron/infra/db.ts  ── better-sqlite3-multiple-ciphers               │
│               │                (encrypted, key from configManager.ts)       │
│               ▼                                                             │
│   app_database.db  (userData folder — see §8)                               │
│                                                                             │
│   ┌────────────────────────────┐    ┌───────────────────────────────┐       │
│   │  backgroundWorker.ts        │   │  networkBackgroundWorker.ts   │       │
│   │  (local-only scheduler)     │   │  (network-dependent scheduler)│       │
│   │  - DB health check          │   │  - connectivity probe         │       │
│   │  - quality data sync (mock) │   │  - online/offline broadcast   │       │
│   │  - calibration retrain      │   │                               │       │
│   └────────────────────────────┘    └───────────────────────────────┘       │
│               │                                    │                        │
│               └──────────── mainWindow.webContents.send(...)                │
│                              (only when window is usable — see §9)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

Key architectural rule: the renderer **never** calls an external API
directly. Every piece of data — including the "remote" quality-data sync —
goes through `window.electronAPI` → `ipcMain.handle` → a main-process
service → SQLite. The one exception by design is the ONNX CNN, which runs
entirely inside the renderer's WASM sandbox with local model files — not a
network call, so it doesn't need to cross the IPC boundary at all.

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 44 |
| UI framework | React 19 + TypeScript, Vite 8 (`vite-plugin-electron`) |
| Styling | Tailwind CSS |
| Local database | SQLite via `better-sqlite3-multiple-ciphers` (encrypted at rest) |
| Auth | `bcryptjs` (password hashing) + `jsonwebtoken` (session JWT) |
| Local AI inference | `onnxruntime-web` (WASM backend), CNN trained offline with PyTorch (`scripts/train-defect-model`) |
| 3D visualization | `three.js` (`InstancedMesh` die grid) |
| Charts | Custom lightweight chart components (`src/components/charts`) |
| PDF export | `jspdf` + `jspdf-autotable` |
| i18n | `i18next` + `react-i18next` |
| Packaging | `electron-builder` (NSIS/Windows, DMG/macOS, AppImage/Linux) |
| Linting/typechecking | ESLint (flat config) + `tsc -b` |

## 5. Data Flow & IPC — Representative Flows

**Flow A — Login (renderer-initiated, request/response)**

```
LoginForm.onSubmit()
  → src/services/auth/authService.ts: loginService(credentials)
  → window.electronAPI.login(data)          [preload.ts, no token yet]
  → ipcRenderer.invoke('auth-login', data)
  → ipcMain.handle('auth-login', ...)        [main.ts]
  → authService.login(data)                  [electron/services/authService.ts]
      - bcrypt.compare against users.password
      - sign JWT on success
  → { success, token, user } returned back up the same chain
  → renderer stores jwt_token / current_user / current_role in localStorage
```

Every subsequent IPC call's preload wrapper reads `jwt_token` from
`localStorage` and attaches it to the payload; the corresponding
`ipcMain.handle` calls `authService.verifyToken` (or `verifyAdmin` for
admin-only actions like `retrain-calibration-now`) before doing any work.

**Flow B — Quality data sync (renderer-initiated, then main-process-pushed)**

```
User clicks "Refresh" (or periodic backgroundWorker tick)
  → quality-sync IPC call, token verified
  → qualityDataService.syncFromRemote()      [simulates a remote pull, writes lots/wafers/dies to SQLite]
  → on success: mainWindow.webContents.send('quality-data-synced', syncedAt)
  → QualityDataProvider (renderer context) receives the event, refetches from SQLite via IPC,
    and (see Flow C) triggers auto-feedback for any freshly classified wafers
```

**Flow C — Local AI inference + calibration (entirely renderer-side, then one IPC write)**

```
defectDetectionPage (or QualityDataProvider, on every sync) has die data for a wafer
  → defectInferenceService.classifyWaferPattern(dies, gridSize)
      - onnxruntime-web loads wafer-defect-classifier.onnx (once, cached)
      - runs inference fully client-side — no network, no IPC
      - applyCalibration() adjusts the raw CNN output using the current
        calibration_state weights (fetched once via IPC, cached in memory)
  → result displayed immediately (no round-trip needed for display)
  → engineer confirms/corrects the label → submitModelFeedback IPC call
  → modelCalibrationService.submitFeedback() persists to model_feedback (SQLite)
  → next scheduled calibrationWorker tick retrains the linear layer and
    broadcasts 'calibration-updated' if minSamples is met
```

## 6. Module / Directory Structure Design

- **`electron/services/*`** is the only code permitted to import `db` from
  `electron/infra/db.ts`. Renderer code never touches SQLite directly —
  always through an `ipcMain.handle` → service call.
- **`electron/workers/*`** contains schedulers and the tasks they run, kept
  separate from `services/*`: a worker orchestrates *when* something runs
  and how failures are isolated; a service owns *what* the domain logic
  does. See §9 for why there are two independent schedulers.
- **`src/services/*`** mirrors the main-process `services/` split by
  domain (`auth`, `user`, `quality`, `export`, `profile`) — each file is a
  thin wrapper that either calls `window.electronAPI.*` (IPC) or, for
  `defectInferenceService.ts`/`waferSimulationService.ts`, runs pure
  client-side logic with no IPC at all.
- **`src/mocks/*`** is consumed exclusively through the service layer
  (`qualityDataService.ts` in the main process actually reads it, standing
  in for a real remote endpoint) — no page or component imports a mock
  file directly, so swapping mocks for a real backend later is a
  service-layer change only.
- **`src/contexts/*`** holds state that must be available app-wide,
  regardless of which page is currently mounted — e.g.
  `QualityDataProvider` owns both the synced wafer/lot data *and* the
  auto-feedback-on-sync effect, specifically because a page-scoped version
  of that effect (originally in `defectDetectionPage.tsx`) only ran while
  that one page happened to be open.
- **`spec/done/` vs `spec/future/`** — features are designed in
  `spec/future/`, reviewed, implemented, verified against the real running
  app, and only then moved to `spec/done/` with verification evidence
  recorded in the file itself.

## 7. Database Storage Strategy

The SQLite file and the per-install config/key file both live in Electron's
`app.getPath('userData')`, which resolves per OS:

| OS | `userData` path |
|---|---|
| Windows | `C:\Users\<user>\AppData\Roaming\WaferSight\` |
| macOS | `~/Library/Application Support/WaferSight/` |
| Linux | `~/.config/WaferSight/` |

Files stored there:

- **`app_database.db`** — the encrypted SQLite database (`better-sqlite3-multiple-ciphers`).
- **`config.json`** — generated on first launch (`electron/infra/configManager.ts`):
  a random 32-byte DB encryption key and a random 64-byte JWT signing
  secret, both unique per install. If this file is lost, the existing
  database cannot be decrypted — there is no recovery path by design (this
  is a local-only POC, not a product with key-escrow requirements yet).

**Current schema** (`electron/infra/db.ts`):

| Table | Purpose |
|---|---|
| `users` | Auth: username, bcrypt password hash, security Q&A, role (`user`/`admin`) |
| `lots` | Lot metadata, populated by the simulated remote sync |
| `wafers` | Per-lot wafers: yield %, die-grid size |
| `dies` | Per-wafer dies: position, status, defect code/category/confidence, process deviation |
| `model_feedback` | Engineer confirm/correct events on AI classifications — the calibration layer's real-label source |
| `calibration_state` | Single-row: calibration layer weights/bias (JSON), hyperparameters, sample count |
| `calibration_metrics` | One row per retrain: timestamp, holdout accuracy, sample count — drives the learning-curve chart |

`initDatabase()` also drops four legacy template tables (`ARSEvent`,
`DispatchTable`, `RadioDevice`, `RadioEvent`) left over from the original
radio-dispatch template, migrates older databases that predate the `role`
column, seeds a default `admin`/`123` account, and seeds `calibration_state`
with an identity weight matrix (i.e. "no calibration applied yet") so a
fresh install's AI output is identical to the raw, uncalibrated CNN until
real feedback accumulates.

## 8. Build & Deployment

```
npm run dev      →  predev: rimraf dist dist-electron
                     vite build --watch  (renderer + electron main/preload, via vite-plugin-electron)
                          │
                     wait-on dist-electron/main.js
                          │
                     electron .   (launches against the watched build)

npm run build     →  tsc -b                  (typecheck both electron/ and src/ project references)
                     vite build              (production bundle: dist/ renderer, dist-electron/ main+preload)
                     electron-builder        (packages per package.json's "build" config)
                          │
                          ├─ Windows → NSIS installer (per-machine off, install-dir selectable)
                          ├─ macOS   → DMG
                          └─ Linux   → AppImage

npm run lint      →  ESLint (flat config, typescript-eslint)
```

`electron-builder`'s `asarUnpack` explicitly excludes
`better-sqlite3`'s native binary from the ASAR archive (native modules can't
be loaded from inside asar), and `appId` is `com.ezoom.wafersight`.

The ONNX model (`public/models/wafer-defect-classifier.onnx`) and the
`onnxruntime-web` WASM runtime (`public/ort/`) are static assets bundled
into the app like any other `public/` file — no separate deployment step.
Training that model is a one-time, offline, out-of-band process
(`scripts/train-defect-model/train.py`, PyTorch on the WM-811K dataset,
not part of the app or its build) — only the exported `.onnx`/labels files
ship with the app.

## 9. Background Task Scheduling

The app runs **two independent background schedulers**, deliberately split
by whether a task needs network access — not one shared scheduler with a
per-task "requires internet" flag. This replaced an earlier single-scheduler
design after a real production bug (an unhandled promise rejection when the
main window was closed mid-tick) traced back to unrelated business-domain
logic — some of it network-dependent, some not — being forced through one
30-second loop with mixed preconditions. See
`spec/done/main-process-window-lifecycle-crash.md` for the incident and
the reasoning behind the split.

```
electron/workers/backgroundWorker.ts        — local-only scheduler, 30s interval
  registered tasks (no network precondition):
    - checkingDb              health check against SQLite
    - quality data sync       (createQualitySyncTask) simulated remote pull → SQLite
    - calibration retrain     (createCalibrationRetrainTask) self-throttled to every 10 min

electron/workers/networkBackgroundWorker.ts — network-dependent scheduler, 30s interval
  owns its own connectivity probe (net.fetch, HEAD request) each tick
  registered tasks (receive { hasInternet } as context, not a gate):
    - net status broadcast    (createNetStatusTask) notifies the renderer only on an actual online/offline transition
```

Both schedulers share the same shape: a generic `register*` / `start*`
pair whose `setInterval` body does nothing but iterate registered tasks
inside a `try/catch` per task — so one task throwing never kills the
interval or produces an unhandled rejection. Each *task* itself is a small
factory function (`createXTask(...)`) that owns its own domain logic
(throttling, what to broadcast, what state to compare against) — the
scheduler itself has zero business-domain knowledge.

All three IPC broadcasts sent from these tasks (`quality-data-synced`,
`calibration-updated`, `net-status-changed`) go through `isWindowUsable()`
in `main.ts`, which checks `win.isDestroyed()` *before* touching
`.webContents` (accessing `.webContents` on an already-destroyed
`BrowserWindow` throws synchronously) — and `mainWindow` itself is set to
`null` on the window's `'closed'` event so a stale reference can never be
broadcast to in the first place.
