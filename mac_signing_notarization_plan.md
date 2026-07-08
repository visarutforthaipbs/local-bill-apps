# macOS Code Signing & Notarization Plan for BillNgai

This document compares your proposed macOS distribution roadmap with the current architecture of **BillNgai** (which uses `electron-builder` v24) and details the exact changes needed to enable secure distribution.

---

## 🔍 Comparison: Roadmap vs. Current App Setup

Here is how each step in your roadmap aligns with the current state of **BillNgai**:

| Roadmap Step | Description | BillNgai Current State | Actions Required |
| :--- | :--- | :--- | :--- |
| **1. Apple Developer Program** | Sign up ($99/year) | External account setup | None (Account level). |
| **2. Generate Certificate** | Developer ID Application | External certificate setup | None (Developer Portal level). |
| **3. Export Certificate** | Export to `.p12` file | No cert configured | Export as `.p12` and secure it. |
| **4. Create API Key** | App Store Connect API Key (`.p8`) | No credentials set up | Generate `.p8` key in App Store Connect. |
| **5. Environment Variables** | Config environment variables | Default `electron-builder` build script relies on system keychain or variables | Map environment variables specifically for `electron-builder` (see below). |
| **6. Build & Notarize** | Execute build & notarize | `"identity": null` explicitly skips signing, no notarization configured | 1. Remove `"identity": null` for signed builds.<br>2. Add `hardenedRuntime`, `gatekeeperAssess`, `notarize` properties to `package.json`.<br>3. Add `build/entitlements.mac.plist`. |

---

## 🛠️ Step-by-Step Implementation for BillNgai

### 1. Environment Variable Mapping
The environment variables used by `electron-builder` differ slightly from the general keys in your roadmap. Here is the exact mapping:

| Roadmap Variable | `electron-builder` Equivalent | Description |
| :--- | :--- | :--- |
| `APPLE_CERTIFICATE` (base64) | **`CSC_LINK`** | Path to `.p12` file (local path, `file://`, HTTPS URL, or raw base64 string). |
| `APPLE_CERTIFICATE_PASSWORD` | **`CSC_KEY_PASSWORD`** | Password of the `.p12` certificate. |
| `APPLE_API_ISSUER` | **`APPLE_API_ISSUER`** | App Store Connect Issuer ID (UUID). |
| `APPLE_API_KEY` (Key ID) | **`APPLE_API_KEY_ID`** | App Store Connect 10-char Key ID (e.g. `XX123456XX`). |
| `.p8` Key File Content | **`APPLE_API_KEY`** | Raw string contents of the downloaded `.p8` file (starting with `-----BEGIN PRIVATE KEY-----`). |
| *or* `.p8` Key File Path | **`APPLE_API_KEY_PATH`** | Alternatively, path to the locally saved `.p8` file. |

---

### 2. Required Configuration Changes

#### A. Create Entitlements file (`build/entitlements.mac.plist`)
For distribution outside the Mac App Store (Direct DMG), the app should **not** be sandboxed (which would block local database files and folder backups). However, we must bypass specific Hardened Runtime restrictions to keep Electron helper processes from crashing:

Create [build/entitlements.mac.plist](file:///Users/visarutsankham/Documents/Personal-Project/Billiong-App/build/entitlements.mac.plist):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <!-- Essential for Electron/V8 engine execution under Hardened Runtime -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-shared-cache</key>
    <true/>
    <!-- Prevents third-party unsigned native helpers from crashing if imported -->
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
  </dict>
</plist>
```

#### B. Update `package.json` Build Configurations
We need to remove `"identity": null` (which completely disables signing) and tell `electron-builder` to trigger notarization and hardened runtime during the build.

Modify `"build"` in [package.json](file:///Users/visarutsankham/Documents/Personal-Project/Billiong-App/package.json):
```diff
     "mac": {
       "icon": "build/icon.icns",
       "category": "public.app-category.finance",
-      "identity": null,
+      "hardenedRuntime": true,
+      "gatekeeperAssess": false,
+      "entitlements": "build/entitlements.mac.plist",
+      "entitlementsInherit": "build/entitlements.mac.plist",
+      "notarize": true,
       "target": [
         {
           "target": "dmg",
```

> [!NOTE]
> When `notarize` is set to `true`, `electron-builder` automatically leverages `@electron/notarize` internally to run Apple's `notarytool` when it detects `APPLE_API_ISSUER`, `APPLE_API_KEY_ID`, and `APPLE_API_KEY` (or `APPLE_API_KEY_PATH`) in the environment.

---

### 3. Dynamic Local vs. Production Builds

If you remove `"identity": null` from `package.json`, local builds might fail if you don't have developer certificates loaded in your keychain. 

To resolve this, we can split your package scripts to allow **unsigned/ad-hoc builds for testing** and **signed builds for distribution**:

Modify `"scripts"` in [package.json](file:///Users/visarutsankham/Documents/Personal-Project/Billiong-App/package.json):
```diff
     "pack": "electron-builder --dir",
-    "dist": "electron-builder --mac",
+    "dist": "electron-builder --mac",
+    "dist:unsigned": "CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --mac -c.mac.identity=null -c.mac.notarize=false",
     "dist:mas": "electron-builder --mac mas"
```

*   `npm run dist:unsigned`: Keeps building the unsigned universal DMG (exactly as it does now) so you can test packaging without Apple certificates.
*   `npm run dist`: Builds a signed, hardened, and notarized universal DMG for production release.

---

### 4. Updating the Handoff Documentation (`CLAUDE.md`)

Update the "Release routine" section inside [CLAUDE.md](file:///Users/visarutsankham/Documents/Personal-Project/Billiong-App/CLAUDE.md) to reflect this new capability:

```diff
-  5. `npm run dist` → `dist/BillNgai-<version>-universal.dmg` (universal, unsigned —
-     `identity: null`; users right-click → Open past Gatekeeper)
+  5. Release packaging:
+     - Unsigned releases: `npm run dist:unsigned` → `dist/BillNgai-<version>-universal.dmg` (requires right-click to open)
+     - Notarized production releases: Export environment secrets, then run `npm run dist` (produces fully signed and notarized DMG)
```
