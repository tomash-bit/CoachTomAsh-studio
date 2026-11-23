# CoachTomAsh Studio v1.11.1 Elite Workspace

A non-destructive visual refinement of the v1.11 compact designer.

## Install
1. Export a JSON backup from your existing installed app.
2. Upload the four update files (`index.html`, `compact-workspace.js`, `compact-workspace.css`, `service-worker.js`) to the root of your GitHub Pages repository, replacing the existing files.
3. Wait for GitHub Pages to deploy. Open your site online with `?v=1111` once, then reopen the installed iPad PWA.
4. If the old UI persists, close and reopen the installed app after online loading.

## What changed
- Tool sidebar narrowed to a 104-118 px rail on tablets/desktops.
- Tool category and object actions use compact icon-first buttons.
- All player colours live in a collapsible Colours menu, with the existing swatches and handlers preserved.
- Object label, equipment rotation, goal sizing, curved-arrow editing, formation templates and other detailed controls are grouped in an on-demand Object & formation settings menu.
- Pitch gains horizontal space. Practice details drawer, session builder and animation workflow are unchanged.
- Existing application state schema and storage code are untouched.

## iPad acceptance
- Verify the new narrow rail, all four categories and colour selection.
- Select, place, drag and recolour home, opponent and neutral players.
- Open Object & formation settings and test formations, goal rotation/resize and curved paths.
- Open Practice details and save/reopen a note.
- Verify animation playback, GIF export, session builder and offline use.
- Export and re-import a JSON backup only after safeguarding existing data.

## Test status
- JavaScript syntax check and 15 Node automated tests pass.
- Physical-device browser interaction and visual acceptance are pending. Local Chromium navigation was blocked by the environment.
