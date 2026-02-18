/**
 * Country code → name mapping and flag emoji helper.
 */
const Countries = (() => {
  const map = {
    af: 'Afghanistan', al: 'Albania', dz: 'Algeria', ad: 'Andorra', ao: 'Angola',
    ar: 'Argentina', am: 'Armenia', au: 'Australia', at: 'Austria', az: 'Azerbaijan',
    bh: 'Bahrain', bd: 'Bangladesh', by: 'Belarus', be: 'Belgium', bz: 'Belize',
    bo: 'Bolivia', ba: 'Bosnia', br: 'Brazil', bg: 'Bulgaria', kh: 'Cambodia',
    cm: 'Cameroon', ca: 'Canada', cl: 'Chile', cn: 'China', co: 'Colombia',
    cr: 'Costa Rica', hr: 'Croatia', cu: 'Cuba', cy: 'Cyprus', cz: 'Czechia',
    dk: 'Denmark', do: 'Dominican Rep.', ec: 'Ecuador', eg: 'Egypt', sv: 'El Salvador',
    ee: 'Estonia', et: 'Ethiopia', fi: 'Finland', fr: 'France', ge: 'Georgia',
    de: 'Germany', gh: 'Ghana', gr: 'Greece', gt: 'Guatemala', hn: 'Honduras',
    hk: 'Hong Kong', hu: 'Hungary', is: 'Iceland', in: 'India', id: 'Indonesia',
    ir: 'Iran', iq: 'Iraq', ie: 'Ireland', il: 'Israel', it: 'Italy',
    jm: 'Jamaica', jp: 'Japan', jo: 'Jordan', kz: 'Kazakhstan', ke: 'Kenya',
    kw: 'Kuwait', kg: 'Kyrgyzstan', la: 'Laos', lv: 'Latvia', lb: 'Lebanon',
    ly: 'Libya', lt: 'Lithuania', lu: 'Luxembourg', mo: 'Macao', mk: 'N. Macedonia',
    my: 'Malaysia', mv: 'Maldives', mx: 'Mexico', md: 'Moldova', mn: 'Mongolia',
    me: 'Montenegro', ma: 'Morocco', mz: 'Mozambique', mm: 'Myanmar', np: 'Nepal',
    nl: 'Netherlands', nz: 'New Zealand', ni: 'Nicaragua', ng: 'Nigeria', no: 'Norway',
    om: 'Oman', pk: 'Pakistan', ps: 'Palestine', pa: 'Panama', py: 'Paraguay',
    pe: 'Peru', ph: 'Philippines', pl: 'Poland', pt: 'Portugal', qa: 'Qatar',
    ro: 'Romania', ru: 'Russia', rw: 'Rwanda', sa: 'Saudi Arabia', rs: 'Serbia',
    sg: 'Singapore', sk: 'Slovakia', si: 'Slovenia', so: 'Somalia', za: 'South Africa',
    kr: 'South Korea', es: 'Spain', lk: 'Sri Lanka', sd: 'Sudan', se: 'Sweden',
    ch: 'Switzerland', sy: 'Syria', tw: 'Taiwan', tj: 'Tajikistan', tz: 'Tanzania',
    th: 'Thailand', tn: 'Tunisia', tr: 'Turkey', tm: 'Turkmenistan', ug: 'Uganda',
    ua: 'Ukraine', ae: 'UAE', gb: 'United Kingdom', us: 'United States',
    uy: 'Uruguay', uz: 'Uzbekistan', ve: 'Venezuela', vn: 'Vietnam', ye: 'Yemen',
    zm: 'Zambia', zw: 'Zimbabwe'
  };

  // Pinned countries shown first in tabs
  const pinned = ['in', 'us'];

  // Popular countries shown in initial tab list
  const popular = [
    'in', 'us', 'gb', 'ca', 'au', 'de', 'fr', 'it', 'es', 'br',
    'mx', 'jp', 'kr', 'cn', 'ru', 'ae', 'sa', 'tr', 'pk', 'bd',
    'ng', 'eg', 'za', 'ph', 'id', 'th', 'vn', 'pl', 'nl', 'pt',
    'ar', 'co', 'cl', 'ro', 'ua', 'se', 'no', 'dk', 'fi', 'gr'
  ];

  /**
   * Convert a 2-letter country code to flag emoji.
   * Works by mapping each letter to its regional indicator symbol.
   */
  function flag(code) {
    if (!code || code.length !== 2) return '🌐';
    const codePoints = [...code.toUpperCase()].map(
      c => 0x1F1E6 + c.charCodeAt(0) - 65
    );
    return String.fromCodePoint(...codePoints);
  }

  function name(code) {
    return map[code.toLowerCase()] || code.toUpperCase();
  }

  function getPopular() {
    return popular;
  }

  function getPinned() {
    return pinned;
  }

  // iptv-org uses 'uk' instead of 'gb' for United Kingdom
  const playlistCodeMap = { gb: 'uk' };

  function toPlaylistCode(code) {
    return playlistCodeMap[code.toLowerCase()] || code.toLowerCase();
  }

  function getAllCodes() {
    return Object.keys(map);
  }

  return { flag, name, getPopular, getPinned, getAllCodes, toPlaylistCode, map };
})();
