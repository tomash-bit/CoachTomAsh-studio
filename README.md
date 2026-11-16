# CoachTomAsh Studio • Installable Football Session Planner

An offline-capable **Progressive Web App (PWA)** based on the CoachTomAsh Studio v1 local-first football coaching planner.

## Publish to GitHub Pages (free)

1. At <https://github.com/new> create a **Public** repository called `coachtomash-studio` and add a README if desired.
2. Extract `CoachTomAsh_Studio_PWA_GitHub_Pages.zip` onto your computer. From the repo page choose **Add file → Upload files**. Drag in all extracted files **and the `icons` folder**. Do not upload only the ZIP file. Commit changes.
3. Choose **Settings → Pages → Build and deployment → Deploy from a branch → `main` → `/(root)` → Save**.
4. Open `https://YOUR-GITHUB-USERNAME.github.io/coachtomash-studio/` (replace the placeholder with your own GitHub username).
5. iPad/iPhone: open in Safari and choose **Share → Add to Home Screen → Open as Web App → Add**. Android: Chrome menu → Install app. Computer: Chrome/Edge install option in address bar or browser menu.

## What stays private?

Your published **code** and initial example practice are publicly visible because your repo is public. Your *saved* practice library stays in local browser storage on the device. GitHub Pages does not receive the contents of local storage by default.

**Important:** Local libraries **do not automatically sync** between the original HTML file, the installed app, different browsers, or different devices. They are not password-protected and could be accessed by someone using the same browser profile/device. Do not publish your practice JSON backups or player/personal data to the repository. For real player information, confirm club policies and data-protection requirements first.

## Preserve existing practices

1. In the original CoachTomAsh Studio, select **Back up library** and keep the downloaded JSON file somewhere private.
2. Open the deployed/installed web app and select **Import backup**.
3. Verify your practices appear before deleting the original app/file. Keep regular JSON backups: deleting site data, browser storage or the installed app may remove the local library.

## Offline support

After the app has loaded online and the service worker has successfully installed, the app shell should be usable offline on supported browsers. **Test in airplane mode before relying on it pitch-side.** Local storage may be cleared by the device/browser under some conditions. Offline availability should not be treated as a backup.

## Updating later

Replace `index.html` (or other changed files) in GitHub and commit. When changing the service worker's precached resources, update the `CACHE_NAME` version string in `service-worker.js` to encourage a clean refresh on installed devices. Browser updates may take more than one launch. Back up practices before major updates.

## Included files

- `index.html`: application code and CoachTomAsh branding
- `manifest.webmanifest`: name, colours, icons and launch configuration
- `service-worker.js`: offline cache
- `icons/`: install / home-screen icons
- `.nojekyll`: publish plain static assets

No extra subscription, backend, account, or API key is required for this v1. GitHub Pages hosting for public repositories is available on the GitHub Free plan, subject to GitHub terms and usage limits.
