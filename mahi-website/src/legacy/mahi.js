/* MAHI – original animated companion (inline SVG + CSS, no external assets).
 * Design: glossy white helmet head, dark glass visor with glowing LED eyes (expression system),
 * leaf hair clip, green & white futuristic outfit, small animated arms and swappable props.
 */
(function (root) {
  'use strict';

  // ---------- LED eye shapes (centered on 0,0) ----------
  const EYES = {
    neutral: () => '<rect x="-9" y="-13" width="18" height="26" rx="8.5"/>',
    blink: () => '<rect x="-11" y="-2" width="22" height="4" rx="2"/>',
    happy: () => '<path d="M-11 5 Q0 -13 11 5" class="stroke"/>',
    relaxed: () => '<path d="M-11 -3 Q0 9 11 -3" class="stroke"/>',
    sleepy: () => '<path d="M-11 1 Q0 9 11 1" class="stroke thin"/>',
    focused: () => '<rect x="-10" y="-5" width="20" height="12" rx="5"/>',
    surprised: () => '<rect x="-11" y="-15" width="22" height="30" rx="11"/>',
    sadL: () => '<path d="M-11 -2 L10 -9 L10 6 Q0 13 -11 6 Z"/>',
    sadR: () => '<path d="M11 -2 L-10 -9 L-10 6 Q0 13 11 6 Z"/>',
    concernL: () => '<path d="M-10 -9 L10 -4 L10 9 Q0 14 -10 9 Z"/>',
    concernR: () => '<path d="M10 -9 L-10 -4 L-10 9 Q0 14 10 9 Z"/>',
    winkR: () => '<path d="M8 -9 L-6 0 L8 9" class="stroke"/>',
    star: () => '<path d="M0 -14 L4 -4 L14 -4 L6 3 L9 13 L0 7 L-9 13 L-6 3 L-14 -4 L-4 -4 Z"/>',
    heart: () => '<path d="M0 11 C-14 1 -12 -12 -4 -11 C-1 -11 0 -8 0 -6 C0 -8 1 -11 4 -11 C12 -12 14 1 0 11 Z"/>',
  };
  const EXPR = {
    neutral: ['neutral', 'neutral', ''], blink: ['blink', 'blink', ''], happy: ['happy', 'happy', 'smile'], relaxed: ['relaxed', 'relaxed', 'smile'],
    sleepy: ['sleepy', 'sleepy', ''], focused: ['focused', 'focused', ''], surprised: ['surprised', 'surprised', 'o'],
    sad: ['sadL', 'sadR', 'flat'], concerned: ['concernL', 'concernR', 'flat'], wink: ['neutral', 'winkR', 'smile'],
    excited: ['star', 'star', 'open'], love: ['heart', 'heart', 'smile'],
  };
  const MOUTH = { '': '', smile: '<path d="M-7 0 Q0 7 7 0" class="stroke thin"/>', o: '<ellipse cx="0" cy="1" rx="4" ry="5"/>', flat: '<path d="M-5 1 L5 1" class="stroke thin"/>', open: '<path d="M-8 -1 Q0 10 8 -1 Z"/>' };

  // ---------- Props ----------
  const PROPS = {
    laptop: '<g class="prop-laptop" transform="translate(100 196)"><rect x="-34" y="-30" width="68" height="40" rx="4" fill="#1d2b3a"/><rect x="-30" y="-26" width="60" height="32" rx="2" fill="#2d7dd2" class="screen"/><path d="M-27 -18h30M-27 -12h44M-27 -6h22" stroke="#bfe3ff" stroke-width="2" class="typing-lines"/><rect x="-44" y="10" width="88" height="6" rx="3" fill="#c7d0d8"/></g>',
    clipboard: '<g transform="translate(100 186)"><rect x="-20" y="-26" width="40" height="50" rx="4" fill="#b07b47"/><rect x="-16" y="-20" width="32" height="40" rx="2" fill="#fff"/><rect x="-8" y="-30" width="16" height="8" rx="2" fill="#7b8794"/><path d="M-11 -11l3 3 5-6M-11 0l3 3 5-6M-11 11l3 3 5-6" stroke="#2E9E4F" stroke-width="2" fill="none"/><path d="M0 -10h10M0 1h10M0 12h8" stroke="#9aa5b1" stroke-width="2"/></g>',
    report: '<g transform="translate(100 186)"><rect x="-24" y="-24" width="48" height="44" rx="3" fill="#fff" stroke="#cfd8dc"/><rect x="-18" y="2" width="6" height="12" fill="#2E9E4F"/><rect x="-9" y="-6" width="6" height="20" fill="#1E6FD9"/><rect x="0" y="-12" width="6" height="26" fill="#7E57C2"/><rect x="9" y="-2" width="6" height="16" fill="#C9A227"/><path d="M-18 -16h30" stroke="#9aa5b1" stroke-width="2"/></g>',
    coffee: '<g class="prop-coffee" transform="translate(132 150)"><rect x="-8" y="-10" width="16" height="18" rx="3" fill="#fff" stroke="#2E9E4F" stroke-width="2"/><path d="M8 -6 q7 0 7 6 q0 6 -7 6" fill="none" stroke="#2E9E4F" stroke-width="2"/><path class="steam" d="M-3 -14 q-3 -5 0 -10 M3 -14 q-3 -5 0 -10" stroke="#9aa5b1" stroke-width="1.5" fill="none"/></g>',
    plant: '<g transform="translate(40 200)"><path d="M-10 0h20l-3 18h-14z" fill="#c26d3a"/><path class="leafsway" d="M0 0 C-14 -10 -12 -24 0 -30 C2 -18 4 -8 0 0 Z M0 0 C12 -8 16 -20 8 -26 C4 -16 2 -8 0 0Z" fill="#2E9E4F"/></g>',
    can: '<g transform="translate(142 172) rotate(-20)"><rect x="-10" y="-8" width="18" height="14" rx="3" fill="#1E6FD9"/><path d="M8 -4 L22 -12" stroke="#1E6FD9" stroke-width="3"/><circle class="drops" cx="24" cy="-6" r="1.6" fill="#7cc4ff"/></g>',
    cards: '<g class="prop-cards" transform="translate(100 188)"><rect class="c1" x="-30" y="-14" width="20" height="26" rx="3" fill="#FFE08A"/><rect class="c2" x="-10" y="-18" width="20" height="26" rx="3" fill="#B9F0C9"/><rect class="c3" x="10" y="-14" width="20" height="26" rx="3" fill="#C9DEFF"/></g>',
    clock: '<g class="prop-clock" transform="translate(168 86)"><circle r="16" fill="#fff" stroke="#12263F" stroke-width="3"/><path class="hand" d="M0 0 V-10" stroke="#12263F" stroke-width="2.5" stroke-linecap="round"/><path d="M0 0 H7" stroke="#D32F2F" stroke-width="2" stroke-linecap="round"/></g>',
    notebook: '<g transform="translate(100 190)"><rect x="-24" y="-18" width="48" height="34" rx="3" fill="#fff" stroke="#2E9E4F" stroke-width="2"/><path d="M0 -18v34" stroke="#2E9E4F"/><path class="writing" d="M-19 -9h14M-19 -2h12M5 -9h13M5 -2h10" stroke="#9aa5b1" stroke-width="2"/><path class="pen" d="M14 6 l10 -14 3 2 -10 14z" fill="#12263F"/></g>',
    headphones: '<g class="prop-headphones"><path d="M52 92 Q100 22 148 92" fill="none" stroke="#2E9E4F" stroke-width="7" stroke-linecap="round"/><text class="mnote n1" x="160" y="70" font-size="16" fill="#2E9E4F">♪</text><text class="mnote n2" x="30" y="64" font-size="14" fill="#2E9E4F">♫</text></g>',
    play: '<g class="prop-play" transform="translate(100 184)"><rect x="-26" y="-20" width="52" height="38" rx="8" fill="#1E6FD9"/><path d="M-6 -9 L10 0 L-6 9 Z" fill="#fff"/></g>',
    poster: '<g class="prop-poster" transform="translate(100 184)"><rect x="-22" y="-28" width="44" height="54" rx="3" fill="#fff" stroke="#2E9E4F" stroke-width="2"/><circle cx="-6" cy="-12" r="7" fill="#FFB300"/><path d="M-18 14 L-6 0 L4 10 L10 4 L18 14 Z" fill="#2E9E4F"/><path d="M-16 20h32" stroke="#C62828" stroke-width="2"/></g>',
    trophy: '<g class="prop-trophy" transform="translate(100 182)"><path d="M-16 -26h32v10a16 16 0 0 1 -32 0z" fill="#E7B416" stroke="#B8860B" stroke-width="2"/><path d="M-16 -22h-8a8 8 0 0 0 8 12M16 -22h8a8 8 0 0 1 -8 12" fill="none" stroke="#B8860B" stroke-width="3"/><rect x="-4" y="-2" width="8" height="12" fill="#B8860B"/><rect x="-14" y="10" width="28" height="7" rx="2" fill="#8a6d00"/><text x="0" y="-12" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">★</text></g>',
    badge: '<g class="prop-badge" transform="translate(100 182)"><circle r="22" fill="#2E9E4F" stroke="#C9A227" stroke-width="3"/><path d="M-9 0 l6 7 l12 -14" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M-12 18 l-6 16 l8 -4 l4 8 l5 -16 M12 18 l6 16 l-8 -4 l-4 8 l-5 -16" fill="#C9A227"/></g>',
    checklist: '<g transform="translate(100 186)"><rect x="-20" y="-26" width="40" height="50" rx="4" fill="#fff" stroke="#EF7D00" stroke-width="2"/><path d="M-12 -14l3 3 5-6" stroke="#2E9E4F" stroke-width="2" fill="none"/><path d="M-12 -2 l8 8 M-4 -2 l-8 8" stroke="#EF7D00" stroke-width="2.4"/><path d="M-12 12l3 3 5-6" stroke="#2E9E4F" stroke-width="2" fill="none"/><path d="M2 -12h10M2 1h10M2 14h8" stroke="#9aa5b1" stroke-width="2"/></g>',
    zzz: '<g class="prop-zzz" fill="#7d8ea3" font-weight="700"><text class="z1" x="140" y="70" font-size="14">z</text><text class="z2" x="152" y="56" font-size="18">z</text><text class="z3" x="166" y="40" font-size="22">Z</text></g>',
    sparkles: '<g class="prop-sparkles" fill="#FFD54F"><path class="s1" d="M30 60 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/><path class="s2" d="M168 50 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z"/><path class="s3" d="M160 150 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/><path class="s4" d="M36 140 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/></g>',
    gift: '<g transform="translate(160 206)"><rect x="-13" y="-14" width="26" height="22" rx="2" fill="#C62828"/><rect x="-2" y="-14" width="4" height="22" fill="#FFD54F"/><rect x="-15" y="-18" width="30" height="6" rx="2" fill="#B71C1C"/><path d="M0 -18 q-10 -10 -10 0 M0 -18 q10 -10 10 0" stroke="#FFD54F" stroke-width="2.5" fill="none"/></g>',
    tree: '<g transform="translate(36 206)"><path d="M0 -50 L16 -22 H8 L20 -2 H-20 L-8 -22 H-16Z" fill="#1B5E20"/><rect x="-3" y="-2" width="6" height="8" fill="#6d4c41"/><circle cx="-6" cy="-18" r="2.4" fill="#FFD54F"/><circle cx="7" cy="-10" r="2.4" fill="#C62828"/><circle cx="2" cy="-32" r="2.2" fill="#C62828"/><path d="M0 -56 l2 5 5 1 -4 3 1 5 -4 -3 -4 3 1 -5 -4 -3 5 -1z" fill="#FFD54F"/></g>',
    pot: '<g transform="translate(160 208)"><path d="M-16 -16 h32 q4 0 2 8 q-4 18 -18 18 q-14 0 -18 -18 q-2 -8 2 -8z" fill="#C9A227" stroke="#8a6d00" stroke-width="1.5"/><path d="M-12 -18 q12 -12 24 0" fill="#fff"/><circle cx="-4" cy="-22" r="3" fill="#fff"/><circle cx="4" cy="-24" r="3.5" fill="#fff"/><path d="M-16 -8 h32" stroke="#C62828" stroke-width="2"/></g>',
    cane: '<g transform="translate(30 214)"><rect x="-3" y="-80" width="6" height="80" rx="3" fill="#7B3F2A"/><path d="M-3 -60h6M-3 -40h6M-3 -20h6" stroke="#4e2618" stroke-width="2"/><path d="M0 -80 q-18 -10 -22 -24 q14 6 22 18 q6 -16 20 -22 q-6 16 -20 28" fill="#2E7D32"/></g>',
    fireworks: '<g class="prop-fireworks"><g class="fw f1" transform="translate(40 40)"><path d="M0 -14V-6M0 14V6M-14 0H-6M14 0H6M-10 -10l5 5M10 10l-5 -5M-10 10l5 -5M10 -10l-5 5" stroke="#FFD54F" stroke-width="2.5" stroke-linecap="round"/></g><g class="fw f2" transform="translate(166 36)"><path d="M0 -12V-5M0 12V5M-12 0H-5M12 0H5M-8 -8l4 4M8 8l-4 -4M-8 8l4 -4M8 -8l-4 4" stroke="#64B5F6" stroke-width="2.5" stroke-linecap="round"/></g><g class="fw f3" transform="translate(172 128)"><path d="M0 -10V-4M0 10V4M-10 0H-4M10 0H4" stroke="#F06292" stroke-width="2.5" stroke-linecap="round"/></g></g>',
  };

  const FESTIVE = {
    christmas: '<g class="acc-santa"><path d="M70 50 Q96 4 140 30 Q150 36 150 52 Z" fill="#C62828"/><path d="M140 30 Q158 34 160 50" fill="none" stroke="#C62828" stroke-width="8" stroke-linecap="round"/><circle cx="161" cy="54" r="7" fill="#fff"/><rect x="62" y="44" width="92" height="13" rx="6.5" fill="#fff"/></g>',
    newyear: '<g class="acc-party"><path d="M108 8 L128 52 H88 Z" fill="#C9A227"/><path d="M98 30 L118 40 M94 42 L122 50 M103 19 L113 24" stroke="#1A3E8C" stroke-width="3"/><circle cx="108" cy="7" r="6" fill="#1A3E8C"/><rect x="84" y="49" width="48" height="6" rx="3" fill="#1A3E8C"/></g>',
    pongal: '<g class="acc-jasmine"><path d="M60 64 Q100 30 140 64" fill="none" stroke="#2E7D32" stroke-width="2"/>' + Array.from({ length: 9 }, (_, i) => { const t = i / 8; const x = 60 + 80 * t; const y = 64 - 34 * 4 * t * (1 - t) * 0.75; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="#fff" stroke="#e8e0c8"/>`; }).join('') + '<circle cx="138" cy="70" r="5" fill="#E0A800"/></g>',
  };

  function svg() {
    return `<svg class="mahi-svg" viewBox="0 0 200 230" role="img" aria-label="MAHI, your workflow companion">
  <defs>
    <linearGradient id="mHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.65" stop-color="#eef3f4"/><stop offset="1" stop-color="#cfd9dd"/></linearGradient>
    <linearGradient id="mVisor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16294a"/><stop offset="1" stop-color="#060f22"/></linearGradient>
    <linearGradient id="mBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe8ea"/></linearGradient>
    <linearGradient id="mSuit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E9E4F"/><stop offset="1" stop-color="#1B5E20"/></linearGradient>
    <filter id="mGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="mScan" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="2" fill="#fff"/></pattern>
    <mask id="mLed"><rect x="0" y="0" width="200" height="230" fill="url(#mScan)"/></mask>
  </defs>
  <g class="m-root">
    <ellipse class="m-shadow" cx="100" cy="222" rx="46" ry="6" fill="rgba(0,0,0,.15)"/>
    <g class="m-decor-back"></g>
    <g class="m-body">
      <g class="m-arm m-arm-l"><rect x="58" y="148" width="15" height="40" rx="7.5" fill="url(#mBody)" stroke="#c4d0d4"/><circle cx="65.5" cy="190" r="7" fill="#fff" stroke="#c4d0d4"/></g>
      <g class="m-arm m-arm-r"><rect x="127" y="148" width="15" height="40" rx="7.5" fill="url(#mBody)" stroke="#c4d0d4"/><circle cx="134.5" cy="190" r="7" fill="#fff" stroke="#c4d0d4"/><path class="m-thumb" d="M134 184 v-9" stroke="#fff" stroke-width="6" stroke-linecap="round"/></g>
      <path d="M70 150 Q70 138 84 136 H116 Q130 138 130 150 L134 206 Q134 216 122 216 H78 Q66 216 66 206 Z" fill="url(#mBody)" stroke="#c4d0d4"/>
      <path d="M78 140 H122 L126 206 Q126 210 120 210 H80 Q74 210 74 206 Z" fill="url(#mSuit)" opacity=".95"/>
      <path d="M84 137 L100 152 L116 137" fill="#fff" stroke="#c4d0d4"/>
      <circle cx="100" cy="166" r="9" fill="#fff"/><text x="100" y="169.5" text-anchor="middle" font-size="8" font-weight="800" fill="#1B5E20" font-family="Arial">IGO</text>
      <path d="M80 190 H120" stroke="#C9A227" stroke-width="2" opacity=".8"/>
      <g class="m-core"><circle cx="100" cy="200" r="3" fill="#7CFFCB" filter="url(#mGlow)"/></g>
    </g>
    <g class="m-head">
      <rect x="50" y="72" width="12" height="36" rx="6" fill="#1B5E20"/><rect x="138" y="72" width="12" height="36" rx="6" fill="#1B5E20"/>
      <path class="m-pod" d="M54 80v20M146 80v20" stroke="#7CFFCB" stroke-width="2" stroke-linecap="round" filter="url(#mGlow)"/>
      <path d="M100 44 C140 44 152 66 152 92 C152 124 132 138 100 138 C68 138 48 124 48 92 C48 66 60 44 100 44 Z" fill="url(#mHead)" stroke="#c4d0d4"/>
      <rect x="92" y="40" width="16" height="7" rx="3.5" fill="#2E9E4F"/>
      <path d="M100 60 C132 60 140 76 140 94 C140 116 126 126 100 126 C74 126 60 116 60 94 C60 76 68 60 100 60 Z" fill="url(#mVisor)"/>
      <path d="M72 70 Q90 62 112 64" stroke="rgba(255,255,255,.18)" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g class="m-face" filter="url(#mGlow)">
        <g class="m-eyes"><g class="m-eye m-eye-l" transform="translate(82 94)"></g><g class="m-eye m-eye-r" transform="translate(118 94)"></g></g>
        <g class="m-mouth" transform="translate(100 114)"></g>
        <g class="m-blush"><rect x="68" y="106" width="9" height="3" rx="1.5"/><rect x="123" y="106" width="9" height="3" rx="1.5"/></g>
      </g>
      <g class="m-leaf"><path d="M128 52 C138 34 156 34 162 40 C156 52 142 58 128 52 Z" fill="#2E9E4F"/><path d="M128 52 C140 46 150 42 160 40" stroke="#1B5E20" stroke-width="1.5" fill="none"/><path d="M126 56 C120 40 128 28 136 26 C138 38 134 50 126 56Z" fill="#43B864"/></g>
      <g class="m-festive"></g>
    </g>
    <g class="m-props"></g>
    <g class="m-decor-front"></g>
  </g>
</svg>`;
  }

  // ---------- Activities & reactions ----------
  const ACTIVITIES = {
    typing: { expr: 'focused', pose: 'type', props: ['laptop'], look: [0, 4], text: 'Typing your production updates…' },
    clipboard: { expr: 'neutral', pose: 'hold', props: ['clipboard'], look: [-3, 5], text: 'Checking the clipboard…' },
    reports: { expr: 'neutral', pose: 'hold', props: ['report'], look: [0, 5], text: 'Reading your production reports…' },
    coffee: { expr: 'relaxed', pose: 'drink', props: ['coffee'], text: 'Coffee time ☕' },
    plant: { expr: 'happy', pose: 'water', props: ['plant', 'can'], look: [-5, 3], text: 'Watering my little plant 🌱' },
    cards: { expr: 'focused', pose: 'hold', props: ['cards'], look: [0, 5], text: 'Organizing task cards…' },
    clock: { expr: 'neutral', pose: 'point', props: ['clock'], look: [6, -3], text: 'Keeping an eye on the clock ⏰' },
    notebook: { expr: 'focused', pose: 'write', props: ['notebook'], look: [0, 5], text: 'Writing notes…' },
    stretch: { expr: 'relaxed', pose: 'stretch', props: [], text: 'Stretch break!' },
    wave: { expr: 'happy', pose: 'wave', props: [], text: '👋' },
    headphones: { expr: 'relaxed', pose: 'type', props: ['headphones', 'laptop'], text: 'Working with my headphones on 🎧' },
    thumbs: { expr: 'wink', pose: 'thumbs', props: [], text: '👍' },
    break: { expr: 'relaxed', pose: 'drink', props: ['coffee', 'sparkles'], text: 'Taking a small break…' },
  };
  const REACTIONS = {
    poster: { expr: 'happy', pose: 'thumbs', props: ['poster', 'sparkles'], anim: 'jump', mood: 'happy' },
    ai: { expr: 'excited', pose: 'hold', props: ['play', 'sparkles'], anim: 'jump', mood: 'happy' },
    vj: { expr: 'wink', pose: 'thumbs', props: ['clipboard'], anim: 'bounce', mood: 'happy' },
    task: { expr: 'happy', pose: 'thumbs', props: ['sparkles'], anim: 'jump', mood: 'happy' },
    custom: { expr: 'happy', pose: 'thumbs', props: [], anim: 'bounce', mood: 'happy' },
    multi: { expr: 'excited', pose: 'clap', props: ['sparkles'], anim: 'bounce', mood: 'celebrate' },
    brand: { expr: 'happy', pose: 'hold', props: ['badge', 'sparkles'], anim: 'jump', mood: 'happy' },
    correction: { expr: 'concerned', pose: 'point', props: ['checklist'], anim: 'tilt', mood: 'warn' },
    deadline: { expr: 'concerned', pose: 'point', props: ['clock'], anim: 'tilt', mood: 'warn' },
    overdue: { expr: 'sad', pose: 'hold', props: ['clipboard'], anim: 'tilt', mood: 'alert' },
    reminder: { expr: 'surprised', pose: 'point', props: ['notebook'], anim: 'tilt', mood: 'warn' },
    daily: { expr: 'relaxed', pose: 'drink', props: ['coffee', 'sparkles'], anim: 'bounce', mood: 'happy', confetti: 40 },
    achievement: { expr: 'love', pose: 'hold', props: ['badge', 'sparkles'], anim: 'jump', mood: 'celebrate', confetti: 50 },
    milestone25: { expr: 'happy', pose: 'thumbs', props: ['sparkles'], anim: 'bounce', mood: 'happy' },
    milestone50: { expr: 'excited', pose: 'stretch', props: ['sparkles'], anim: 'jump', mood: 'celebrate', confetti: 60 },
    milestone75: { expr: 'excited', pose: 'clap', props: ['sparkles'], anim: 'bounce', mood: 'celebrate', confetti: 80 },
    set100: { expr: 'love', pose: 'hold', props: ['trophy', 'sparkles'], anim: 'dance', mood: 'celebrate', confetti: 180, banner: true, duration: 7500 },
    grand: { expr: 'excited', pose: 'hold', props: ['trophy', 'fireworks', 'sparkles'], anim: 'dance', mood: 'celebrate', confetti: 260, fireworks: true, certificate: true, duration: 10000 },
    welcome: { expr: 'happy', pose: 'wave', props: [], anim: 'bounce', mood: 'happy' },
    wake: { expr: 'surprised', pose: 'stretch', props: [], anim: 'bounce', mood: 'happy' },
    focus: { expr: 'focused', pose: 'type', props: ['laptop', 'headphones'], anim: '', mood: 'calm' },
    focusEnd: { expr: 'relaxed', pose: 'stretch', props: ['sparkles'], anim: 'bounce', mood: 'happy' },
    info: { expr: 'happy', pose: 'wave', props: [], anim: '', mood: 'calm' },
    bottleneck: { expr: 'concerned', pose: 'point', props: ['report'], anim: 'tilt', mood: 'warn' },
  };

  let el, svgEl, bubble, opts = {}, current = { expr: 'neutral' }, busy = false, queue = [], idleTimer, blinkTimer, lookTimer, sleepTimer, hideBubbleTimer;
  let lastInput = Date.now(), sleeping = false, festival = 'default', focusMode = false;

  const $ = (s) => svgEl.querySelector(s);
  function setExpr(name) {
    const e = EXPR[name] || EXPR.neutral; current.expr = name;
    $('.m-eye-l').innerHTML = EYES[e[0]](); $('.m-eye-r').innerHTML = EYES[e[1]]();
    $('.m-mouth').innerHTML = MOUTH[e[2]] || '';
  }
  function setPose(p) { svgEl.setAttribute('data-pose', p || ''); }
  function setProps(list) { $('.m-props').innerHTML = (list || []).map((p) => PROPS[p] || '').join(''); }
  function setAnim(a) { svgEl.classList.remove('a-jump', 'a-bounce', 'a-dance', 'a-tilt'); void svgEl.getBoundingClientRect(); if (a) svgEl.classList.add('a-' + a); }
  function setMood(m) { el.setAttribute('data-mood', m || 'calm'); }
  function look(x, y) { $('.m-eyes').setAttribute('transform', `translate(${x || 0} ${y || 0})`); }

  function say(msg, detail, action, ms) {
    clearTimeout(hideBubbleTimer);
    bubble.innerHTML = `<div class="mb-msg">${esc(msg)}</div>${detail ? `<div class="mb-detail">${esc(detail)}</div>` : ''}${action ? `<button class="mb-action">${esc(action.label)}</button>` : ''}<button class="mb-close" aria-label="Close">×</button>`;
    bubble.classList.add('show');
    if (action) bubble.querySelector('.mb-action').onclick = () => { opts.onAction && opts.onAction(action); bubble.classList.remove('show'); };
    bubble.querySelector('.mb-close').onclick = () => bubble.classList.remove('show');
    hideBubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms || 9000);
    if (opts.onSay) opts.onSay(msg, detail);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function rest() {
    if (focusMode) { const r = REACTIONS.focus; setExpr(r.expr); setPose(r.pose); setProps(r.props); setMood('calm'); return; }
    setExpr('neutral'); setPose(''); setProps(sleeping ? ['zzz'] : []); setAnim(''); setMood('calm'); look(0, 0);
    if (sleeping) setExpr('sleepy');
  }

  // Reactions are queued, highest priority first, and never overlap.
  function react(list) {
    (Array.isArray(list) ? list : [list]).forEach((r) => queue.push(r));
    queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    if (queue.length > 6) queue.length = 6;
    if (!busy) next();
  }
  function next() {
    const r = queue.shift();
    if (!r) { busy = false; rest(); return; }
    busy = true; if (sleeping) wake(true);
    const def = REACTIONS[r.kind] || REACTIONS.task;
    if (opts.isHidden && opts.isHidden()) { /* still record via bubble when shown */ }
    setExpr(def.expr); setPose(def.pose); setProps(def.props); setMood(def.mood); look(0, 0);
    if (!opts.reduced()) setAnim(def.anim);
    if (r.badge && def.props.includes('badge')) $('.m-props').insertAdjacentHTML('beforeend', `<text x="100" y="222" text-anchor="middle" font-size="9" font-weight="700" fill="#1B5E20">${esc(r.badge)}</text>`);
    say(r.msg, r.detail, r.action, (def.duration || 6000) + 3000);
    if (opts.fx && !opts.reduced()) {
      if (def.confetti) opts.fx.confetti(def.confetti);
      if (def.fireworks) opts.fx.fireworks();
    }
    if (def.banner && opts.onBanner) opts.onBanner(r);
    if (def.certificate && opts.onCertificate) opts.onCertificate(r);
    opts.sound && opts.sound(def.mood === 'celebrate' ? 'celebrate' : def.mood === 'alert' || def.mood === 'warn' ? 'alert' : 'chime');
    setTimeout(next, def.duration || 4200);
  }

  function activity(name) {
    if (busy || sleeping || focusMode) return;
    const a = ACTIVITIES[name]; if (!a) return;
    setExpr(a.expr); setPose(a.pose); setProps(a.props); setMood('calm'); setAnim(''); if (a.look) look(a.look[0], a.look[1]);
    busy = true;
    setTimeout(() => { busy = false; if (!queue.length) rest(); else next(); }, 6000);
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!opts.paused() && opts.decor() && !busy && !sleeping && document.visibilityState === 'visible') {
        const keys = Object.keys(ACTIVITIES);
        activity(keys[Math.floor(Math.random() * keys.length)]);
      }
      scheduleIdle();
    }, 22000 + Math.random() * 20000);
  }
  function scheduleBlink() {
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => {
      if (!opts.paused() && ['neutral', 'surprised', 'focused', 'wink'].includes(current.expr) && !sleeping) {
        const prev = current.expr; setExpr('blink'); setTimeout(() => { if (current.expr === 'blink') setExpr(prev); }, 130);
      }
      scheduleBlink();
    }, 2600 + Math.random() * 3600);
  }
  function scheduleLook() {
    clearTimeout(lookTimer);
    lookTimer = setTimeout(() => {
      if (!busy && !sleeping && !opts.paused() && opts.decor() && !focusMode) { const x = [-5, 0, 5, 0][Math.floor(Math.random() * 4)]; look(x, Math.random() < 0.3 ? -2 : 0); if (Math.random() < 0.25 && !opts.reduced()) setAnim('tilt'); }
      scheduleLook();
    }, 4000 + Math.random() * 5000);
  }
  function sleep() {
    if (sleeping || busy || focusMode || !opts.decor()) return;
    sleeping = true; setExpr('sleepy'); setPose(''); setProps(['zzz']); setMood('sleep');
  }
  function wake(silent) {
    if (!sleeping) return false;
    sleeping = false;
    if (!silent) react({ kind: 'wake', priority: 0, msg: `Oh! Welcome back, ${opts.name()}! Shall we continue where we left off?`, detail: opts.summary ? opts.summary() : '' });
    return true;
  }
  function activityPing() {
    const idleFor = Date.now() - lastInput; lastInput = Date.now();
    if (sleeping) wake(false);
    return idleFor;
  }

  function setFestival(mode) {
    festival = mode;
    $('.m-festive').innerHTML = FESTIVE[mode] || '';
    const back = { christmas: PROPS.tree + PROPS.gift, newyear: PROPS.fireworks, pongal: PROPS.cane + PROPS.pot }[mode] || '';
    $('.m-decor-back').innerHTML = back;
    el.setAttribute('data-festival', mode);
  }
  function setFocus(on) { focusMode = on; if (!busy) rest(); }

  function mount(container, options) {
    opts = options; el = container;
    el.innerHTML = `<div class="mahi-stage">${svg()}<div class="mahi-snow"></div></div><div class="mahi-bubble" role="status" aria-live="polite"></div>`;
    svgEl = el.querySelector('.mahi-svg'); bubble = el.querySelector('.mahi-bubble');
    setExpr('neutral'); scheduleBlink(); scheduleIdle(); scheduleLook();
    sleepTimer = setInterval(() => { if (Date.now() - lastInput > 3 * 60 * 1000) sleep(); }, 15000);
    svgEl.addEventListener('click', () => { if (!busy) { const keys = ['wave', 'thumbs', 'coffee', 'typing', 'clipboard']; activity(keys[Math.floor(Math.random() * keys.length)]); } });
  }

  root.MAHI_CHAR = { svgMarkup: svg, EYES, EXPR, MOUTH, PROPS, FESTIVE, mount, react, say, activity, setFestival, setFocus, activityPing, wake, sleep, isSleeping: () => sleeping, ACTIVITIES: Object.keys(ACTIVITIES), REACTIONS: Object.keys(REACTIONS), rest, setExpr };
})(window);
