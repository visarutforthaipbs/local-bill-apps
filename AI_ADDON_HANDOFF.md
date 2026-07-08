# BillNgai Offline AI Add-on Handoff

## Goal

BillNgai must remain offline-first. The AI feature is an optional add-on installed
from a separate offline package, not downloaded or activated inside the app.

The product promise is:

- Core BillNgai works without internet.
- AI add-on is installed separately.
- BillNgai only reads local add-on files.
- TOR files and billing data do not leave the machine.
- The add-on installer contains the model/runtime files. BillNgai does not
  download models inside the app.

## Current Implementation

This repo now has a local-only AI add-on path that verifies a signed add-on,
finds a bundled GGUF model/runtime, and runs local inference for the
`TOR → Invoice` screen.

Implemented files:

- `main.js`
  - Checks local add-on paths:
    - dev/user path: `~/Library/Application Support/BillNgai/ai`
    - installer/system path: `/Library/Application Support/BillNgai/ai`
    - Windows user path: `%APPDATA%\BillNgai\ai`
    - Windows system path: `%PROGRAMDATA%\BillNgai\ai`
  - Reads `addon.json`.
  - Verifies an Ed25519 signature using a public key embedded in the app.
  - Verifies SHA-256 hashes for every file listed in the manifest.
  - Exposes IPC handlers:
    - `ai:status`
    - `ai:infer`
    - `ai:reveal`

- `preload.js`
  - Exposes safe renderer APIs:
    - `window.billingAPI.aiStatus()`
    - `window.billingAPI.aiInfer(text)`
    - `window.billingAPI.revealAiFolder()`

- `billing.html`
  - Adds bottom add-on nav item: `TOR → Invoice`.
  - Adds `renderAi()`.
  - Shows:
    - install prompt when no local add-on exists
    - invalid state if signature/hash verification fails
    - ready state when local add-on verifies
    - TOR text input and local AI draft output when valid
  - No network calls, no download button, no license server.

- `scripts/create-dev-ai-addon.js`
  - Dev-only helper that creates a signed dummy add-on.
  - Installs into:
    `~/Library/Application Support/BillNgai/ai`
  - Creates:
    - `addon.json`
    - `runtime/README.txt`
    - `models/qwen-tor-dev/model.stub`

- `scripts/build-ai-addon.js`
  - Production-style packaging helper.
  - Accepts a local source folder that already contains real runtime/model files.
  - Copies files into an add-on payload.
  - Hashes every file.
  - Writes and signs `addon.json`.
  - Creates an offline `install.sh`.
  - Can build a macOS `.pkg` installer with `--pkg`.
  - Can optionally install the add-on locally for testing.
  - Current real source folder includes:
    - `runtime/bin/llama-cli`
    - `models/qwen-tor-recommended/Qwen2.5-3B-Instruct-Q4_K_M.gguf`

## Dev Commands

Create the dummy local add-on:

```bash
npm run ai:addon:dev
```

Build a real add-on package from a local source folder:

```bash
npm run ai:addon:build -- --source /path/to/local/billngai-ai-source --version 1.0.0 --model qwen-tor-recommended
```

Prepare a Windows add-on folder on a Windows PC:

```powershell
npm run ai:addon:build -- --platform win32 --source C:\path\to\billngai-ai-source-win --version 1.0.0 --model qwen-tor-recommended
```

The Windows source folder should contain platform-specific files:

```text
runtime/
  bin/
    llama-cli.exe
    pdftotext.exe        # recommended for PDF TOR import
models/
  qwen-tor-recommended/
    Qwen2.5-3B-Instruct-Q4_K_M.gguf
```

The generated Windows folder includes `install.cmd` / `install.ps1`, which
copies the add-on to:

```text
%APPDATA%\BillNgai\ai
```

Build the frictionless macOS installer:

```bash
npm run ai:addon:build -- --source /path/to/local/billngai-ai-source --version 1.0.0 --model qwen-tor-recommended --pkg
```

This outputs:

```text
dist/ai-addons/BillNgai-AI-AddOn-qwen-tor-recommended-1.0.0.pkg
```

The PKG installs bundled AI files to:

```text
/Library/Application Support/BillNgai/ai
```

That means the user flow is:

```text
Download/open BillNgai AI Add-on PKG
↓
macOS Installer copies the bundled model/runtime files
↓
Open BillNgai
↓
TOR → Invoice is unlocked
```

