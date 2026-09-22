# macOS signing and notarization

Updated 22 September 2026 for electron-builder 26.15.3. Use the existing Developer
ID Application certificate and App Store Connect API key. No replacement key or
private-certificate export is needed on this Mac.

`package.json` enables hardened runtime, existing direct-channel entitlements and
DMG signing. MAS uses separate entitlements, provisioning and certificates.

## Credentials

| Variable | Value |
| --- | --- |
| `CSC_LINK` | Optional .p12 path/base64 for CI; omit with the existing Keychain identity |
| `CSC_KEY_PASSWORD` | Password of that optional .p12 |
| `APPLE_API_KEY` | Local path to the .p8 file, never raw key contents |
| `APPLE_API_KEY_ID` | Key ID for the .p8 |
| `APPLE_API_ISSUER` | App Store Connect team Issuer ID |

The installed builder passes `APPLE_API_KEY` as a file path. It does not use the
previously documented `APPLE_API_KEY_PATH`. Keep credentials outside Git and
never print them in logs or paste them into release evidence.

## Container notarization

Build the signed app and DMG using `DEPLOYMENT.md`. Its manual route defers
notarization with `-c.mac.notarize=false`; publishing still requires notarization.

```sh
xcrun notarytool submit dist/VERSION/BillNgai-VERSION-universal.dmg --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" --output-format json
xcrun notarytool wait SUBMISSION_ID --key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER" --output-format json
xcrun stapler staple dist/VERSION/BillNgai-VERSION-universal.dmg
xcrun stapler validate dist/VERSION/BillNgai-VERSION-universal.dmg
spctl --assess --type open --context context:primary-signature --verbose=2 dist/VERSION/BillNgai-VERSION-universal.dmg
```

Wait for Accepted and inspect the submission log before stapling. Verify the app
with `codesign --verify --deep --strict` and `spctl --assess --type execute
--verbose=2`. Run the native smoke test from a read-only mount. Recompute
checksums/metadata after stapling and record the final bytes in release evidence.

Notarization does not replace functional testing. Do not dismiss an actual
malware/damaged-app warning as a routine installation step.

References: [Apple container distribution](https://developer.apple.com/documentation/xcode/packaging-mac-software-for-distribution),
[electron-builder macOS configuration](https://www.electron.build/mac.html).
