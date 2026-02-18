/**
 * App initialization and bootstrap.
 */
(function () {
  const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour

  // Purge old cache keys from previous versions
  function purgeOldCache() {
    const oldPrefixes = ['gazibo_', 'gajibo_'];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && oldPrefixes.some(p => key.startsWith(p)) && !key.startsWith('gazibo_v2_')) {
        localStorage.removeItem(key);
      }
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    purgeOldCache();

    // Initialize modules
    UI.init();
    Player.init();
    Keyboard.init();

    // Load API data + local blocklist in parallel
    await Promise.allSettled([
      ApiData.load(),
      ChannelStore.loadBlocklist()
    ]);

    // Always fetch fresh from iptv-org on startup (clear cache for current country)
    ChannelStore.clearCache();

    // Load default country (India) — will hit network since cache was cleared
    await UI.selectCountry('in');

    // Check for new channels every hour
    setInterval(() => {
      console.log('[App] Hourly refresh — checking for new channels…');
      UI.refreshCurrentCountry();
    }, REFRESH_INTERVAL);
  });
})();
