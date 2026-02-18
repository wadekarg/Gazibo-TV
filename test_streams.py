#!/usr/bin/env python3
"""
Stream health checker for Gazibo TV.
Tests channel URLs from iptv-org and outputs a blocklist JSON of dead streams.
"""
import json
import re
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = 'https://iptv-org.github.io/iptv/countries/{}.m3u'
TIMEOUT = 8  # seconds per request
MAX_WORKERS = 30  # parallel connections


def parse_m3u(text, country_code):
    """Parse M3U text into channel dicts."""
    lines = text.split('\n')
    channels = []
    current = None
    for line in lines:
        line = line.strip()
        if line.startswith('#EXTINF:'):
            current = {}
            m = re.search(r'tvg-logo="([^"]*)"', line)
            current['logo'] = m.group(1) if m else ''
            m = re.search(r'group-title="([^"]*)"', line)
            current['group'] = m.group(1) if m else ''
            comma = line.rfind(',')
            current['name'] = line[comma + 1:].strip() if comma != -1 else 'Unknown'
            current['country'] = country_code
        elif current and line and not line.startswith('#'):
            current['url'] = line
            if current.get('name') and current.get('url'):
                channels.append(current)
            current = None
    return channels


def test_stream(channel):
    """Test if a stream URL is reachable. Returns (channel, is_working, status)."""
    url = channel['url']
    try:
        req = urllib.request.Request(url, method='GET')
        req.add_header('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) Gazibo-TV/1.0')
        req.add_header('Range', 'bytes=0-1023')  # only fetch first 1KB
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = resp.read(1024)
            status = resp.status
            # For m3u8, check if content looks like valid HLS
            if '.m3u8' in url or '.m3u' in url:
                text = data.decode('utf-8', errors='ignore')
                if '#EXTM3U' in text or '#EXTINF' in text or '#EXT-X' in text:
                    return (channel, True, f'OK ({status}, valid HLS)')
                elif status in (200, 206):
                    return (channel, True, f'OK ({status})')
                else:
                    return (channel, False, f'Invalid HLS content')
            elif status in (200, 206):
                return (channel, True, f'OK ({status})')
            else:
                return (channel, False, f'HTTP {status}')
    except urllib.error.HTTPError as e:
        return (channel, False, f'HTTP {e.code}')
    except urllib.error.URLError as e:
        return (channel, False, f'URL Error: {e.reason}')
    except Exception as e:
        return (channel, False, f'Error: {str(e)[:60]}')


def test_country(code):
    """Test all channels for a country. Returns (working, broken) lists."""
    print(f'\n{"=" * 60}')
    print(f'  Testing: {code.upper()}')
    print(f'{"=" * 60}')

    # Fetch playlist
    url = BASE_URL.format(code)
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 Gazibo-TV/1.0')
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f'  Failed to fetch playlist: {e}')
        return [], []

    channels = parse_m3u(text, code)
    print(f'  Found {len(channels)} channels')

    if not channels:
        return [], []

    working = []
    broken = []
    tested = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(test_stream, ch): ch for ch in channels}
        for future in as_completed(futures):
            ch, is_working, status = future.result()
            tested += 1
            marker = '  OK ' if is_working else '  FAIL'
            if is_working:
                working.append(ch)
            else:
                broken.append(ch)

            # Progress
            if tested % 20 == 0 or tested == len(channels):
                pct = tested / len(channels) * 100
                print(f'  Progress: {tested}/{len(channels)} ({pct:.0f}%) | Working: {len(working)} | Broken: {len(broken)}')

    print(f'\n  Results for {code.upper()}:')
    print(f'    Working: {len(working)}')
    print(f'    Broken:  {len(broken)}')
    print(f'    Total:   {len(channels)}')

    return working, broken


def main():
    countries = sys.argv[1:] if len(sys.argv) > 1 else ['us']
    all_broken_urls = []
    summary = {}

    start = time.time()

    for code in countries:
        working, broken = test_country(code.lower())
        all_broken_urls.extend(ch['url'] for ch in broken)
        summary[code.upper()] = {
            'total': len(working) + len(broken),
            'working': len(working),
            'broken': len(broken)
        }

    elapsed = time.time() - start

    # Save blocklist
    blocklist_path = 'blocklist.json'
    with open(blocklist_path, 'w') as f:
        json.dump({
            'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'total_broken': len(all_broken_urls),
            'urls': list(set(all_broken_urls))
        }, f, indent=2)

    print(f'\n{"=" * 60}')
    print(f'  SUMMARY')
    print(f'{"=" * 60}')
    for code, stats in summary.items():
        pct = stats['working'] / stats['total'] * 100 if stats['total'] else 0
        print(f'  {code}: {stats["working"]}/{stats["total"]} working ({pct:.0f}%)')
    print(f'\n  Time: {elapsed:.1f}s')
    print(f'  Blocklist saved to: {blocklist_path} ({len(all_broken_urls)} URLs)')


if __name__ == '__main__':
    main()
