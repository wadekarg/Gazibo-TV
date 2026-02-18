/**
 * M3U playlist text → array of channel objects parser.
 */
const M3UParser = (() => {
  // Category keyword matching (fallback when API category unavailable)
  const categoryKeywords = {
    news: ['news', 'akhbar', 'noticias', 'nouvelles', 'nachrichten', 'haber', 'warta', 'samachar', 'khabar'],
    sports: ['sport', 'cricket', 'football', 'soccer', 'tennis', 'nba', 'nfl', 'espn', 'star sports', 'willow'],
    entertainment: ['entertainment', 'general', 'comedy', 'drama', 'hd', 'star plus', 'colors', 'zee', 'sony'],
    music: ['music', 'mtv', 'vh1', 'song', 'sangeet', 'gaana'],
    kids: ['kids', 'cartoon', 'nick', 'disney', 'pogo', 'hungama', 'cbeebies', 'baby'],
    movies: ['movie', 'cinema', 'film', 'hbo', 'starz', 'showtime', 'plex'],
    documentary: ['documentary', 'discovery', 'national geographic', 'nat geo', 'history', 'animal planet', 'science'],
    religious: ['religious', 'god', 'church', 'bible', 'quran', 'prayer', 'spiritual', 'aastha', 'peace']
  };

  function guessCategory(name, groupTitle) {
    const text = `${name} ${groupTitle}`.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Parse M3U text into channel objects.
   * Now also extracts tvg-id for API enrichment.
   */
  function parse(text, countryCode) {
    const lines = text.split('\n');
    const channels = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        current = {};

        // Extract tvg-id (links to iptv-org API)
        const idMatch = line.match(/tvg-id="([^"]*)"/);
        current.tvgId = idMatch ? idMatch[1] : '';

        // Extract tvg-logo
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        current.logo = logoMatch ? logoMatch[1] : '';

        // Extract group-title
        const groupMatch = line.match(/group-title="([^"]*)"/);
        current.group = groupMatch ? groupMatch[1] : '';

        // Extract channel name (after the last comma)
        const commaIdx = line.lastIndexOf(',');
        current.name = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : 'Unknown';

        current.country = countryCode;
        current.category = guessCategory(current.name, current.group);

      } else if (current && line && !line.startsWith('#')) {
        current.url = line;
        if (current.name && current.url) {
          channels.push(current);
        }
        current = null;
      }
    }

    return channels;
  }

  return { parse, guessCategory };
})();
