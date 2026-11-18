
// PWA-only code; the existing planner and local storage format are unchanged.
(() => {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', {scope:'./'})
        .catch(error => console.warn('Offline support unavailable:', error));
    });
  }
  const installButton = document.getElementById('installAppBtn');
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  if (installButton) installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    try { await prompt.prompt(); } catch (error) { console.warn('Install prompt unavailable:', error); }
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (installButton) installButton.hidden = true;
  });
})();
