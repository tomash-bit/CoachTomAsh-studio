# CoachTomAsh Studio v1.2 — Diagram Editor Upgrade

Installable, offline-capable football session planner designed for GitHub Pages.

## Changes from v1.1.1
- New **Full goal** button alongside **Mini goal**.
- Select equipment to reveal touch-friendly rotation controls: ±15°, ±45°, presets (0/90/180/270°), and an exact-angle input.
- Goal rotation and rotation of cones, mannequins, zones, and text.
- Rotation included in interactive pitch, SVG, PNG, printable plans, animation playback, and animated GIFs.
- Same `coachtomash-studio-v1` localStorage key and practice JSON shape (optional `rotation` property).
- Cache upgraded to `coachtomash-studio-assets-v1-2`; existing local library not modified.
- All existing v1.1.1 features retained: timeline, 10/20/30 FPS GIF export, backup/import, offline.

## Deploy existing GitHub repository
1. Back up your library to a JSON file first.
2. In GitHub repository `tomash-bit/CoachTomAsh-studio`, on `main`, replace root `index.html` and root `service-worker.js`. **Do not overwrite your library backup**.
3. Leave `v11-enhancements.js`, `manifest.webmanifest` and `icons/` intact. The 3-file update package also includes unchanged `v11-enhancements.js` for convenience.
4. Commit the changes. Wait for **Actions > pages build and deployment** to succeed.
5. Open https://tomash-bit.github.io/CoachTomAsh-studio/?v=120 in Safari while online, refresh once, then reopen the Home Screen app. Do not uninstall or clear browser data.
6. Verify the app works offline after first online visit.

## Verification
See TEST_NOTES.md for browser test results and a post-deployment iPad checklist.