Build and install locally for testing:

```bash
npm run ai:addon:build -- --source /path/to/local/billngai-ai-source --version 1.0.0 --model qwen-tor-recommended --install
```

Build the real current package and install it locally:

```bash
npm run ai:addon:build -- --source /Users/visarutsankham/Downloads/billngai-ai-source --version 1.0.0 --model qwen-tor-recommended --pkg --install
```

Run syntax checks:

```bash
node --check main.js
node --check preload.js
node --check scripts/create-dev-ai-addon.js
node --check scripts/build-ai-addon.js
```

Extract and check the inline app script:

```bash
node -e "const fs=require('fs');const s=fs.readFileSync('billing.html','utf8');const m=s.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);if(!m)throw new Error('script not found');fs.writeFileSync('/tmp/billngai-script-check.js',m[1]);"
node --check /tmp/billngai-script-check.js
```

Start the app:

```bash
npm start
```

Then open `TOR → Invoice`.

## Manifest Shape

Current manifest shape:

```json
{
  "addon": "billngai-ai-tor",
  "name": "BillNgai AI Add-on",
  "version": "1.0.0",
  "model": "qwen-tor-recommended",
  "compatibleCore": ">=1.4.0",
  "features": ["tor_ai"],
  "offlineOnly": true,
  "files": [
    {
      "path": "runtime/bin/llama-cli",
      "size": 11314184,
      "sha256": "..."
    },
    {
      "path": "models/qwen-tor-recommended/Qwen2.5-3B-Instruct-Q4_K_M.gguf",
      "size": 1929903264,
      "sha256": "..."
    }
  ],
  "signature": "..."
}
```

The signature is computed over the canonical JSON manifest without the
`signature` field.

## Security Notes

The current dev private key is intentionally only for local prototyping. Do not
ship it in a production repository, app bundle, or add-on installer.

Production should use:

- public key embedded in BillNgai
- private key stored outside the repo, ideally in a release/signing machine or
  secret manager
- add-on package signed during release
- manifest hash checks for every model/runtime file

The app should keep the current rule: no in-app download, no online activation,
no model network fetch.

## Production Add-on Packaging Direction

Future package:

```text
BillNgai-AI-AddOn-Qwen3B-1.0.0.dmg
```

Current builder output:

```text
dist/ai-addons/
  BillNgai-AI-AddOn-qwen-tor-recommended-1.0.0/
    README.txt
    install.sh
    ai/
      addon.json
      runtime/
      models/
  BillNgai-AI-AddOn-qwen-tor-recommended-1.0.0.pkg
```

The folder is useful for inspection. The `.pkg` is the frictionless installer.

The PKG installer copies files to:

```text
/Library/Application Support/BillNgai/ai/
```

Expected structure:

```text
ai/
  addon.json
  runtime/
    bin/
      llama-cli
  models/
    qwen-tor-recommended/
      Qwen2.5-3B-Instruct-Q4_K_M.gguf
```

## Next Implementation Steps

Completed 2026-07-04 (second pass):

1. ~~PDF text extraction~~ — done without new dependencies: bundled `pdftotext`
   when present in the add-on `runtime/bin/`, otherwise macOS built-in PDFKit
   via `/usr/bin/osascript -l JavaScript` (works on every stock Mac).
2. ~~DOCX extraction~~ — macOS `textutil` (was already in place).
3. ~~Strict JSON schema~~ — `TOR_JSON_SCHEMA` in main.js passed to `llama-cli
   --json-schema` (grammar-constrained: output is ALWAYS valid JSON).
   `parseTorDraft()` sanitizes numbers/strings into a draft object.
4. ~~Review UI~~ — `renderAiDraftCard()` shows project/client/items/installments/
   questions; client "ต้องถามเพิ่ม" highlighted amber.
5. ~~Document creation after review~~ — `createDocFromAiDraft()` matches or
   creates the client, then opens the existing document editor prefilled
   (items, project, notes with payment terms + งวด) — nothing is saved until
   the human saves in the editor. `openDocEditor` gained an optional
   `presetMeta` 5th argument.
6. ~~Dev signing key~~ — removed from both scripts; loaded from
   `BILLNGAI_AI_PRIVATE_KEY` env or git-ignored `secrets/ai-dev-signing-key.pem`.
   A REAL production key pair must still be generated before public release
   (the current dev keypair should be treated as compromised since it was
   previously in working files).

