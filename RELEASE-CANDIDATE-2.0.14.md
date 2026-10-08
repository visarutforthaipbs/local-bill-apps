# BillNgai 2.0.14 — private release candidate

Status (2026-10-07): **work resumed; packages rebuilt from the current source are listed in `APP-STORE-SUBMISSION-2.0.14.md`, which supersedes the artifact table below. Nothing uploaded; not approved for public release or App Review.** Worktree is uncommitted
`codex/integrated-data-revamp`; base HEAD does not identify its new source files.
Current evidence and continuation live in `../handoff.md` and
`docs/INTEGRATED-DATA-ACCEPTANCE-2026-10-04.md`.

The candidate combines the 2.0.13 desktop clay baseline, canonical payment-review
matching/causal conflicts, atomic local SQLite storage and recovery, and the
existing Apple app's mobile extension. It retains the orange/cream brand, original
financial records and frozen print layout. No new SKU or Pro purchase product.

## Prepared artifacts

| Channel | Artifact / verification | Publication |
| --- | --- | --- |
| Direct Mac | `dist-rollout-2.0.14/BillNgai-2.0.14-universal.dmg`; arm64/x86_64, Developer ID/hardened, notarized and stapled, Gatekeeper accepts; exact packaged synthetic legacy-review test passes | Private only |
| Mac App Store | `dist-rollout-mas-2.0.14-final/mas-universal/BillNgai-2.0.14-universal.pkg`; existing bundle, Apple distribution/installer signatures and sandbox/team checked; exact Apple renderer/source allowlist checked; Apple `altool --validate-app` accepts without errors | Not uploaded |
| Windows | PC build `dist-sqlite-2.0.14/BillNgai-2.0.14-x64-Setup.exe`; native SQLite tests and packaged legacy review pass; version2.0.14.0; **NotSigned** | Private unsigned Beta candidate |
| iOS | Earlier2.0.14/build2 App Store archive/IPA signed/exported with production identity/config and no QA resources | Superseded by later adoption/recovery/UI edits; rebuild before upload |

Final Mac DMG SHA256:
`71807925c4fd86d54285f4137f2cdd98bdfcd57d4b83af9424f041af3e7bc2d5`
(231153784 bytes). Its blockmap was regenerated after stapling against those exact bytes.

MAS pkg SHA256:
`599068597bae3db045b00e5ce35e1f5d4470abb465dd586dbb84c0988216a568`
(227543642 bytes).

Windows installer SHA256:
`d37b4fb175aa335619ab1ed029f3eec5eedc1e28b59f06c8f193e9e55e94f94e`
(110354057 bytes).

These desktop artifacts match their checked source at build time. Further shared
storage/sync edits require rebuilding all affected channels; do not label an old
candidate as containing later source changes.

## Accepted live evidence

- Isolated control Mac, field Mac, Windows and physical iPhone reach the same
  workspace records/cursor7/digest after explicit conflict/review resolution.
  Windows offline edits survive, concurrent remote edits remain reviewable, and
  synthetic receipt income is counted once. Desktop harnesses use native source
  Electron; packaged MAS is still a separate live acceptance gate.
- Existing genuine Apple Pro ownership and actual Restore Purchases pass on the
  physical production-identity DEBUG app, with the isolated QA backend verifying
  official online OCSP and a matching current transaction from Apple. No local
  flag/allowlist grants this access. This does not certify a new TestFlight
  purchase, deferred/canceled purchase, refund or expired-lease scenario.
- Physical A4 fit/zoom/native sharing and maximum text/VoiceOver geometry pass.
  Owner confirms spoken client-name/Notes/Cancel/Save are announced and reachable.
- Physical client/recurring draft termination, recovery, save and second relaunch
  pass without duplicate records or changed financial documents.
- Explicit local-backup restore passes on a separate unbound synthetic phone
  profile, retaining original records and making the pre-restore safety copy.

Evidence is private at `~/.local/state/billngai-rollout-2026-10-04/`; no customer
records, secrets or signing files belong in release attachments or worker context.

## Gates before production/App Review

1. Complete remaining public-mobile PRD workflows: portable import/recovery,
   automatic verified asset transfer, large workspace bootstrap/performance and
   interrupted populated-device adoption. Preserve strict validation and immutable
   financial facts; a feature hiding a capability is not completion.
2. Complete physical full software-keyboard and iPad checks, plus live packaged
   MAS/TestFlight purchase/account/lease/refund acceptance. Do not count the keyboard
   result whose `violations` says the keyboard never opened as a pass.
3. Rebuild/validate final iOS archive and any affected desktop packages; prepare
   correct existing-app version metadata, privacy answers, review notes and media.
4. Review compatible backend/client rollout, configure production purchase secrets
   only after acceptance, then explicitly upgrade the synthetic test workspace.
5. Only then plan backed-up owner migration and release. Owner income[owner total redacted],
   original documents and five unresolved historical groups remain unchanged.

Public desktop2.0.13 and previously submitted MAS2.0.12/build2.0.9 remain unchanged.
