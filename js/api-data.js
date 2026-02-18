/**
 * iptv-org API data loader.
 * Fetches channels.json, logos.json, and blocklist.json from the iptv-org API
 * and provides lookup functions for enriching M3U-parsed channels.
 */
const ApiData = (() => {
  const API_BASE = 'https://iptv-org.github.io/api';

  // Indexed data stores
  let channelsById = {};   // id → {name, country, categories, is_nsfw, ...}
  let logosById = {};      // id → logo URL (best quality)
  let dmcaBlocklist = new Set(); // channel IDs blocked by DMCA

  let loaded = false;

  // Normalize API category names to our filter pill categories
  const categoryMap = {
    'animation': 'kids',
    'auto': 'other',
    'business': 'news',
    'classic': 'entertainment',
    'comedy': 'entertainment',
    'cooking': 'entertainment',
    'culture': 'entertainment',
    'documentary': 'documentary',
    'education': 'documentary',
    'entertainment': 'entertainment',
    'family': 'entertainment',
    'general': 'entertainment',
    'kids': 'kids',
    'legislative': 'news',
    'lifestyle': 'entertainment',
    'movies': 'movies',
    'music': 'music',
    'news': 'news',
    'outdoor': 'entertainment',
    'relax': 'entertainment',
    'religious': 'religious',
    'science': 'documentary',
    'series': 'entertainment',
    'shop': 'other',
    'sports': 'sports',
    'travel': 'documentary',
    'weather': 'news',
    'xxx': 'other'
  };

  /**
   * Load all API data in parallel. Non-blocking — app works without it.
   */
  async function load() {
    try {
      const [channelsRes, logosRes, blocklistRes] = await Promise.allSettled([
        fetch(`${API_BASE}/channels.json`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/logos.json`).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/blocklist.json`).then(r => r.ok ? r.json() : [])
      ]);

      // Index channels by ID
      if (channelsRes.status === 'fulfilled' && Array.isArray(channelsRes.value)) {
        for (const ch of channelsRes.value) {
          if (ch.id) {
            channelsById[ch.id] = ch;
          }
        }
      }

      // Index logos by channel ID (pick first/best logo per channel)
      if (logosRes.status === 'fulfilled' && Array.isArray(logosRes.value)) {
        for (const logo of logosRes.value) {
          if (logo.channel && logo.url && !logosById[logo.channel]) {
            logosById[logo.channel] = logo.url;
          }
        }
      }

      // Build DMCA blocklist
      if (blocklistRes.status === 'fulfilled' && Array.isArray(blocklistRes.value)) {
        for (const entry of blocklistRes.value) {
          if (entry.channel) {
            dmcaBlocklist.add(entry.channel);
          }
        }
      }

      loaded = true;
      const chCount = Object.keys(channelsById).length;
      const logoCount = Object.keys(logosById).length;
      const dmcaCount = dmcaBlocklist.size;
      console.log(`[ApiData] Loaded: ${chCount} channels, ${logoCount} logos, ${dmcaCount} DMCA blocks`);
    } catch (err) {
      console.warn('[ApiData] Failed to load API data:', err);
    }
  }

  /**
   * Look up a channel by its tvg-id.
   */
  function getChannel(tvgId) {
    return channelsById[tvgId] || null;
  }

  /**
   * Get the best logo URL for a tvg-id.
   */
  function getLogo(tvgId) {
    return logosById[tvgId] || null;
  }

  /**
   * Check if a channel is DMCA-blocked.
   */
  function isDmcaBlocked(tvgId) {
    return dmcaBlocklist.has(tvgId);
  }

  /**
   * Check if a channel is NSFW.
   */
  function isNsfw(tvgId) {
    const ch = channelsById[tvgId];
    return ch ? ch.is_nsfw === true : false;
  }

  /**
   * Map API category to our app's filter categories.
   */
  function mapCategory(apiCategories) {
    if (!apiCategories || !Array.isArray(apiCategories) || apiCategories.length === 0) {
      return null;
    }
    // Use first category that maps
    for (const cat of apiCategories) {
      const mapped = categoryMap[cat.toLowerCase()];
      if (mapped) return mapped;
    }
    return 'other';
  }

  /**
   * Enrich a parsed channel object with API data.
   * Upgrades logo, category, and name where API data is better.
   */
  function enrich(channel) {
    if (!loaded || !channel.tvgId) return channel;

    const apiCh = channelsById[channel.tvgId];
    const apiLogo = logosById[channel.tvgId];

    if (apiCh) {
      // Upgrade category from API (more accurate than keyword guessing)
      const apiCategory = mapCategory(apiCh.categories);
      if (apiCategory) {
        channel.category = apiCategory;
      }
    }

    // Upgrade logo from API if current one is missing or broken
    if (apiLogo && !channel.logo) {
      channel.logo = apiLogo;
    }

    return channel;
  }

  /**
   * Enrich an array of channels and filter out NSFW + DMCA blocked.
   */
  function enrichAndFilter(channels) {
    if (!loaded) return channels;

    return channels
      .filter(ch => {
        if (!ch.tvgId) return true; // keep channels without tvg-id (can't check)
        if (isDmcaBlocked(ch.tvgId)) return false;
        if (isNsfw(ch.tvgId)) return false;
        return true;
      })
      .map(ch => enrich(ch));
  }

  function isLoaded() {
    return loaded;
  }

  return { load, isLoaded, getChannel, getLogo, isDmcaBlocked, isNsfw, enrich, enrichAndFilter };
})();