Remaining:

1. ~~Generate production Ed25519 keypair~~ — done 2026-07-05: new keypair in
   git-ignored `secrets/ai-signing-key.pem`, public key embedded in main.js,
   add-on PKG re-signed and re-installed. Old dev-signed packages are now
   rejected by the app (by design).
2. Windows add-on story — first prep is done: app now checks Windows user/system
   add-on paths, looks for `runtime/bin/llama-cli.exe`, supports `pdftotext.exe`
   for PDF import, and the builder can emit a Windows install folder with
   `install.cmd` / `install.ps1`. Still remaining: build/test a real Windows
   `llama-cli.exe` package and create a customer-friendly signed installer.
3. Optional: auto-suggest แบ่งงวด from `installments` after the quotation
   is created.
4. Pricing/packaging decision for the premium add-on (DMG name, price point,
   honor-system flow on the website like the ฿59 core app).

## Current Verification Results

Completed during prototype setup:

- `node --check main.js`
- `node --check preload.js`
- `node --check scripts/create-dev-ai-addon.js`
- inline `billing.html` script syntax check
- dev manifest signature verified
- dev add-on file hashes verified
- renderer probe confirmed `TOR → Invoice` unlocks with the local add-on
- bundled `runtime/bin/llama-cli` smoke test returned Thai output
- installed user add-on smoke test returned Thai output
- rebuilt signed `.pkg` with real model and portable runtime

## Current Built Model Package

Switched 2026-07-05 to a Thai-specialized, commercially licensed model
(Qwen2.5-3B is research-license only — cannot be sold):

```text
Model: Typhoon2-3B-Instruct (SCB 10X, base Llama-3.2-3B)
Repository: mradermacher/llama3.2-typhoon2-3b-instruct-GGUF
File: llama3.2-typhoon2-3b-instruct.Q4_K_M.gguf (~1.9 GB)
License: Llama 3.2 Community License — commercial OK, requires
         "Built with Llama" attribution (shown in the AI view status line)
```

Prompting is template-agnostic: plain-text system prompt via `-sysf`,
TOR via `-f`; llama-cli applies each model's own chat template, so GGUF
models can be swapped without code changes. Bake-off vs Qwen2.5-3B on the
real TOR fixture: Typhoon was ~20% faster and more reliable on the
installment schedule; item granularity varies per run for both (human
reviews anyway). Old package archived at
~/Downloads/billngai-ai-source-archive/qwen-tor-recommended.

Original prototype model (for reference):

```text
Repository: bartowski/Qwen2.5-3B-Instruct-GGUF
File: Qwen2.5-3B-Instruct-Q4_K_M.gguf
Size: 1,929,903,264 bytes
SHA-256: 9c9f56a391a3abbd5b89d0245bf6106081bcc3173119d4229235dd9d23253f94
```

Runtime:

```text
Source: llama.cpp b9870 / revision 2d973636e292ee6f75fadcf08d29cb33511f509f
Build: static ggml, OpenSSL off, Metal off, Accelerate/CPU on
Binary: runtime/bin/llama-cli
Linked libraries: Apple system libraries only
```

Local source folder:

```text
/Users/visarutsankham/Downloads/billngai-ai-source
```

Built add-on package:

```text
/Users/visarutsankham/Documents/Personal-Project/Billiong-App/dist/ai-addons/BillNgai-AI-AddOn-qwen-tor-recommended-1.0.0
```

Built macOS installer:

```text
/Users/visarutsankham/Documents/Personal-Project/Billiong-App/dist/ai-addons/BillNgai-AI-AddOn-qwen-tor-recommended-1.0.0.pkg
```

Installed local test add-on:

```text
/Users/visarutsankham/Library/Application Support/BillNgai/ai
```

The PKG payload contains:

```text
addon.json
runtime/README.txt
models/qwen-tor-recommended/Qwen2.5-3B-Instruct-Q4_K_M.gguf
```

End-to-end verified 2026-07-04: real Qwen2.5-3B inference through
`--json-schema` produced a correct structured draft from a Thai TOR fixture
(client correctly distinguished from the procurement contact, 3 line items
totalling 135,000 THB, 30/40/30 installment schedule) in ~90s on CPU, and the
review → prefilled-editor flow was verified in the browser harness.
