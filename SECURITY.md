# Security Policy

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report it privately to the maintainer:

- **Email**: dawei.lin7689@gmail.com
- **LinkedIn**: https://www.linkedin.com/in/da-wei-lin-689a35107/

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (or a proof of concept, if available)
- The affected version/commit
- Your assessment of severity, if you have one

You should expect an initial acknowledgment within a few business days.
This is a small, independently maintained project — response and fix
timelines aren't guaranteed by an SLA, but reports are taken seriously and
acted on as promptly as possible. Please allow the maintainer a reasonable
window to investigate and release a fix before any public disclosure.

## Default Credentials

A fresh install seeds a default account: **`admin` / `123`** (see
`electron/infra/db.ts`). This exists purely to make local development and
first-run testing possible — it is **not** a vulnerability report waiting
to happen, but it *is* something every deployer must handle themselves:
change this password (or delete/replace the seeded account) via the admin
user management page before letting anyone else access an install of this
app. Since this project is open source, the default credential is public
knowledge by definition — do not rely on it being secret.

## Supported Versions

WaferSight is currently a pre-1.0 proof-of-concept under active
development. Only the latest commit on the default branch is supported;
older tags/releases do not receive security patches.

## Scope & Architecture Notes

A few things worth knowing when assessing or reporting an issue, given how
this app is built (see
[`docs/technical/PROJECT_DESIGN.md`](./docs/technical/PROJECT_DESIGN.md)
for the full architecture):

- **Local-first, no server backend.** All persistent data lives in an
  encrypted SQLite database on the user's own machine
  (`better-sqlite3-multiple-ciphers`). There is no multi-tenant server
  component to compromise.
- **Per-install secrets.** The database encryption key and JWT signing
  secret are randomly generated on first launch and stored in the OS
  `userData` directory (`electron/infra/configManager.ts`). Loss or
  exposure of that `config.json` file compromises that install's data —
  this is a known, accepted tradeoff for a local-only POC, not an oversight.
- **No external AI/network calls for fab data.** The AI defect classifier
  runs 100% locally via `onnxruntime-web`; the renderer never sends
  application data to a third-party API.
- **Electron process boundary.** The renderer talks to the main process
  only through `contextBridge`/`ipcMain.handle` (see `electron/preload.ts`
  and `electron/main.ts`) with `contextIsolation` enabled and
  `nodeIntegration` disabled — reports involving a bypass of that boundary
  (e.g. renderer gaining direct Node/filesystem access) are treated as
  high severity.
- **Dependencies**: this project vendors third-party packages (Electron,
  React, `better-sqlite3-multiple-ciphers`, `onnxruntime-web`, etc.) —
  vulnerabilities that originate purely in an upstream dependency should
  ideally be reported to that project directly, but are also welcome here
  if you're unsure where they belong.

Thank you for helping keep WaferSight and its users safe.
