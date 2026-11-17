# CoachTomAsh Studio v1.2 — automated verification

Completed on 16 November 2026, using headless Chromium, a simulated iPad-sized touchscreen, Pillow image decoding and a mock service worker.

## Passing tests
1. Existing v1 localStorage content and previously saved session loads unchanged with the same `coachtomash-studio-v1` key.
2. Full goal button visible; tapping pitch creates a `fullgoal` equipment object; rotation control appears.
3. ±15°, ±45°, 0/90/180/270° presets, and exact typed angles work, with undo-aware persistence.
4. Rotation is saved in the current frame, copied when creating a new frame, and interpolated along the shortest arc during animation playback.
5. Saved angles survive re-opening the app in a fresh browser page with the prior local data.
6. SVG export includes rotated goal geometry; PNG export renders successfully at 1800 × 1170.
7. 20 FPS animated GIF export decodes, has multiple frames, and visually differs between first and final frames.
8. JSON backup export retains the original `coachtomash-studio-v1` format and includes optional rotation fields.
9. Existing v1 JSON backup imports successfully; legacy mini goals (`type: goal`, no `rotation`) still render at 0°.
10. Branded printable session plan includes rotated goal positions.
11. Simulated iPad-touch interaction places and rotates a mini goal; the rotation panel and CoachTomAsh branding render.
12. Mocked service-worker install/activate/offline-navigation/offline-script checks pass with new v1.2 cache name.
13. ZIP archive integrity checked; both deployment ZIPs pass CRC testing.

## On-device acceptance still required
After updating your live GitHub Pages installation, verify on your actual iPad: old library appears, rotated mini/full goals survive app restart, GIF export to Files works, and the app reopens offline. The browser simulation cannot fully guarantee Safari/iPad OS behaviour.

## Deployment
Upload the extracted root files from `CoachTomAsh_Studio_v1.2_Update_3Files.zip` to your existing repository `tomash-bit/CoachTomAsh-studio` main branch. The full ZIP includes all deployable files and these notes.
