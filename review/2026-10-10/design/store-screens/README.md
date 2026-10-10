# BillNgai 2.0.15 store screenshot candidates — 2026-10-10

Captured from the final source plus the 44-point mobile touch-target fix on dedicated synthetic iPhone 18 Pro Max and iPad Pro 13-inch (M5) simulators. The UI audit passed for every included screen in Thai and English, light and dark. The corresponding release archive was rebuilt without audit scripts.

These are candidate App Store screenshots exported as opaque RGB JPEGs with no alpha channel. The sample records are synthetic (for example, "Synthetic client"); the owner approved the synthetic sample content on 2026-10-10. Mac screenshots were captured from the shared source Electron app in a real native window, not from the signed MAS package; compare them with the processed Mac build before upload. Mac Settings is intentionally absent because the direct and store channels differ there.

- `iphone/{th,en}/`: 1320 × 2868 pixels, iPhone 18 Pro Max (accepted large Dynamic Island size)
- `ipad13/{th,en}/`: 2064 × 2752 pixels, iPad Pro 13-inch (M5)
- `mac/{th,en}/`: 1440 × 900 pixels, real native-window capture of the shared source UI, three light and three dark screens per locale.
- Each iPhone/iPad locale has six light screens and three dark screens, at most nine per locale.
- The source UI audit JSON remains in `/private/tmp/BillNgai-2.0.15-store-shots/` for this session.
