# Gazibo TV

A beautiful, TV-like web interface for watching free IPTV channels from around the world. No sign-ups, no downloads - just open and watch.

**[Live Demo](https://wadekarg.github.io/Gazibo-TV)**

![Gazibo TV Screenshot](screenshots/preview.png)

## Features

- 8,000+ free channels from 40+ countries
- Dark theme with glass-morphism UI
- Channel data sourced from [iptv-org/iptv](https://github.com/iptv-org/iptv) - the largest community-maintained IPTV playlist
- Enriched with [iptv-org API](https://github.com/iptv-org/api) for accurate logos, categories, and metadata
- NSFW and DMCA-blocked channels automatically filtered out
- Pre-tested blocklist removes known broken streams (auto-updated weekly via GitHub Actions)
- Auto-skip broken channels with 5-second countdown
- Broken stream tracking - remembers failed channels so they appear last
- Country tabs with flag emojis (India & USA pinned first)
- Category filters: News, Sports, Entertainment, Music, Kids, Movies, Documentary, Religious
- Search across channel names and groups
- HLS.js video player with Safari native fallback
- Keyboard navigation for a true TV experience
- Auto-refresh every hour to pick up newly added channels
- Responsive design: desktop, tablet, and mobile
- No frameworks, no build tools - pure HTML + CSS + JavaScript

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Up` / `Down` | Previous / Next channel (in player) |
| `Left` / `Right` | Navigate channel grid |
| `Enter` | Play focused channel |
| `Escape` | Close player / Clear search |
| `/` | Focus search box |
| `f` | Toggle fullscreen |

## Quick Start

### Option 1: GitHub Pages (Recommended)

Just visit the live demo link above. Nothing to install.

### Option 2: Run Locally

```bash
git clone https://github.com/wadekarg/Gazibo-TV.git
cd Gazibo-TV
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

> **Note:** Opening `index.html` directly won't work due to CORS restrictions on API fetches. You need a local server.

## How It Works

```
Startup
  |
  +--> Load iptv-org API (channels.json, logos.json, blocklist.json)
  +--> Load local blocklist.json (pre-tested broken streams)
  |
  +--> Fetch M3U playlist from iptv-org.github.io/iptv/countries/{code}.m3u
  |
  +--> Parse M3U --> Extract tvg-id, name, logo, group, URL
  |
  +--> Enrich with API data (better logos, accurate categories)
  |
  +--> Filter out: NSFW + DMCA blocked + broken streams
  |
  +--> Render channel grid
  |
  +--> Every 1 hour: silently re-fetch and update grid
```

## Project Structure

```
Gazibo-TV/
  index.html              -- Single-page app
  css/styles.css          -- Dark theme, glass-morphism, responsive grid
  js/
    countries.js          -- Country code/name map, flag emoji helper
    m3u-parser.js         -- M3U text to channel object parser
    api-data.js           -- iptv-org API loader (channels, logos, DMCA blocklist)
    channel-store.js      -- Fetch, cache, filter, broken tracking
    player.js             -- HLS.js wrapper with auto-skip
    ui.js                 -- DOM rendering, tabs, grid, filters, search
    keyboard.js           -- Keyboard navigation
    app.js                -- Init and bootstrap
  blocklist.json          -- Pre-tested broken stream URLs (auto-updated weekly)
  test_streams.py         -- Stream health checker script
  .github/workflows/
    deploy.yml            -- GitHub Pages deployment
    update-blocklist.yml  -- Weekly blocklist refresh
```

## Tech Stack

- **Frontend:** Pure HTML5 + CSS3 + JavaScript (ES6+)
- **Video:** [HLS.js](https://github.com/video-dev/hls.js/) via CDN
- **Data:** [iptv-org/iptv](https://github.com/iptv-org/iptv) + [iptv-org/api](https://github.com/iptv-org/api)
- **Hosting:** GitHub Pages (free)
- **CI/CD:** GitHub Actions

## Updating the Blocklist

The blocklist is automatically updated every Sunday via GitHub Actions. To update manually:

```bash
python3 test_streams.py us in uk ca au de fr br mx jp kr es it pk bd ru tr ae sa eg za ph id th vn pl nl pt ar co
```

This tests every stream URL across 30 countries and saves broken ones to `blocklist.json`.

## Contributing

Contributions are welcome! Here's how:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Test locally with `python3 -m http.server 8080`
5. Commit (`git commit -m 'Add my feature'`)
6. Push (`git push origin feature/my-feature`)
7. Open a Pull Request

### Ideas for contributions
- Add EPG (Electronic Program Guide) support
- Add channel favorites / bookmarks
- Add picture-in-picture mode
- Add Chromecast support
- Improve category detection
- Add more countries to the blocklist test

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- Channel data: [iptv-org/iptv](https://github.com/iptv-org/iptv) community
- Video player: [HLS.js](https://github.com/video-dev/hls.js/)

## Disclaimer

This project does not host any video content. It simply provides an interface to publicly available IPTV streams aggregated by the [iptv-org](https://github.com/iptv-org) community. All channel data and streams are sourced from third parties. If you believe any content infringes on your rights, please report it to [iptv-org/database](https://github.com/iptv-org/database/issues).
