/**
 * Channel data store: iptv-org single source, blocklist pre-filtering,
 * broken channel tracking, localStorage cache (6hr TTL, 4MB cap, LRU eviction).
 */
const ChannelStore = (() => {
  const BASE_URL = 'https://iptv-org.github.io/iptv/countries';

  const CACHE_PREFIX = 'gazibo_v2_';
  const BROKEN_KEY = 'gazibo_v2_broken';
  const CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour
  const MAX_CACHE_SIZE = 4 * 1024 * 1024; // 4MB
  const BROKEN_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // In-memory cache
  const memoryCache = new Map();
  const accessOrder = [];

  // Broken channel tracker {url: timestamp}
  let brokenChannels = loadBrokenChannels();

  // Pre-tested blocklist (loaded from blocklist.json)
  let blocklist = new Set();

  function cacheKey(countryCode) {
    return CACHE_PREFIX + countryCode;
  }

  function getCacheSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX) && key !== BROKEN_KEY) {
        total += localStorage.getItem(key).length * 2;
      }
    }
    return total;
  }

  function evictLRU() {
    while (getCacheSize() > MAX_CACHE_SIZE && accessOrder.length > 0) {
      const oldest = accessOrder.shift();
      localStorage.removeItem(cacheKey(oldest));
    }
  }

  function saveToCache(countryCode, channels) {
    const key = cacheKey(countryCode);
    const data = JSON.stringify({ ts: Date.now(), channels });
    try {
      evictLRU();
      localStorage.setItem(key, data);
      const idx = accessOrder.indexOf(countryCode);
      if (idx !== -1) accessOrder.splice(idx, 1);
      accessOrder.push(countryCode);
    } catch (e) {
      if (accessOrder.length > 0) {
        accessOrder.shift();
        try { localStorage.setItem(key, data); } catch (_) {}
      }
    }
  }

  function loadFromCache(countryCode, allowStale = false) {
    const key = cacheKey(countryCode);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const age = Date.now() - data.ts;
      if (!allowStale && age > CACHE_TTL) return null;
      const idx = accessOrder.indexOf(countryCode);
      if (idx !== -1) accessOrder.splice(idx, 1);
      accessOrder.push(countryCode);
      return data.channels;
    } catch {
      return null;
    }
  }

  // --- Blocklist ---

  async function loadBlocklist() {
    try {
      const response = await fetch('blocklist.json');
      if (!response.ok) return;
      const data = await response.json();
      if (data.urls && Array.isArray(data.urls)) {
        blocklist = new Set(data.urls);
      }
    } catch {
      // Blocklist is optional
    }
  }

  function applyBlocklist(channels) {
    if (blocklist.size === 0) return channels;
    return channels.filter(ch => !blocklist.has(ch.url));
  }

  // --- Broken channel tracking ---

  function loadBrokenChannels() {
    try {
      const raw = localStorage.getItem(BROKEN_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      const now = Date.now();
      const pruned = {};
      for (const [url, ts] of Object.entries(data)) {
        if (now - ts < BROKEN_TTL) pruned[url] = ts;
      }
      return pruned;
    } catch {
      return {};
    }
  }

  function saveBrokenChannels() {
    try {
      localStorage.setItem(BROKEN_KEY, JSON.stringify(brokenChannels));
    } catch {}
  }

  function markBroken(url) {
    brokenChannels[url] = Date.now();
    saveBrokenChannels();
  }

  function isBroken(url) {
    if (blocklist.has(url)) return true;
    const ts = brokenChannels[url];
    if (!ts) return false;
    if (Date.now() - ts > BROKEN_TTL) {
      delete brokenChannels[url];
      return false;
    }
    return true;
  }

  function clearBroken() {
    brokenChannels = {};
    saveBrokenChannels();
  }

  // --- Fetching ---

  async function fetchChannels(code) {
    const playlistCode = Countries.toPlaylistCode(code);
    const url = `${BASE_URL}/${playlistCode}.m3u`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return M3UParser.parse(text, code);
  }

  function sortByHealth(channels) {
    return channels.sort((a, b) => {
      const aBroken = isBroken(a.url) ? 1 : 0;
      const bBroken = isBroken(b.url) ? 1 : 0;
      return aBroken - bBroken;
    });
  }

  /**
   * Fetch channels for a country, filter blocklist, enrich with API, and sort.
   * Fallback chain: in-memory → localStorage (fresh) → network → localStorage (stale)
   */
  async function getChannels(countryCode) {
    const code = countryCode.toLowerCase();

    // 1. In-memory cache
    if (memoryCache.has(code)) {
      return sortByHealth(memoryCache.get(code));
    }

    // 2. Fresh localStorage
    const cached = loadFromCache(code, false);
    if (cached) {
      const filtered = applyBlocklist(cached);
      const enriched = ApiData.enrichAndFilter(filtered);
      memoryCache.set(code, enriched);
      return sortByHealth(enriched);
    }

    // 3. Network fetch
    try {
      const channels = await fetchChannels(code);
      const filtered = applyBlocklist(channels);
      const enriched = ApiData.enrichAndFilter(filtered);
      memoryCache.set(code, enriched);
      saveToCache(code, enriched);
      return sortByHealth(enriched);
    } catch (err) {
      // 4. Stale localStorage fallback
      const stale = loadFromCache(code, true);
      if (stale) {
        const filtered = applyBlocklist(stale);
        const enriched = ApiData.enrichAndFilter(filtered);
        memoryCache.set(code, enriched);
        return sortByHealth(enriched);
      }
      throw err;
    }
  }

  /**
   * Force-refresh channels from network, bypassing all caches.
   * Returns the new channel list, or null if fetch failed (keeps existing data).
   */
  async function refreshChannels(countryCode) {
    const code = countryCode.toLowerCase();
    try {
      const channels = await fetchChannels(code);
      const filtered = applyBlocklist(channels);
      const enriched = ApiData.enrichAndFilter(filtered);
      memoryCache.set(code, enriched);
      saveToCache(code, enriched);
      return sortByHealth(enriched);
    } catch {
      return null; // keep existing data on failure
    }
  }

  function getCategories(channels) {
    const cats = new Set();
    channels.forEach(ch => cats.add(ch.category));
    return [...cats].sort();
  }

  function filterChannels(channels, { search = '', category = 'all' } = {}) {
    let result = channels;
    if (category && category !== 'all') {
      result = result.filter(ch => ch.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(ch =>
        ch.name.toLowerCase().includes(q) ||
        ch.group.toLowerCase().includes(q)
      );
    }
    return result;
  }

  function clearCache() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    memoryCache.clear();
    accessOrder.length = 0;
  }

  return {
    getChannels, refreshChannels, getCategories, filterChannels, clearCache,
    loadBlocklist, markBroken, isBroken, clearBroken
  };
})();
