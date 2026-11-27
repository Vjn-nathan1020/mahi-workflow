/* MAHI – original animated companion (inline SVG + JS, no external assets).
 * Design (approved 2026-11): white glossy floating robot – wide helmet with ear pods and a top LED,
 * black visor with LED-matrix blue eyes, bell torso with chest status light and teal waist seam,
 * rounded arms on shoulder joints. 40 expression states, ~50 activities with props, seasonal
 * accessories, a 10-level priority runner, browser speech (local voices only).
 * Public API (root.MAHI_CHAR) is unchanged from the first character.
 */
(function (root) {
  'use strict';
  const doc = root.document;

  // =====================================================================================
  // 1. Eye shapes (w = width, h = height, t/b = top/bottom curve factors, r = rotation)
  // =====================================================================================
  const EYES = {
    open: { w: 30, h: 34, t: .62, b: .62, r: 0 }, big: { w: 34, h: 42, t: .66, b: .66, r: 0 }, huge: { w: 36, h: 46, t: .66, b: .66, r: 0 },
    soft: { w: 30, h: 30, t: .6, b: .55, r: 0 }, happy: { w: 32, h: 30, t: .8, b: -.2, r: 0 }, smile: { w: 30, h: 30, t: .7, b: .12, r: 0 },
    laugh: { w: 34, h: 26, t: .85, b: -.4, r: 0 }, closed: { w: 30, h: 6, t: .3, b: .3, r: 0 }, sleep: { w: 30, h: 14, t: -.25, b: .6, r: 0 },
    half: { w: 30, h: 22, t: .12, b: .6, r: 0 }, sleepy: { w: 30, h: 14, t: .08, b: .55, r: 0 }, focus: { w: 32, h: 24, t: .2, b: .6, r: 6 },
    sad: { w: 28, h: 28, t: .35, b: .62, r: -14 }, worry: { w: 28, h: 32, t: .5, b: .62, r: -10 }, det: { w: 30, h: 28, t: .25, b: .62, r: 9 },
    hidden: { w: 3, h: .5, t: .5, b: .5, r: 0 }, sorry: { w: 28, h: 18, t: .3, b: .6, r: -10 },
  };
  const EY = EYES;
  const BLUE = [95, 220, 255], AMBER = [255, 176, 46], GREY = [120, 140, 160], PINK = [255, 143, 200], GOLD = [255, 211, 77], DIMBLUE = [127, 178, 214], GREEN = [61, 220, 151];

  // =====================================================================================
  // 2. The 40 expression states (eyes + colour + head tilt + arm pose + overlay icon)
  // =====================================================================================
  const X = (o) => Object.assign({ L: EY.open, R: null, sym: null, col: BLUE, pose: 'rest', tilt: 0, hy: 0, bob: [1, 1.6], ov: [], gaze: 'mouse', ear: null, chest: null, shake: 0, dim: 0, rigY: 0, eq: false }, o);
  const EXPR = {
    'Neutral': X({}),
    'Happy': X({ L: EY.happy, bob: [1.3, 2] }),
    'Smiling': X({ L: EY.smile }),
    'Winking': X({ L: EY.happy, R: EY.closed, tilt: 7, pose: 'point' }),
    'Laughing': X({ L: EY.laugh, pose: 'cheerLow', shake: 1, ov: ['ha'], bob: [1.4, 3] }),
    'Excited': X({ L: EY.big, pose: 'cheer', bob: [2, 3], ov: ['spark'] }),
    'Surprised': X({ L: EY.huge, pose: 'shrug', hy: -5, ov: ['ex'] }),
    'Curious': X({ L: EY.big, R: { w: 30, h: 26, t: .3, b: .6, r: 0 }, tilt: 12, ov: ['q'] }),
    'Thinking': X({ L: EY.focus, pose: 'chin', tilt: -6, gaze: 'upRight', ov: ['dots'] }),
    'Confused': X({ L: EY.open, sym: [null, 'spiral'], tilt: -10, pose: 'shrug', ov: ['q'] }),
    'Concerned': X({ L: EY.worry, pose: 'together' }),
    'Sad': X({ L: EY.sad, pose: 'droop', col: DIMBLUE, hy: 7, bob: [.5, 1], dim: .25, gaze: 'down' }),
    'Disappointed': X({ L: Object.assign({}, EY.half, { r: -6 }), pose: 'droop', hy: 8, bob: [.5, 1], gaze: 'down' }),
    'Tired': X({ L: Object.assign({}, EY.half, { h: 16 }), pose: 'droop', ov: ['sweat'], bob: [.6, .9] }),
    'Sleepy': X({ L: EY.sleepy, tilt: 8, ov: ['z'], bob: [.6, .8], pose: 'droop' }),
    'Sleeping': X({ L: EY.sleep, ov: ['zzz'], dim: .35, rigY: 12, bob: [.4, .6], pose: 'droop', chest: [90, 110, 130] }),
    'Motivating': X({ L: EY.det, pose: 'fistUp', ov: ['spark'] }),
    'Appreciating': X({ sym: ['heart', 'heart'], col: PINK, pose: 'clap' }),
    'Celebrating': X({ L: EY.happy, pose: 'cheer', ov: ['confettiS'], bob: [2.2, 3] }),
    'Proud': X({ L: EY.happy, hy: -6, pose: 'hips', ov: ['spark'] }),
    'Focused': X({ L: EY.focus, pose: 'together' }),
    'Working': X({ L: EY.focus, pose: 'type', gaze: 'down' }),
    'Reading': X({ L: EY.half, pose: 'hold', gaze: 'down' }),
    'Searching': X({ L: EY.open, gaze: 'scan' }),
    'Listening': X({ L: EY.soft, tilt: 10, ov: ['waves'], ear: GREEN }),
    'Speaking': X({ L: EY.smile, pose: 'talk', eq: true }),
    'Typing': X({ L: EY.focus, pose: 'typeFast', gaze: 'down' }),
    'Waiting': X({ L: EY.soft, pose: 'together', gaze: 'around', ov: ['hour'] }),
    'Warning': X({ L: EY.det, col: AMBER, pose: 'stop', ov: ['warn'], ear: AMBER, chest: AMBER }),
    'Apologising': X({ L: EY.sorry, hy: 8, pose: 'together', ov: ['sweat'] }),
    'Waving': X({ L: EY.happy, pose: 'wave' }),
    'Goodbye': X({ L: EY.smile, pose: 'waveSlow', tilt: 6 }),
    'Synchronising': X({ sym: ['spinner', 'spinner'], ov: ['cloud'], ear: AMBER, chest: AMBER }),
    'Offline': X({ sym: ['dash', 'dash'], col: GREY, ov: ['cloudOff'], dim: .3, chest: GREY, ear: GREY }),
    'Reconnected': X({ L: EY.happy, ov: ['check'], ear: GREEN, chest: GREEN }),
    'Daily target achieved': X({ sym: ['star', 'star'], col: GOLD, pose: 'cheer', ov: ['badgeDay', 'confettiS'], bob: [2, 3] }),
    'Weekly target achieved': X({ sym: ['star', 'star'], col: GOLD, pose: 'cheer', ov: ['trophy', 'confettiS'], bob: [2, 3] }),
    'Monthly target achieved': X({ sym: ['star', 'star'], col: GOLD, pose: 'cheer', ov: ['medal', 'confettiS', 'spark'], bob: [2.2, 3] }),
    'Revision required': X({ L: EY.worry, pose: 'point', ov: ['rev'], ear: AMBER }),
    'Approval received': X({ L: EY.happy, pose: 'fistUp', ov: ['check'], chest: GREEN }),
  };
  // Names used by the first character (setExpr / hold callers) → new states.
  const ALIAS = { neutral: 'Neutral', blink: 'Neutral', happy: 'Happy', relaxed: 'Smiling', sleepy: 'Sleepy', focused: 'Focused', surprised: 'Surprised', sad: 'Sad', concerned: 'Concerned', wink: 'Winking', excited: 'Excited', love: 'Appreciating', thinking: 'Thinking', confused: 'Confused', warning: 'Warning', determined: 'Motivating' };
  const exprName = (n) => (EXPR[n] ? n : ALIAS[n] || null);

  // The new face has no mouth: speech shows as an LED equaliser inside the visor.
  const MOUTH = { '': '' };

  // =====================================================================================
  // 3. Arm poses (base angles, oscillation amplitudes, speed, alternate)
  // =====================================================================================
  const POSE = {
    rest: { L: 8, R: -8 }, droop: { L: 3, R: -3 }, cheer: { L: 150, R: -150, oL: 14, oR: 14, sp: 6 }, cheerLow: { L: 110, R: -110, oL: 10, oR: 10, sp: 8 },
    wave: { L: 8, R: -155, oR: 22, sp: 7 }, waveSlow: { L: 8, R: -150, oR: 18, sp: 4 }, chin: { L: 6, R: 115 }, shrug: { L: 80, R: -80 },
    hold: { L: -25, R: 25 }, type: { L: -27, R: 27, oL: 4, oR: 4, sp: 14, alt: 1 }, typeFast: { L: -27, R: 27, oL: 5, oR: 5, sp: 24, alt: 1 },
    clap: { L: -30, R: 30, oL: 12, oR: 12, sp: 10 }, hips: { L: 32, R: -32 }, point: { L: 8, R: -100 }, stop: { L: 8, R: -165 },
    fistUp: { L: 8, R: -160, oR: 8, sp: 5 }, together: { L: -36, R: 36 }, talk: { L: 8, R: -30, oR: 10, sp: 3 }, stretch: { L: 172, R: -172, oL: 6, oR: 6, sp: 2 },
    sip: { L: 8, R: 75, oR: 35, sp: 1.6 }, lift: { L: 105, R: -105, oL: 45, oR: 45, sp: 3 }, sweep: { L: 8, R: 50, oR: 30, sp: 2 }, sort: { L: -20, R: 20, oL: 18, oR: 18, sp: 5, alt: 1 },
    throw: { L: 8, R: -140, oR: 60, sp: 3 }, bat: { L: -20, R: 40, oR: 55, sp: 2.9 }, water: { L: 70, R: -8 }, catch: { L: 140, R: -140, oL: 20, oR: 20, sp: 5 },
    dance: { L: 120, R: -60, oL: 40, oR: 40, sp: 5, alt: 1 }, write: { L: -25, R: 30, oR: 6, sp: 12 }, clip: { L: -40, R: 35, oR: 5, sp: 10 }, carry: { L: -28, R: 28 },
    sugarcane: { L: 20, R: -8 }, toss: { L: 8, R: -120, oR: 40, sp: 2.6 },
  };

  // Symbol eyes
  const SYM = {
    heart: '<path d="M0,10 C-22,-4 -12,-20 0,-9 C12,-20 22,-4 0,10Z" fill="url(#mh-gEye)"/>',
    star: '<path d="M0,-16 L4.7,-5 16,-5 7,2 10,14 0,7 -10,14 -7,2 -16,-5 -4.7,-5Z" fill="url(#mh-gEye)"/>',
    spiral: '<path d="M0,0 m-2,0 a2,2 0 1,1 4,0 a5,5 0 1,1 -9,1 a8,8 0 1,1 15,-1 a11,11 0 1,1 -20,2" stroke="url(#mh-gEye)" stroke-width="3.2" fill="none" stroke-linecap="round"/>',
    spinner: '<g class="mh-symspin"><path d="M0,-13 A13,13 0 1,1 -12.4,4" stroke="url(#mh-gEye)" stroke-width="5" fill="none" stroke-linecap="round"/></g>',
    dash: '<rect x="-14" y="-3" width="28" height="6" rx="3" fill="url(#mh-gEye)"/>',
  };

  // =====================================================================================
  // 4. Props: [slot, markup]. Slots: back / front (world), rigFront (moves with MAHI),
  //    hands (Lup/Rup keep upright, Lrig/Rrig turn with the arm), head, torso.
  // =====================================================================================
  const flakes = () => Array.from({ length: 18 }, (_, i) => `<circle class="mh-flake" r="${2 + (i % 3)}" fill="#fff" opacity=".85" style="--x:${(i * 23) % 400}px;--d:${4 + (i % 5)}s;--dl:${-(i * .7)}s"/>`).join('');
  const confettiRain = () => Array.from({ length: 26 }, (_, i) => `<rect class="mh-conf" width="6" height="10" rx="1" fill="${['#ff6b6b', '#ffd34d', '#3ddc97', '#39d0ff', '#c792ff', '#ff9f43'][i % 6]}" style="--x:${(i * 31) % 400}px;--d:${3 + (i % 4)}s;--dl:${-(i * .35)}s"/>`).join('');
  const fwBurst = (x, y, c, dl) => `<g class="mh-fw" transform="translate(${x},${y})">${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="${(Math.cos(a) * 6).toFixed(1)}" y1="${(Math.sin(a) * 6).toFixed(1)}" x2="${(Math.cos(a) * 30).toFixed(1)}" y2="${(Math.sin(a) * 30).toFixed(1)}" stroke="${c}" stroke-width="3" stroke-linecap="round" style="animation-delay:${dl}s"/>`; }).join('')}</g>`;
  const PROPS = {
    laptop: ['rigFront', '<g transform="translate(200,350)"><path d="M-44,0 L44,0 L50,9 L-50,9Z" fill="#c8d1db"/><rect x="-44" y="0" width="88" height="3" fill="#9aa7b5"/><g class="mh-lid"><rect x="-38" y="-48" width="76" height="48" rx="5" fill="#3a4350"/><circle cx="0" cy="-24" r="6" fill="#39d0ff" opacity=".9"/></g></g>'],
    laptopClose: ['rigFront', '<g transform="translate(200,350)"><path d="M-44,0 L44,0 L50,9 L-50,9Z" fill="#c8d1db"/><g class="mh-lid mh-closing"><rect x="-38" y="-48" width="76" height="48" rx="5" fill="#3a4350"/><circle cx="0" cy="-24" r="6" fill="#39d0ff" opacity=".9"/></g></g>'],
    notebook: ['rigFront', '<g transform="translate(200,346)"><path d="M0,-4 C-14,-10 -34,-10 -40,-6 L-40,16 C-30,12 -14,12 0,18Z" fill="#fff"/><path d="M0,-4 C14,-10 34,-10 40,-6 L40,16 C30,12 14,12 0,18Z" fill="#f2f6fa"/><path d="M-32,0 h22 M-32,6 h24 M8,0 h22 M8,6 h18" stroke="#9fb2c4" stroke-width="1.5"/></g>'],
    book: ['rigFront', '<g transform="translate(200,330)"><rect x="-28" y="-36" width="56" height="42" rx="3" fill="#6c5ce7"/><rect x="-28" y="-36" width="6" height="42" fill="#5546c9"/><rect x="-14" y="-26" width="30" height="6" rx="2" fill="#fff" opacity=".8"/></g>'],
    report: ['rigFront', '<g transform="translate(200,334)"><rect x="-26" y="-34" width="52" height="42" rx="3" fill="#fff"/><path d="M-18,-24 h30 M-18,-17 h22" stroke="#9fb2c4" stroke-width="2"/><rect x="-18" y="-6" width="7" height="10" fill="#39d0ff"/><rect x="-8" y="-12" width="7" height="16" fill="#2a9d8f"/><rect x="2" y="-9" width="7" height="13" fill="#ffd34d"/></g>'],
    puzzle: ['rigFront', '<g transform="translate(200,346)"><rect x="-26" y="-26" width="25" height="25" rx="3" fill="#ff6b6b"/><rect x="1" y="-26" width="25" height="25" rx="3" fill="#39d0ff"/><rect x="-26" y="1" width="25" height="25" rx="3" fill="#ffd34d"/><rect class="mh-pz" x="1" y="1" width="25" height="25" rx="3" fill="#3ddc97"/></g>'],
    gift: ['rigFront', '<g transform="translate(200,340)"><rect x="-22" y="-20" width="44" height="34" rx="3" fill="#e74c3c"/><rect x="-4" y="-20" width="8" height="34" fill="#ffd34d"/><rect x="-22" y="-6" width="44" height="7" fill="#ffd34d"/><path d="M0,-20 c-12,-14 -22,0 0,0 c22,0 12,-14 0,0" fill="none" stroke="#ffd34d" stroke-width="4"/></g>'],
    sled: ['rigFront', '<g transform="translate(200,384)"><rect x="-56" y="0" width="112" height="8" rx="4" fill="#c0392b"/><path d="M-60,16 H58 q14,0 14,-14" stroke="#8e5a2b" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M-40,8 v8 M40,8 v8" stroke="#8e5a2b" stroke-width="4"/></g>'],
    chart: ['back', '<g transform="translate(330,190)"><rect x="-42" y="-40" width="84" height="66" rx="8" fill="#0e2233" stroke="#39d0ff" opacity=".95"/><rect class="mh-bar" x="-30" y="-6" width="11" height="24" fill="#39d0ff"/><rect class="mh-bar" x="-15" y="-20" width="11" height="38" fill="#2a9d8f" style="animation-delay:.3s"/><rect class="mh-bar" x="0" y="-12" width="11" height="30" fill="#ffd34d" style="animation-delay:.6s"/><rect class="mh-bar" x="15" y="-28" width="11" height="46" fill="#3ddc97" style="animation-delay:.9s"/></g>'],
    checklist: ['back', '<g transform="translate(332,196)"><rect x="-44" y="-52" width="88" height="104" rx="9" fill="#f7fbff"/><rect x="-44" y="-52" width="88" height="18" rx="9" fill="#2a9d8f"/><text x="0" y="-39" font-size="10" text-anchor="middle" fill="#fff" font-weight="700">TODAY</text>' + [0, 1, 2, 3].map((i) => `<rect x="-34" y="${-24 + i * 18}" width="11" height="11" rx="2" fill="none" stroke="#9fb2c4" stroke-width="1.5"/><path d="M-18,${-18 + i * 18} h46" stroke="#cfd8e2" stroke-width="3" stroke-linecap="round"/><path class="mh-tick" style="animation-delay:${.6 + i * .7}s" d="M-32,${-19 + i * 18} l3,4 7,-8" stroke="#3ddc97" stroke-width="2.5" fill="none" stroke-linecap="round"/>`).join('') + '</g>'],
    stumps: ['back', '<g transform="translate(70,394)"><rect x="-11" y="-48" width="4" height="48" fill="#d9a35b"/><rect x="-2" y="-48" width="4" height="48" fill="#d9a35b"/><rect x="7" y="-48" width="4" height="48" fill="#d9a35b"/><rect x="-12" y="-51" width="24" height="3" rx="1" fill="#b8843f"/></g>'],
    hoop: ['back', '<g transform="translate(345,120)"><rect x="-24" y="-34" width="48" height="34" rx="3" fill="#f7fbff" stroke="#9fb2c4"/><rect x="-10" y="-24" width="20" height="14" fill="none" stroke="#e4572e" stroke-width="2"/><ellipse cx="0" cy="6" rx="16" ry="4" fill="none" stroke="#e4572e" stroke-width="3"/><path d="M-14,8 l4,16 M-6,9 l1,16 M6,9 l-1,16 M14,8 l-4,16" stroke="#dfe7ef" stroke-width="1.5"/></g>'],
    easel: ['back', '<g transform="translate(330,330)"><path d="M-20,30 L-6,-56 M20,30 L6,-56 M0,30 L0,-10" stroke="#8e5a2b" stroke-width="4"/><rect x="-34" y="-62" width="68" height="54" rx="2" fill="#fff"/><path class="mh-draw" d="M-20,-24 C-20,-52 6,-52 0,-34 C-6,-52 22,-52 20,-24 C16,-14 4,-14 0,-16" stroke="#ff6b6b" stroke-width="3" fill="none" stroke-linecap="round"/></g>'],
    plant: ['back', '<g transform="translate(70,392)"><path d="M-18,-26 h36 l-5,26 h-26z" fill="#b5651d"/><rect x="-20" y="-30" width="40" height="7" rx="2" fill="#c97a2b"/><ellipse cx="-10" cy="-46" rx="7" ry="16" fill="#3ddc97" transform="rotate(-25 -10 -46)"/><ellipse cx="10" cy="-48" rx="7" ry="17" fill="#2a9d8f" transform="rotate(22 10 -48)"/><ellipse cx="0" cy="-56" rx="6" ry="18" fill="#3ddc97"/></g>'],
    snowground: ['back', '<ellipse cx="200" cy="426" rx="196" ry="24" fill="#f4f9ff" opacity=".95"/><ellipse cx="200" cy="420" rx="150" ry="10" fill="#fff"/>'],
    snowman: ['back', '<g transform="translate(338,372)"><circle r="24" fill="#fff" stroke="#dfe7ef" stroke-width="2"/><circle cy="-34" r="17" fill="#fff" stroke="#dfe7ef" stroke-width="2"/><circle cy="-60" r="12" fill="#fff" stroke="#dfe7ef" stroke-width="2"/><circle cx="-4" cy="-63" r="1.8" fill="#333"/><circle cx="4" cy="-63" r="1.8" fill="#333"/><path d="M0,-59 l12,3 -12,2z" fill="#ff9f43"/><path d="M-13,-48 h26 v6 h-26z M6,-44 v14 h6 v-14z" fill="#e74c3c"/><circle cy="-34" r="2" fill="#333"/><circle cy="-24" r="2" fill="#333"/></g>'],
    tree: ['back', '<g transform="translate(66,356)"><rect x="-6" y="30" width="12" height="16" fill="#8e5a2b"/><path d="M0,-70 L30,-20 H-30Z M0,-46 L38,6 H-38Z M0,-20 L46,34 H-46Z" fill="#1e8449"/><path class="mh-twinkle" d="M0,-84 l4,9 10,1 -8,6 3,10 -9,-6 -9,6 3,-10 -8,-6 10,-1z" fill="#ffd34d"/>' + [[-14, -24, '#e74c3c'], [12, -12, '#39d0ff'], [-20, 10, '#ffd34d'], [20, 20, '#c792ff'], [0, -40, '#ff9f43'], [-4, 22, '#e74c3c']].map(([x, y, c], i) => `<circle class="mh-orn" style="animation-delay:${.4 + i * .5}s" cx="${x}" cy="${y}" r="5" fill="${c}"/>`).join('') + '</g>'],
    fireworks: ['back', fwBurst(70, 80, '#ffd34d', 0) + fwBurst(334, 64, '#ff6b6b', .6) + fwBurst(300, 150, '#39d0ff', 1.1) + fwBurst(96, 170, '#c792ff', .3)],
    yeartext: ['back', '<text class="mh-yeartext mh-glowtext" x="200" y="38" font-size="30" font-weight="800" text-anchor="middle" fill="#ffd34d">2027</text>'],
    pongalpot: ['back', '<g transform="translate(334,378)"><path d="M-16,30 l6,-14 M16,30 l-6,-14 M0,30 v-14" stroke="#8e5a2b" stroke-width="4"/><path class="mh-flame" d="M-8,18 q8,-16 16,0z" fill="#ff9f43"/><path d="M-30,-14 C-36,10 -20,22 0,22 C20,22 36,10 30,-14 Z" fill="#c1440e"/><path d="M-28,-4 C-14,4 14,4 28,-4" stroke="#fff" stroke-width="2" stroke-dasharray="3 3" fill="none"/><rect x="-24" y="-22" width="48" height="9" rx="4" fill="#a8380b"/><path class="mh-foam" d="M-20,-22 C-22,-36 -4,-40 0,-32 C6,-42 24,-34 20,-22Z" fill="#fff"/><g class="mh-steam"><path d="M-6,-42 q-5,-7 0,-14 q5,-7 0,-14" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/><path d="M8,-42 q-5,-7 0,-14 q5,-7 0,-14" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/></g></g>'],
    kolam: ['back', '<g transform="translate(200,416) scale(1,.36)">' + [-2, -1, 0, 1, 2].map((i) => [-2, -1, 0, 1, 2].map((j) => `<circle cx="${i * 22}" cy="${j * 22}" r="3" fill="#fff"/>`).join('')).join('') + '<path class="mh-draw" d="M0,-60 C40,-60 60,-40 60,0 C60,40 40,60 0,60 C-40,60 -60,40 -60,0 C-60,-40 -40,-60 0,-60 M0,-40 L40,0 L0,40 L-40,0Z" stroke="#fff" stroke-width="4" fill="none"/></g>'],
    peg: ['back', '<g transform="translate(338,394)"><ellipse rx="20" ry="5" fill="#8e5a2b"/><rect x="-3" y="-34" width="6" height="34" fill="#c97a2b"/></g>'],
    pongaltext: ['back', '<text class="mh-glowtext" x="200" y="34" font-size="22" font-weight="800" text-anchor="middle" fill="#ffd34d">Pongalo Pongal!</text>'],
    rangoli: ['back', '<g transform="translate(200,418) scale(1,.36)">' + Array.from({ length: 8 }, (_, i) => `<ellipse cx="0" cy="-34" rx="12" ry="26" fill="${['#ff6b6b', '#ffd34d', '#c792ff', '#3ddc97'][i % 4]}" transform="rotate(${i * 45})"/>`).join('') + '<circle r="16" fill="#ff9f43"/><circle r="7" fill="#fff"/><circle r="70" fill="none" stroke="#ffd34d" stroke-width="4" stroke-dasharray="6 8"/></g>'],
    lights: ['back', '<path d="M6,18 Q200,74 394,18" stroke="#3a424d" stroke-width="2" fill="none"/>' + Array.from({ length: 11 }, (_, i) => { const x = 20 + i * 36, t = x / 400, y = 18 + 2 * t * (1 - t) * 56; return `<circle class="mh-twinkle" style="animation-delay:${(i * .17).toFixed(2)}s" cx="${x}" cy="${(y + 6).toFixed(1)}" r="5" fill="${['#ffd34d', '#ff6b6b', '#3ddc97', '#39d0ff'][i % 4]}"/>`; }).join('')],
    snow: ['front', flakes()],
    confetti: ['front', confettiRain()],
    football: ['front', '<g class="mh-ball-bounce"><circle r="13" fill="#fff" stroke="#333" stroke-width="1.5"/><path d="M0,-5 l5,3 -2,6 h-6 l-2,-6z" fill="#333"/></g>'],
    cball: ['front', '<circle class="mh-cball" r="6" fill="#c0392b"/>'],
    bball: ['front', '<g class="mh-bball"><circle r="11" fill="#e67e22"/><path d="M-11,0 h22 M0,-11 v22" stroke="#7a3d0b" stroke-width="1.5"/></g>'],
    plane: ['front', '<g class="mh-plane"><path d="M0,0 L34,-10 L10,4 Z" fill="#fff"/><path d="M10,4 L34,-10 L14,10Z" fill="#dfe7ef"/></g>'],
    car: ['front', '<g class="mh-car"><rect x="-26" y="-14" width="52" height="14" rx="5" fill="#e74c3c"/><path d="M-14,-14 l6,-10 h16 l6,10z" fill="#c0392b"/><circle cx="-14" cy="2" r="6" fill="#333"/><circle cx="14" cy="2" r="6" fill="#333"/></g>'],
    notes: ['front', [[130, 120, 0], [280, 110, .7], [320, 190, 1.4], [90, 200, 2]].map(([x, y, d]) => `<text class="mh-note" style="animation-delay:${d}s" x="${x}" y="${y}" font-size="24" fill="#39d0ff">♪</text>`).join('')],
    butterflies: ['front', '<g class="mh-bfly1"><g class="mh-wing"><ellipse cx="-6" cy="0" rx="7" ry="9" fill="#ffd34d"/><ellipse cx="6" cy="0" rx="7" ry="9" fill="#ff9f43"/></g><rect x="-1" y="-6" width="2" height="12" fill="#333"/></g><g class="mh-bfly2"><g class="mh-wing"><ellipse cx="-5" cy="0" rx="6" ry="8" fill="#39d0ff"/><ellipse cx="5" cy="0" rx="6" ry="8" fill="#c792ff"/></g><rect x="-1" y="-5" width="2" height="10" fill="#333"/></g>'],
    snowball: ['front', '<circle class="mh-sball" r="8" fill="#fff" stroke="#dfe7ef"/>'],
    rings: ['front', '<g>' + [0, 1, 2].map((i) => `<ellipse class="mh-ring" rx="14" ry="5" fill="none" stroke="${['#ff6b6b', '#ffd34d', '#3ddc97'][i]}" stroke-width="4"/>`).join('') + '</g>'],
    diyas: ['front', [110, 160, 240, 290].map((x) => `<g transform="translate(${x},410)"><path d="M-14,-6 Q0,10 14,-6Z" fill="#c1440e"/><path class="mh-flame" d="M-4,-7 Q0,-22 4,-7Z" fill="#ffd34d" filter="url(#mh-fGlow)"/></g>`).join('')],
    files: ['front', '<g transform="translate(330,392)">' + [0, 1, 2].map((i) => `<g class="mh-file"><path d="M-20,${-i * 7} h14 l4,-5 h22 v18 h-40z" fill="${['#ffd34d', '#39d0ff', '#3ddc97'][i]}" transform="translate(0,${-i * 7})"/></g>`).join('') + '</g>'],
    mugR: ['Rup', '<g><rect x="-9" y="-20" width="18" height="20" rx="3" fill="#2a9d8f"/><path d="M9,-15 q9,0 9,6 q0,6 -9,6" stroke="#2a9d8f" stroke-width="3" fill="none"/><g class="mh-steam"><path d="M-3,-24 q-4,-6 0,-12 q4,-6 0,-12" stroke="#fff" stroke-width="2" fill="none"/><path d="M4,-24 q-4,-6 0,-12 q4,-6 0,-12" stroke="#fff" stroke-width="2" fill="none"/></g></g>'],
    bottleR: ['Rup', '<g><rect x="-6" y="-30" width="12" height="30" rx="4" fill="#7fd6ff" opacity=".85"/><rect x="-4" y="-35" width="8" height="6" rx="2" fill="#2a9d8f"/></g>'],
    clipboardL: ['Lup', '<g><rect x="-18" y="-44" width="36" height="46" rx="3" fill="#8d6e63"/><rect x="-14" y="-38" width="28" height="36" fill="#fff"/><rect x="-7" y="-48" width="14" height="7" rx="2" fill="#9fb2c4"/><path d="M-10,-30 h18 M-10,-22 h18 M-10,-14 h12" stroke="#cfd8e2" stroke-width="2"/><path class="mh-tick" d="M-11,-31 l3,3 6,-6" stroke="#3ddc97" stroke-width="2" fill="none"/></g>'],
    pencilR: ['Rup', '<g transform="rotate(-30)"><rect x="-3" y="-30" width="6" height="26" fill="#ffd34d"/><path d="M-3,-4 L0,4 L3,-4Z" fill="#e0b97a"/><rect x="-3" y="-34" width="6" height="5" fill="#ff9f9f"/></g>'],
    magnifierR: ['Rup', '<g><line x1="0" y1="-4" x2="0" y2="10" stroke="#444" stroke-width="5" stroke-linecap="round"/><circle cx="0" cy="-18" r="12" fill="rgba(173,232,255,.35)" stroke="#555" stroke-width="3.5"/></g>'],
    dumbL: ['Lup', '<g><rect x="-14" y="-2" width="28" height="4" fill="#555"/><rect x="-18" y="-8" width="6" height="16" rx="2" fill="#2d343d"/><rect x="12" y="-8" width="6" height="16" rx="2" fill="#2d343d"/></g>'],
    dumbR: ['Rup', '<g><rect x="-14" y="-2" width="28" height="4" fill="#555"/><rect x="-18" y="-8" width="6" height="16" rx="2" fill="#2d343d"/><rect x="12" y="-8" width="6" height="16" rx="2" fill="#2d343d"/></g>'],
    canL: ['Lup', '<g><rect x="-12" y="-18" width="24" height="18" rx="4" fill="#2a9d8f"/><path d="M-12,-14 L-30,-2" stroke="#2a9d8f" stroke-width="4" stroke-linecap="round"/><path d="M12,-14 q8,4 0,12" stroke="#2a9d8f" stroke-width="3" fill="none"/><g transform="translate(-32,0)"><circle class="mh-drop" r="2" fill="#7fd6ff"/><circle class="mh-drop" r="2" fill="#7fd6ff"/><circle class="mh-drop" r="2" fill="#7fd6ff"/></g></g>'],
    caneL: ['Lup', '<g><rect x="-3" y="-118" width="7" height="128" rx="3" fill="#6b8e23"/><path d="M-3,-90 h7 M-3,-60 h7 M-3,-30 h7" stroke="#4d6b14" stroke-width="2"/><path d="M0,-118 q-20,-20 -30,-8 M1,-118 q16,-24 28,-14" stroke="#3ddc97" stroke-width="4" fill="none" stroke-linecap="round"/></g>'],
    batR: ['Rrig', '<g><rect x="-2" y="-12" width="4" height="16" fill="#333"/><rect x="-6" y="4" width="12" height="62" rx="4" fill="#e0b97a"/></g>'],
    santahat: ['head', '<g transform="translate(228,70) rotate(22)"><path d="M-40,12 Q-14,-56 30,-40 Q24,-12 40,12Z" fill="#e74c3c"/><rect x="-44" y="6" width="88" height="14" rx="7" fill="#fff"/><circle cx="33" cy="-42" r="9" fill="#fff"/></g>'],
    partyhat: ['head', '<g transform="translate(222,66) rotate(16)"><path d="M-24,8 L4,-56 L26,8Z" fill="#c792ff"/><path d="M-16,-10 L18,-10 M-8,-30 L12,-30" stroke="#ffd34d" stroke-width="5"/><circle cx="4" cy="-58" r="7" fill="#ffd34d"/></g>'],
    headphones: ['head', '<g><path d="M100,148 C96,30 304,30 300,148" stroke="#2d343d" stroke-width="9" fill="none"/><rect x="86" y="120" width="26" height="56" rx="12" fill="#e74c3c"/><rect x="288" y="120" width="26" height="56" rx="12" fill="#e74c3c"/></g>'],
    veshti: ['torso', '<g><path d="M154,330 C175,340 225,340 246,330 L246,340 C244,374 156,374 154,340Z" fill="#fffdf5"/><path d="M158,358 C175,368 225,368 242,358" stroke="#d4a017" stroke-width="5" fill="none"/><path d="M200,338 v30" stroke="#efe6cc" stroke-width="2"/></g>'],
  };
  const SLOT = { rigFront: 'rigFront', back: 'back', front: 'front', Lup: 'handLup', Rup: 'handRup', Lrig: 'handLrig', Rrig: 'handRrig', head: 'headAcc', torso: 'torsoAcc' };
  // Seasonal accessories (follow the app's seasonal theme; removed outside a season).
  const FESTIVE = { christmas: ['santahat'], newyear: ['partyhat'], pongal: ['veshti'], diwali: [] };
  const SEASONS = ['christmas', 'newyear', 'pongal', 'diwali'];

  // =====================================================================================
  // 5. SVG markup
  // =====================================================================================
  function svgMarkup() {
    return `<svg class="mahi-svg" viewBox="0 0 400 440" role="img" aria-label="MAHI, your workflow companion: a white floating robot with a black visor and glowing blue eyes">
<defs>
  <radialGradient id="mh-gShell" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef2f6"/><stop offset="1" stop-color="#b9c5d1"/></radialGradient>
  <radialGradient id="mh-gShell2" cx="40%" cy="25%" r="85%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e6ebf1"/><stop offset="1" stop-color="#a9b6c3"/></radialGradient>
  <linearGradient id="mh-gPod" x1="0" x2="1"><stop offset="0" stop-color="#8e9bab"/><stop offset=".5" stop-color="#d7dee6"/><stop offset="1" stop-color="#7d8a99"/></linearGradient>
  <radialGradient id="mh-gVisor" cx="45%" cy="35%" r="75%"><stop offset="0" stop-color="#1d2735"/><stop offset=".7" stop-color="#0a0f16"/><stop offset="1" stop-color="#04060a"/></radialGradient>
  <radialGradient id="mh-gEye" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#eafcff"/><stop offset=".45" style="stop-color:var(--eye,#5fdcff)"/><stop offset="1" style="stop-color:var(--eye2,#1b8fff)"/></radialGradient>
  <linearGradient id="mh-gHi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <filter id="mh-fGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="mh-fSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <pattern id="mh-pLed" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="none"/><rect x="2" y="0" width="1" height="3" fill="#000" opacity=".35"/><rect x="0" y="2" width="3" height="1" fill="#000" opacity=".35"/></pattern>
  <clipPath id="mh-cVisor"><ellipse cx="200" cy="152" rx="74" ry="52"/></clipPath>
</defs>
<g id="mh-back"></g>
<ellipse id="mh-shadow" cx="200" cy="418" rx="70" ry="9" fill="#000" opacity=".28" filter="url(#mh-fSoft)"/>
<g id="mh-rig">
  <g id="mh-torso">
    <path d="M148,262 C148,242 252,242 252,262 L246,340 C244,374 156,374 154,340 Z" fill="url(#mh-gShell2)"/>
    <path d="M160,262 C162,252 188,248 196,250 C176,262 170,300 168,330 C164,310 160,282 160,262Z" fill="url(#mh-gHi)" opacity=".55"/>
    <path d="M154,334 C175,344 225,344 246,334" stroke="#2a9d8f" stroke-width="2" fill="none" opacity=".8"/>
    <rect x="186" y="270" width="28" height="15" rx="7" fill="#101820"/>
    <circle id="mh-chest" cx="200" cy="277.5" r="4" fill="#39d0ff" filter="url(#mh-fGlow)"/>
    <g id="mh-torsoAcc"></g>
  </g>
  <ellipse cx="200" cy="246" rx="44" ry="7" fill="none" stroke="#39d0ff" stroke-width="2" opacity=".6" filter="url(#mh-fGlow)"/>
  <g id="mh-head">
    <rect x="92" y="122" width="18" height="58" rx="8" fill="url(#mh-gPod)"/>
    <rect x="290" y="122" width="18" height="58" rx="8" fill="url(#mh-gPod)"/>
    <rect id="mh-earL" x="96" y="134" width="4" height="34" rx="2" fill="#39d0ff" filter="url(#mh-fGlow)" opacity=".85"/>
    <rect id="mh-earR" x="300" y="134" width="4" height="34" rx="2" fill="#39d0ff" filter="url(#mh-fGlow)" opacity=".85"/>
    <ellipse cx="200" cy="150" rx="100" ry="90" fill="url(#mh-gShell)"/>
    <path d="M128,96 C150,70 196,62 230,70 C200,72 160,84 136,108Z" fill="#fff" opacity=".8"/>
    <rect id="mh-topLed" x="188" y="58" width="24" height="6" rx="3" fill="#39d0ff" filter="url(#mh-fGlow)"/>
    <ellipse cx="200" cy="152" rx="78" ry="56" fill="#cfd8e2"/>
    <ellipse cx="200" cy="152" rx="74" ry="52" fill="url(#mh-gVisor)"/>
    <g clip-path="url(#mh-cVisor)">
      <g id="mh-eyes" filter="url(#mh-fGlow)">
        <g id="mh-eyeLg"><path id="mh-eyeL" fill="url(#mh-gEye)"/></g>
        <g id="mh-eyeRg"><path id="mh-eyeR" fill="url(#mh-gEye)"/></g>
        <g id="mh-symL" transform="translate(170,152)"></g>
        <g id="mh-symR" transform="translate(230,152)"></g>
      </g>
      <g id="mh-eq" opacity="0" fill="#5fdcff" filter="url(#mh-fGlow)">
        <rect x="183" y="186" width="5" height="4" rx="2"/><rect x="191" y="186" width="5" height="4" rx="2"/><rect x="199" y="186" width="5" height="4" rx="2"/><rect x="207" y="186" width="5" height="4" rx="2"/><rect x="215" y="186" width="5" height="4" rx="2"/>
      </g>
      <rect x="120" y="96" width="160" height="112" fill="url(#mh-pLed)"/>
      <path d="M150,118 C170,104 214,102 238,110" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".12"/>
    </g>
    <g id="mh-headAcc"></g>
  </g>
  <g id="mh-armL" transform="translate(146,268)">
    <circle r="11" fill="url(#mh-gPod)" opacity=".9"/>
    <path d="M-9,2 C-16,20 -17,55 -11,78 C-7,92 7,92 11,78 C17,55 16,20 9,2 Z" fill="url(#mh-gShell2)"/>
    <path d="M-6,8 C-10,24 -11,50 -8,66" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>
    <g transform="translate(0,84)"><g id="mh-handLup"></g><g id="mh-handLrig"></g></g>
  </g>
  <g id="mh-armR" transform="translate(254,268)">
    <circle r="11" fill="url(#mh-gPod)" opacity=".9"/>
    <path d="M-9,2 C-16,20 -17,55 -11,78 C-7,92 7,92 11,78 C17,55 16,20 9,2 Z" fill="url(#mh-gShell2)"/>
    <path d="M-6,8 C-10,24 -11,50 -8,66" stroke="#fff" stroke-width="3" fill="none" opacity=".7" stroke-linecap="round"/>
    <g transform="translate(0,84)"><g id="mh-handRup"></g><g id="mh-handRrig"></g></g>
  </g>
  <g id="mh-rigFront"></g>
  <g id="mh-ov">
    <g class="mh-ov" data-ov="q"><text class="mh-float" x="302" y="86" font-size="42" font-weight="700" fill="#39d0ff">?</text></g>
    <g class="mh-ov" data-ov="ex"><text class="mh-float" x="306" y="86" font-size="44" font-weight="800" fill="#ffb02e">!</text></g>
    <g class="mh-ov" data-ov="dots"><circle class="mh-tw" cx="292" cy="78" r="5" fill="#9fc7da"/><circle class="mh-tw" cx="308" cy="64" r="7" fill="#9fc7da"/><circle class="mh-tw" cx="326" cy="46" r="10" fill="#9fc7da"/></g>
    <g class="mh-ov" data-ov="sweat"><path class="mh-drip" d="M296,86 q-6,10 0,14 q6,-4 0,-14z" fill="#6fcff5"/></g>
    <g class="mh-ov" data-ov="z"><text class="mh-float" x="296" y="80" font-size="24" fill="#7f9fb4" font-weight="700">z</text></g>
    <g class="mh-ov" data-ov="zzz"><text class="mh-zz" x="290" y="86" font-size="20" fill="#7f9fb4" font-weight="700">z</text><text class="mh-zz" x="304" y="70" font-size="26" fill="#7f9fb4" font-weight="700">z</text><text class="mh-zz" x="318" y="52" font-size="32" fill="#7f9fb4" font-weight="700">Z</text></g>
    <g class="mh-ov" data-ov="spark"><path class="mh-tw" d="M96,80 l4,10 10,4 -10,4 -4,10 -4,-10 -10,-4 10,-4z" fill="#f2c94c"/><path class="mh-tw" d="M310,58 l3,8 8,3 -8,3 -3,8 -3,-8 -8,-3 8,-3z" fill="#f2c94c"/><path class="mh-tw" d="M330,150 l3,7 7,3 -7,3 -3,7 -3,-7 -7,-3 7,-3z" fill="#f2c94c"/><path class="mh-tw" d="M78,170 l3,7 7,3 -7,3 -3,7 -3,-7 -7,-3 7,-3z" fill="#f2c94c"/></g>
    <g class="mh-ov" data-ov="ha"><text class="mh-float" x="292" y="80" font-size="18" fill="#d9a400" font-weight="700">ha ha!</text></g>
    <g class="mh-ov" data-ov="confettiS"><g class="mh-burst" transform="translate(200,60)"><rect width="6" height="3" fill="#ff6b6b" style="--dx:-70px;--dy:-30px"/><rect width="6" height="3" fill="#ffd34d" style="--dx:60px;--dy:-40px"/><rect width="6" height="3" fill="#3ddc97" style="--dx:-40px;--dy:-60px"/><rect width="6" height="3" fill="#39d0ff" style="--dx:80px;--dy:-10px"/><rect width="6" height="3" fill="#c792ff" style="--dx:20px;--dy:-70px"/><rect width="6" height="3" fill="#ff9f43" style="--dx:-90px;--dy:0px"/><rect width="6" height="3" fill="#ffd34d" style="--dx:100px;--dy:-50px"/><rect width="6" height="3" fill="#ff6b6b" style="--dx:-10px;--dy:-80px"/></g></g>
    <g class="mh-ov" data-ov="check"><g class="mh-float"><circle cx="312" cy="70" r="20" fill="#3ddc97"/><path d="M302,70 l7,7 13,-14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>
    <g class="mh-ov" data-ov="rev"><g class="mh-float"><circle cx="312" cy="70" r="20" fill="#ffb02e"/><g class="mh-spin"><path d="M302,70 a10,10 0 1,1 4,8" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M300,62 l2,9 8,-3z" fill="#fff"/></g></g></g>
    <g class="mh-ov" data-ov="cloud"><g class="mh-float"><path d="M292,80 a12,12 0 0,1 4,-23 a16,16 0 0,1 30,4 a10,10 0 0,1 2,19z" fill="#e8f6ff" stroke="#b9d4e6"/><g class="mh-spin"><path d="M302,70 a8,8 0 1,1 16,0" stroke="#1b8fff" stroke-width="3" fill="none"/><path d="M318,70 l-4,-4 m4,4 l3,-5" stroke="#1b8fff" stroke-width="3" stroke-linecap="round"/></g></g></g>
    <g class="mh-ov" data-ov="cloudOff"><g class="mh-float"><path d="M292,80 a12,12 0 0,1 4,-23 a16,16 0 0,1 30,4 a10,10 0 0,1 2,19z" fill="#8a96a3"/><path d="M296,54 l30,30" stroke="#ff6b6b" stroke-width="4" stroke-linecap="round"/></g></g>
    <g class="mh-ov" data-ov="warn"><g class="mh-float"><path d="M312,48 l24,42 h-48z" fill="#ffb02e"/><text x="307" y="84" font-size="26" font-weight="800" fill="#2b2516">!</text></g></g>
    <g class="mh-ov" data-ov="hour"><g class="mh-spin"><path d="M300,52 h24 l-12,16 12,16 h-24 l12,-16z" fill="#e8f6ff" stroke="#9fb2c4" stroke-width="2"/></g></g>
    <g class="mh-ov" data-ov="waves"><g transform="translate(312,150)"><path class="mh-pulse" d="M0,-12 a14,14 0 0,1 0,24" stroke="#39d0ff" stroke-width="3" fill="none"/><path class="mh-pulse" d="M8,-20 a24,24 0 0,1 0,40" stroke="#39d0ff" stroke-width="3" fill="none"/><path class="mh-pulse" d="M16,-28 a34,34 0 0,1 0,56" stroke="#39d0ff" stroke-width="3" fill="none"/></g></g>
    <g class="mh-ov" data-ov="trophy"><g class="mh-float"><path d="M298,48 h30 v8 a15,15 0 0,1 -30,0z" fill="#ffd34d"/><path d="M298,52 h-7 a7,7 0 0,0 9,12 M328,52 h7 a7,7 0 0,1 -9,12" stroke="#ffd34d" stroke-width="3" fill="none"/><rect x="309" y="70" width="8" height="10" fill="#e0b33a"/><rect x="301" y="80" width="24" height="6" rx="2" fill="#c9971f"/></g></g>
    <g class="mh-ov" data-ov="medal"><g class="mh-float"><path d="M302,40 l8,20 M322,40 l-8,20" stroke="#39d0ff" stroke-width="6"/><circle cx="312" cy="72" r="14" fill="#ffd34d" stroke="#e0b33a" stroke-width="3"/><path d="M312,64 l3,6 6,1 -5,4 1,6 -5,-3 -5,3 1,-6 -5,-4 6,-1z" fill="#fff6c2"/></g></g>
    <g class="mh-ov" data-ov="badgeDay"><g class="mh-float"><rect x="282" y="52" width="66" height="28" rx="14" fill="#3ddc97"/><text x="315" y="71" font-size="13" font-weight="800" fill="#05301f" text-anchor="middle">DAY ✓</text></g></g>
  </g>
</g>
<g id="mh-front"></g>
</svg>`;
  }

  // =====================================================================================
  // 6. Activities (idle life). Idle activities are silent: no bubble, no speech.
  // =====================================================================================
  const A = (id, name, cat, steps, props, extra) => Object.assign({ id, name, cat, steps, props: props || [] }, extra || {});
  const st = (e, d, o) => Object.assign({ e, d }, o || {});
  const ACTS = [
    A('wake', 'Waking up', 'Morning', [st('Sleeping', 1200), st('Sleepy', 1000), st('Surprised', 500), st('Happy', 1500)]),
    A('stretch', 'Stretching', 'Morning', [st('Sleepy', 900, { pose: 'stretch' }), st('Happy', 2400, { pose: 'stretch' }), st('Smiling', 800)]),
    A('coffee', 'Drinking coffee', 'Morning', [st('Smiling', 4200, { pose: 'sip' })], ['mugR']),
    A('notebook', 'Opening a notebook', 'Morning', [st('Curious', 900, { pose: 'hold' }), st('Reading', 3000)], ['notebook']),
    A('wave', 'Waving', 'Morning', [st('Waving', 3000)]),
    A('plan', 'Checking the daily plan', 'Morning', [st('Focused', 900, { pose: 'point' }), st('Smiling', 3600, { pose: 'point' })], ['checklist']),
    A('type', 'Typing on a mini laptop', 'Working', [st('Typing', 4600)], ['laptop']),
    A('report', 'Reading a report', 'Working', [st('Reading', 4200)], ['report']),
    A('clip', 'Checking a clipboard', 'Working', [st('Focused', 4200, { pose: 'clip' })], ['clipboardL', 'pencilR']),
    A('write', 'Writing with a pencil', 'Working', [st('Focused', 4200, { pose: 'write' })], ['notebook', 'pencilR']),
    A('charts', 'Studying charts', 'Working', [st('Curious', 1500, { pose: 'point' }), st('Thinking', 2600)], ['chart']),
    A('magnify', 'Using a magnifying glass', 'Working', [st('Searching', 4200, { pose: 'sweep' })], ['magnifierR']),
    A('files', 'Organising tiny files', 'Working', [st('Focused', 4200, { pose: 'sort' })], ['files']),
    A('cricket', 'Playing mini cricket', 'Playful', [st('Focused', 1200, { pose: 'bat' }), st('Excited', 3200, { pose: 'bat' })], ['batR', 'stumps', 'cball']),
    A('football', 'Bouncing a football', 'Playful', [st('Happy', 4400, { pose: 'cheerLow' })], ['football']),
    A('basket', 'Playing basketball', 'Playful', [st('Focused', 1200, { pose: 'throw' }), st('Excited', 2800, { pose: 'throw' })], ['hoop', 'bball']),
    A('plane', 'Throwing a paper airplane', 'Playful', [st('Curious', 3600, { pose: 'throw' })], ['plane']),
    A('puzzle', 'Solving a puzzle', 'Playful', [st('Thinking', 2000, { pose: 'hold' }), st('Happy', 1800, { pose: 'hold' })], ['puzzle']),
    A('car', 'Playing with a toy car', 'Playful', [st('Excited', 4500, { pose: 'clap' })], ['car']),
    A('dance', 'Dancing', 'Playful', [st('Happy', 4600, { pose: 'dance' })], ['notes'], { sway: 10 }),
    A('draw', 'Drawing', 'Playful', [st('Focused', 2400, { pose: 'point' }), st('Proud', 1800)], ['easel', 'pencilR']),
    A('gym', 'Exercising with dumbbells', 'Playful', [st('Motivating', 4400, { pose: 'lift' })], ['dumbL', 'dumbR']),
    A('music', 'Listening to music', 'Playful', [st('Smiling', 4600, { pose: 'rest' })], ['headphones', 'notes'], { sway: 6 }),
    A('book', 'Reading a book', 'Relaxation', [st('Reading', 4600)], ['book']),
    A('water', 'Drinking water', 'Relaxation', [st('Smiling', 3600, { pose: 'sip' })], ['bottleR']),
    A('plant', 'Watering a small plant', 'Relaxation', [st('Smiling', 4200, { pose: 'water' })], ['plant', 'canL']),
    A('rest', 'Resting', 'Relaxation', [st('Sleepy', 4200)]),
    A('sleep', 'Sleeping', 'Relaxation', [st('Sleeping', 5000)]),
    A('bfly', 'Watching butterflies', 'Relaxation', [st('Curious', 1800), st('Happy', 2800)], ['butterflies']),
    A('close', 'Closing her laptop', 'Evening', [st('Smiling', 2600)], ['laptopClose']),
    A('review', 'Reviewing completed tasks', 'Evening', [st('Reading', 2400, { pose: 'point' }), st('Proud', 1800)], ['checklist']),
    A('tomorrow', "Organising tomorrow's checklist", 'Evening', [st('Focused', 4200, { pose: 'write' })], ['checklist', 'pencilR']),
    A('bye', 'Waving goodbye', 'Evening', [st('Goodbye', 3000)]),
    A('gotosleep', 'Going to sleep', 'Evening', [st('Sleepy', 1600), st('Sleeping', 3400)]),
    // seasonal (only during the matching season)
    A('x-catch', 'Catching snowflakes', 'christmas', [st('Excited', 4400, { pose: 'catch' })], ['snow', 'snowground']),
    A('x-snowman', 'Building a snowman', 'christmas', [st('Happy', 4200, { pose: 'point' })], ['snow', 'snowground', 'snowman']),
    A('x-ball', 'Throwing snowballs', 'christmas', [st('Laughing', 4200, { pose: 'throw' })], ['snow', 'snowground', 'snowman', 'snowball']),
    A('x-slide', 'Sliding on snow', 'christmas', [st('Excited', 4400, { pose: 'cheerLow' })], ['snow', 'snowground', 'sled'], { sway: 22 }),
    A('x-tree', 'Decorating a Christmas tree', 'christmas', [st('Happy', 4400, { pose: 'shrug' })], ['tree', 'snowground']),
    A('x-gift', 'Carrying a gift', 'christmas', [st('Smiling', 4000, { pose: 'carry' })], ['gift', 'snow']),
    A('n-dance', 'New Year dance', 'newyear', [st('Happy', 4400, { pose: 'dance' })], ['notes', 'confetti'], { sway: 10 }),
    A('n-confetti', 'Popping confetti', 'newyear', [st('Celebrating', 4000)], ['confetti']),
    A('n-count', 'Countdown', 'newyear', [st('Excited', 1000, { cd: '3' }), st('Excited', 1000, { cd: '2' }), st('Excited', 1000, { cd: '1' }), st('Celebrating', 2600, { cd: 'year' })], ['yeartext', 'fireworks']),
    A('n-fire', 'Watching fireworks', 'newyear', [st('Surprised', 1200), st('Happy', 3400)], ['fireworks', 'yeartext']),
    A('p-cane', 'Holding sugarcane', 'pongal', [st('Smiling', 4000, { pose: 'sugarcane' })], ['caneL']),
    A('p-pot', 'Preparing a Pongal pot', 'pongal', [st('Curious', 1500, { pose: 'point' }), st('Excited', 3000, { pose: 'point' })], ['pongalpot']),
    A('p-cheer', 'Pongalo Pongal!', 'pongal', [st('Celebrating', 4200)], ['pongalpot', 'pongaltext', 'caneL']),
    A('p-kolam', 'Drawing a kolam', 'pongal', [st('Focused', 4400, { pose: 'hold', gaze: 'down' })], ['kolam']),
    A('p-rings', 'Ring toss', 'pongal', [st('Focused', 1200, { pose: 'toss' }), st('Excited', 3200, { pose: 'toss' })], ['peg', 'rings']),
    A('d-diya', 'Lighting diyas', 'diwali', [st('Smiling', 4400, { pose: 'hold' })], ['diyas']),
    A('d-rangoli', 'Arranging a rangoli', 'diwali', [st('Focused', 2200), st('Proud', 2200)], ['rangoli']),
    A('d-lights', 'Festive lights', 'diwali', [st('Happy', 4400, { pose: 'cheerLow' })], ['lights', 'diyas']),
  ];
  const actById = Object.fromEntries(ACTS.map((a) => [a.id, a]));
  // Activity names used by the first character → new activities.
  const ACT_ALIAS = { typing: 'type', clipboard: 'clip', reports: 'report', cards: 'files', clock: 'plan', notebook: 'write', headphones: 'music', thumbs: 'draw', break: 'water' };
  const ACTIVITIES = Object.assign({}, actById);
  Object.keys(ACT_ALIAS).forEach((k) => { if (!ACTIVITIES[k]) ACTIVITIES[k] = actById[ACT_ALIAS[k]]; });

  // =====================================================================================
  // 7. Reactions. level = 1 (most important) … 10 (sleep):
  //    1 security · 2 failed save / conflict · 3 user question · 4 report confirmation / verified save ·
  //    5 deadline · 6 verified achievement · 7 motivation / greeting · 8 seasonal · 9 idle · 10 sleep
  // =====================================================================================
  const R = (e, o) => Object.assign({ e, level: 7, mood: 'calm', props: [], sound: 'chime' }, o || {});
  const EMOTIONS = {
    happy: R('Happy', { mood: 'happy' }),
    excited: R('Excited', { mood: 'happy' }),
    sad: R('Sad', { mood: 'alert' }),
    thinking: R('Thinking', { duration: 1600 }),
    confused: R('Confused'),
    concerned: R('Concerned', { mood: 'warn', sound: 'alert' }),
    celebrating: R('Celebrating', { mood: 'celebrate', sound: 'celebrate', confetti: 50 }),
    waving: R('Waving', { mood: 'happy' }),
    sleeping: R('Sleepy', { mood: 'sleep' }),
    working: R('Working', { props: ['laptop'] }),
    searching: R('Searching', { props: ['magnifierR'], pose: 'sweep', duration: 1600 }),
    appreciating: R('Appreciating', { mood: 'happy' }),
    warning: R('Warning', { mood: 'warn', sound: 'alert' }),
    motivating: R('Motivating', { mood: 'happy' }),
    trophy: R('Proud', { mood: 'celebrate' }),
    heart: R('Appreciating', { mood: 'happy' }),
    clipboard: R('Reading', { props: ['clipboardL'] }),
    thumbsUp: R('Winking', { mood: 'happy' }),
    clock: R('Concerned', { mood: 'warn', sound: 'alert', steps: [['Waiting', 1400], ['Concerned', 2800]] }),
    goodbye: R('Goodbye'),
  };
  const REACTIONS = Object.assign({}, EMOTIONS, {
    // 1 · security
    security: R('Warning', { level: 1, mood: 'alert', sound: 'alert', duration: 6000 }),
    auth: R('Warning', { level: 1, mood: 'alert', sound: 'alert', duration: 6000 }),
    // 2 · failed save / conflict / offline
    saveFailed: R('Concerned', { level: 2, mood: 'warn', sound: 'alert', steps: [['Concerned', 3200], ['Apologising', 2400]] }),
    conflict: R('Revision required', { level: 2, mood: 'warn', sound: 'alert', duration: 5000 }),
    offline: R('Offline', { level: 2, mood: 'warn', duration: 3600 }),
    // 4 · report confirmation / verified save (only sent by the app after the save is verified)
    saved: R('Approval received', { level: 4, mood: 'happy', steps: [['Synchronising', 700], ['Approval received', 3500]] }),
    savedBig: R('Celebrating', { level: 4, mood: 'celebrate', sound: 'celebrate', steps: [['Approval received', 1400], ['Celebrating', 3400]] }),
    confirm: R('Speaking', { level: 4, props: ['clipboardL'], pose: 'clip', duration: 6000 }),
    reconnected: R('Reconnected', { level: 4, mood: 'happy', duration: 2600 }),
    // 5 · deadlines and corrections
    deadline: R('Concerned', { level: 5, mood: 'warn', sound: 'alert', steps: [['Waiting', 1200], ['Concerned', 3400]] }),
    overdue: R('Warning', { level: 5, mood: 'alert', sound: 'alert' }),
    reminder: R('Speaking', { level: 5, mood: 'warn', steps: [['Surprised', 800], ['Speaking', 3600]], props: ['notebook'] }),
    correction: R('Revision required', { level: 5, mood: 'warn', sound: 'alert' }),
    bottleneck: R('Concerned', { level: 5, mood: 'warn', sound: 'alert', props: ['chart'], steps: [['Searching', 1400], ['Concerned', 3200]] }),
    // 6 · verified achievements (fired by the store after a completion is saved)
    poster: R('Proud', { level: 6, mood: 'happy', props: ['easel'] }),
    ai: R('Excited', { level: 6, mood: 'happy' }),
    vj: R('Proud', { level: 6, mood: 'happy' }),
    task: R('Happy', { level: 6, mood: 'happy' }),
    custom: R('Happy', { level: 6, mood: 'happy', steps: [['Winking', 1400], ['Happy', 2800]] }),
    multi: R('Excited', { level: 6, mood: 'celebrate' }),
    brand: R('Proud', { level: 6, mood: 'happy' }),
    achievement: R('Proud', { level: 6, mood: 'celebrate', sound: 'celebrate', confetti: 50, steps: [['Surprised', 700], ['Proud', 3600]] }),
    milestone25: R('Happy', { level: 6, mood: 'happy' }),
    milestone50: R('Excited', { level: 6, mood: 'celebrate', sound: 'celebrate', confetti: 60 }),
    milestone75: R('Celebrating', { level: 6, mood: 'celebrate', sound: 'celebrate', confetti: 80 }),
    daily: R('Daily target achieved', { level: 6, mood: 'celebrate', sound: 'celebrate', confetti: 40, duration: 5200 }),
    weekly: R('Weekly target achieved', { level: 6, mood: 'celebrate', sound: 'celebrate', confetti: 80, duration: 6000 }),
    monthly: R('Monthly target achieved', { level: 6, mood: 'celebrate', sound: 'celebrate', confetti: 120, duration: 6500 }),
    set100: R('Weekly target achieved', { level: 6, mood: 'celebrate', sound: 'celebrate', confetti: 180, banner: true, duration: 7500 }),
    grand: R('Monthly target achieved', { level: 6, mood: 'celebrate', sound: 'celebrate', confetti: 260, fireworks: true, certificate: true, duration: 10000, props: ['fireworks'] }),
    // 7 · greetings, information, motivation
    welcome: R('Waving', { mood: 'happy' }),
    welcomeBack: R('Waving', { mood: 'happy', steps: [['Waving', 2600], ['Smiling', 2400]] }),
    wake: R('Happy', { mood: 'happy', steps: [['Sleepy', 900], ['Surprised', 500], ['Happy', 2400]] }),
    info: R('Speaking', { props: ['report'] }),
    focus: R('Working', { props: ['laptop'] }),
    focusEnd: R('Happy', { mood: 'happy', pose: 'stretch', duration: 4200 }),
  });

  // =====================================================================================
  // 8. State
  // =====================================================================================
  let el = null, svgEl = null, bubble = null, dock = null, N = {}, opts = {};
  let festival = 'default', focusMode = false, sleeping = false, sleptAt = 0, lastInput = Date.now(), lastKey = 0;
  let running = null, runToken = 0, queue = [], lastIdleEnd = Date.now(), hideBubbleTimer = 0, holdTimer = 0;
  const cooldown = new Map(), recentMsgs = new Map(), spoken = new Map(), syncCool = new Map();
  let timers = [], observers = [];

  const has = (fn, dflt) => { try { return fn ? !!fn() : dflt; } catch (e) { return dflt; } };
  const isReduced = () => has(opts.reduced, false);
  const isPaused = () => has(opts.paused, false);
  const decorOn = () => has(opts.decor, true);
  const drawerOpen = () => doc.body.classList.contains('drawer-open');
  const dockAway = () => !!dock && (dock.classList.contains('hidden') || dock.classList.contains('min'));
  function typing() {
    if (Date.now() - lastKey < 6000) return true;
    const a = doc.activeElement;
    return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
  }
  const istNow = () => { const d = new Date(Date.now() + 330 * 60000); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, h: d.getUTCHours() }; };
  const upcomingYear = () => { const t = istNow(); return t.m === 12 ? t.y + 1 : t.y; };
  // Accessories follow the app's seasonal theme (<html data-season>). If the page has no theme
  // system at all, fall back to the festival passed to setFestival().
  function season() {
    const ds = doc.documentElement.dataset;
    if (SEASONS.includes(ds.season)) return ds.season;
    if (!ds.theme && SEASONS.includes(festival)) return festival;
    return null;
  }

  // =====================================================================================
  // 9. Rendering
  // =====================================================================================
  const $ = (id) => N[id] || (N[id] = svgEl.querySelector('#mh-' + id));
  function setA(node, attr, val) { if (!node) return; const c = node.__mh || (node.__mh = {}); if (c[attr] !== val) { c[attr] = val; node.setAttribute(attr, val); } }

  const lerp = (a, b, k) => a + (b - a) * k;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const cur = { L: clone(EY.open), R: clone(EY.open), col: BLUE.slice(), arms: { L: 8, R: -8 }, tilt: 0, hy: 0, rigY: 0, dim: 0, gx: 0, gy: 0, es: 1, bobAmp: 1, bobSp: 1.6, shake: 0 };
  let tgt = EXPR.Neutral, tgtName = 'Neutral', shownSym = [null, null], swapping = false, pose = POSE.rest, gazeOverride = null, sway = 0;
  let speaking = false, eqH = [4, 4, 4, 4, 4], mouse = { x: 0, y: 0, has: false }, blinkUntil = 0, nextBlink = 0;

  let activeProps = '';
  function setScene(list, force) {
    if (!svgEl) return;
    const s = season();
    const acc = decorOn() && s ? FESTIVE[s] : [];
    const all = [...new Set([...(list || []), ...acc])].filter((p) => PROPS[p]);
    if (all.includes('headphones')) ['santahat', 'partyhat'].forEach((h) => { const i = all.indexOf(h); if (i >= 0) all.splice(i, 1); });
    const key = all.join('|'); if (!force && key === activeProps) return;
    const prev = activeProps.split('|'); activeProps = key;
    Object.values(SLOT).forEach((id) => { $(id).innerHTML = ''; });
    // only newly added props fade in (a seasonal hat that stays on must not flicker)
    all.forEach((p) => { const [slot, html] = PROPS[p]; $(SLOT[slot]).insertAdjacentHTML('beforeend', `<g${prev.includes(p) ? '' : ' class="mh-fade"'} data-p="${p}">${html}</g>`); });
    const yt = svgEl.querySelector('.mh-yeartext'); if (yt) yt.textContent = String(upcomingYear());
    kick();
  }
  function setBadge(text) {
    const f = $('front'); const old = f.querySelector('.mh-badge'); if (old) old.remove();
    if (text) f.insertAdjacentHTML('beforeend', `<g class="mh-badge mh-fade"><rect x="${200 - Math.min(170, 14 + String(text).length * 9)}" y="404" width="${Math.min(340, 28 + String(text).length * 18)}" height="28" rx="14" fill="#1F5E45"/><text x="200" y="424" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">${esc(String(text).slice(0, 22))}</text></g>`);
  }

  function setExprInternal(name) {
    const n = exprName(name); if (!n || !svgEl) return;
    tgt = EXPR[n]; tgtName = n; pose = POSE[tgt.pose] || POSE.rest; gazeOverride = null;
    svgEl.querySelectorAll('.mh-ov').forEach((g) => g.classList.toggle('mh-on', tgt.ov.includes(g.dataset.ov)));
    const want = tgt.sym || [null, null];
    if (want[0] !== shownSym[0] || want[1] !== shownSym[1]) swapping = true;
    const ear = tgt.ear || [57, 208, 255], chest = tgt.chest || [57, 208, 255];
    ['earL', 'earR', 'topLed'].forEach((s) => setA($(s), 'fill', `rgb(${ear})`));
    setA($('chest'), 'fill', `rgb(${chest})`);
    if (el) el.setAttribute('data-expr', n);
    kick();
  }
  function applySym() {
    shownSym = (tgt.sym || [null, null]).slice();
    $('symL').innerHTML = shownSym[0] ? SYM[shownSym[0]] : ''; $('symR').innerHTML = shownSym[1] ? SYM[shownSym[1]] : '';
  }
  function eyeD(cx, cy, p) {
    const x0 = cx - p.w / 2, x1 = cx + p.w / 2, ty = cy - p.h * p.t, by = cy + p.h * p.b;
    return `M${x0.toFixed(1)},${cy} C${x0.toFixed(1)},${ty.toFixed(1)} ${x1.toFixed(1)},${ty.toFixed(1)} ${x1.toFixed(1)},${cy} C${x1.toFixed(1)},${by.toFixed(1)} ${x0.toFixed(1)},${by.toFixed(1)} ${x0.toFixed(1)},${cy}Z`;
  }

  // Animation loop: ~30 fps, stops while the tab is hidden, the dock is hidden/minimised,
  // or (after settling) when MAHI is paused or reduced motion is on.
  let raf = 0, last = 0, T = 0, lastDraw = 0, activeUntil = 0;
  function kick(ms) { activeUntil = Math.max(activeUntil, performance.now() + (ms || 900)); startLoop(); }
  function startLoop() { if (!raf && svgEl && !doc.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stopLoop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function frame(now) {
    raf = 0;
    if (doc.hidden || !svgEl) return;
    const still = isReduced() || isPaused() || dockAway();
    if (!still && now - lastDraw < 32) { raf = requestAnimationFrame(frame); return; }
    lastDraw = now;
    const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
    const k = still ? 1 : 1 - Math.exp(-dt * 9);
    // eyes
    const sym = tgt.sym || [null, null];
    const tL = sym[0] ? EY.hidden : tgt.L;
    const rBase = tgt.R || Object.assign({}, tgt.L, { r: -tgt.L.r });
    const tR = sym[1] ? EY.hidden : rBase;
    if (swapping) { cur.es = lerp(cur.es, 0, Math.min(1, k * 2)); if (cur.es < .08) { applySym(); swapping = false; } } else cur.es = lerp(cur.es, 1, k);
    ['w', 'h', 't', 'b', 'r'].forEach((f) => { cur.L[f] = lerp(cur.L[f], tL[f], k); cur.R[f] = lerp(cur.R[f], tR[f], k); });
    for (let i = 0; i < 3; i++) cur.col[i] = lerp(cur.col[i], tgt.col[i], k);
    if (!still && now > nextBlink && !tgt.sym && tL.h > 12) { blinkUntil = now + 130; nextBlink = now + 2600 + Math.random() * 3800; }
    const blink = now < blinkUntil ? .1 : 1;
    // gaze
    const gz = gazeOverride || tgt.gaze; let gx = 0, gy = 0;
    if (!still) {
      if (gz === 'mouse' && mouse.has) { gx = Math.max(-1, Math.min(1, mouse.x)) * 7; gy = Math.max(-1, Math.min(1, mouse.y)) * 5; }
      else if (gz === 'up') gy = -6; else if (gz === 'down') gy = 6; else if (gz === 'upRight') { gx = 7; gy = -6; }
      else if (gz === 'scan') gx = Math.sin(T * 2.2) * 9; else if (gz === 'around') { gx = Math.sin(T * .7) * 7; gy = Math.cos(T * .45) * 4; }
    } else if (gz === 'down') gy = 6; else if (gz === 'upRight') { gx = 7; gy = -6; }
    cur.gx = lerp(cur.gx, gx, k); cur.gy = lerp(cur.gy, gy, k);
    const L = Object.assign({}, cur.L, { h: cur.L.h * blink * cur.es }), Rr = Object.assign({}, cur.R, { h: cur.R.h * blink * cur.es });
    setA($('eyeL'), 'd', eyeD(170, 152, L)); setA($('eyeR'), 'd', eyeD(230, 152, Rr));
    setA($('eyeLg'), 'transform', `translate(${cur.gx.toFixed(1)},${cur.gy.toFixed(1)}) rotate(${cur.L.r.toFixed(1)} 170 152)`);
    setA($('eyeRg'), 'transform', `translate(${cur.gx.toFixed(1)},${cur.gy.toFixed(1)}) rotate(${cur.R.r.toFixed(1)} 230 152)`);
    const ss = (Math.max(.01, cur.es) * 1.45).toFixed(2);
    setA($('symL'), 'transform', `translate(${(170 + cur.gx).toFixed(1)},${(152 + cur.gy).toFixed(1)}) scale(${ss})`);
    setA($('symR'), 'transform', `translate(${(230 + cur.gx).toFixed(1)},${(152 + cur.gy).toFixed(1)}) scale(${ss})`);
    const c = cur.col.map((v) => Math.round(v)), c2 = c.map((v) => Math.round(v * .55));
    const cs = `rgb(${c})`; if (svgEl.__eye !== cs) { svgEl.__eye = cs; svgEl.style.setProperty('--eye', cs); svgEl.style.setProperty('--eye2', `rgb(${c2})`); }
    // speaking equaliser
    const eqOn = speaking || tgt.eq;
    setA($('eq'), 'opacity', eqOn ? '1' : '0');
    if (eqOn) $('eq').querySelectorAll('rect').forEach((r, i) => { eqH[i] = still ? 6 : lerp(eqH[i], 3 + Math.random() * (speaking ? 14 : 6), .35); setA(r, 'height', eqH[i].toFixed(1)); setA(r, 'y', (190 - eqH[i] / 2).toFixed(1)); });
    // body
    cur.tilt = lerp(cur.tilt, tgt.tilt, k); cur.hy = lerp(cur.hy, tgt.hy, k); cur.rigY = lerp(cur.rigY, tgt.rigY, still ? 1 : k * .6); cur.dim = lerp(cur.dim, tgt.dim, k);
    cur.bobAmp = lerp(cur.bobAmp, tgt.bob[0], k); cur.bobSp = lerp(cur.bobSp, tgt.bob[1], k); cur.shake = lerp(cur.shake, tgt.shake, k);
    const bob = still ? 0 : -Math.sin(T * cur.bobSp) * 6 * cur.bobAmp, sx = still ? 0 : Math.sin(T * 30) * 2 * cur.shake;
    const sw = (!still && sway) ? Math.sin(T * 2.5) * sway : 0;
    setA($('rig'), 'transform', `translate(${(sx + sw).toFixed(1)},${(bob + cur.rigY).toFixed(1)})`);
    setA($('rig'), 'opacity', (1 - cur.dim * .35).toFixed(2));
    setA($('shadow'), 'rx', (70 * (1 + (bob + cur.rigY) / 120)).toFixed(1));
    const idleTilt = still ? 0 : Math.sin(T * .7) * 1.5;
    setA($('head'), 'transform', `translate(${(cur.gx * .5).toFixed(1)},${(cur.gy * .3 + cur.hy).toFixed(1)}) rotate(${(cur.tilt + idleTilt).toFixed(1)} 200 240)`);
    // arms
    const ps = still ? 0 : 1, sp = pose.sp || 1, s1 = Math.sin(T * sp);
    const aL = pose.L + (pose.oL || 0) * s1 * ps, aR = pose.R + (pose.oR || 0) * (pose.alt ? s1 : -s1) * ps;
    cur.arms.L = lerp(cur.arms.L, aL, Math.min(1, k * 1.4)); cur.arms.R = lerp(cur.arms.R, aR, Math.min(1, k * 1.4));
    setA($('armL'), 'transform', `translate(146,268) rotate(${cur.arms.L.toFixed(1)})`);
    setA($('armR'), 'transform', `translate(254,268) rotate(${cur.arms.R.toFixed(1)})`);
    setA($('handLup'), 'transform', `rotate(${(-cur.arms.L).toFixed(1)})`);
    setA($('handRup'), 'transform', `rotate(${(-cur.arms.R).toFixed(1)})`);
    if (still && now > activeUntil && !swapping) return; // settled: stop until the next change
    raf = requestAnimationFrame(frame);
  }

  // =====================================================================================
  // 10. Speech (browser speechSynthesis, voices installed on this device only)
  // =====================================================================================
  let voices = [];
  function loadVoices() { try { voices = (root.speechSynthesis && root.speechSynthesis.getVoices()) || []; } catch (e) { voices = []; } }
  function pickVoice() {
    // Online voices (Edge "Natural", Google network voices) send the text to a cloud service. The app
    // has no opt-in for that, so only voices that run on this device are used.
    const local = voices.filter((v) => v.localService && /^en/i.test(v.lang));
    const fem = /neerja|heera|pallavi|swara|kalpana|zira|aria|jenny|sonia|libby|natasha|hazel|susan|catherine|samantha|female|woman/i;
    return local.find((v) => /en[-_]IN/i.test(v.lang) && fem.test(v.name)) || local.find((v) => /en[-_]IN/i.test(v.lang))
      || local.find((v) => fem.test(v.name)) || local[0] || null;
  }
  function speak(text, mood) {
    try {
      if (!text || !has(opts.voice, false) || !root.speechSynthesis || !root.SpeechSynthesisUtterance) return;
      const line = String(text).replace(/[^\p{L}\p{N}\s.,!?'’:%-]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (!line) return;
      const key = line.toLowerCase(), lastAt = spoken.get(key);
      if (lastAt && Date.now() - lastAt < 10 * 60 * 1000) return; // never repeat the same line
      if (!voices.length) loadVoices();
      const v = pickVoice(); if (!v) return; // no on-device English voice: stay silent rather than use an online one
      spoken.set(key, Date.now());
      if (spoken.size > 60) spoken.delete(spoken.keys().next().value);
      root.speechSynthesis.cancel();
      const u = new root.SpeechSynthesisUtterance(line);
      u.voice = v; u.lang = v.lang;
      u.pitch = mood === 'celebrate' || mood === 'happy' ? 1.15 : mood === 'warn' || mood === 'alert' ? .98 : 1.08;
      u.rate = mood === 'warn' || mood === 'alert' ? .95 : 1.02; u.volume = .9;
      u.onstart = () => { speaking = true; kick(); };
      u.onend = u.onerror = () => { speaking = false; kick(); };
      root.speechSynthesis.speak(u);
    } catch (e) { /* speech not available */ }
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function say(msg, detail, action, ms, mood) {
    if (!bubble) return;
    clearTimeout(hideBubbleTimer);
    bubble.innerHTML = `<div class="mb-msg">${esc(msg)}</div>${detail ? `<div class="mb-detail">${esc(detail)}</div>` : ''}${action ? `<button type="button" class="mb-action">${esc(action.label)}</button>` : ''}<button type="button" class="mb-close" aria-label="Close">×</button>`;
    bubble.classList.add('show');
    if (action) bubble.querySelector('.mb-action').onclick = () => { if (opts.onAction) opts.onAction(action); bubble.classList.remove('show'); };
    bubble.querySelector('.mb-close').onclick = () => bubble.classList.remove('show');
    hideBubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms || 9000);
    if (opts.onSay) opts.onSay(msg, detail);
    speak(msg, mood);
  }

  // =====================================================================================
  // 11. Priority runner
  // =====================================================================================
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  function setMood(m) { if (el) el.setAttribute('data-mood', m || 'calm'); }
  function interrupt() { runToken++; running = null; clearTimeout(holdTimer); sway = 0; }

  async function play(item) {
    const my = ++runToken; running = item;
    sway = isReduced() ? 0 : (item.sway || 0);
    setScene(item.props || []); setMood(item.mood || 'calm');
    if (item.onStart) item.onStart();
    for (const s of item.steps) {
      if (my !== runToken) return;
      setExprInternal(s.e); if (s.pose) pose = POSE[s.pose] || pose;
      if (s.gaze) gazeOverride = s.gaze;
      if (s.cd) { const y = svgEl.querySelector('.mh-yeartext'); if (y) y.textContent = s.cd === 'year' ? `Happy New Year ${upcomingYear()}!` : s.cd; }
      await wait(s.d);
    }
    if (my !== runToken) return;
    running = null; sway = 0;
    if (item.level >= 8) { lastIdleEnd = Date.now(); }
    setBadge('');
    proceed();
  }
  function proceed() { if (queue.length) next(); else restPose(); }

  function restPose() {
    if (!svgEl) return;
    sway = 0; setBadge('');
    if (sleeping) { setScene([]); setExprInternal('Sleeping'); setMood('sleep'); return; }
    if (focusMode) { setScene(['laptop']); setExprInternal('Working'); setMood('calm'); return; }
    setScene([]); setExprInternal('Neutral'); setMood('calm');
  }

  function levelOf(r, def) {
    let lv = def.level;
    if (r.immediate) lv = Math.min(lv, 3); // a reply the user asked for
    return lv;
  }
  function defFor(r) {
    let kind = r.kind;
    if (kind === 'celebrating' && !r.quiet && (r.confetti || r.force)) kind = 'savedBig'; // the app's verified save of 5+ items
    else if (kind === 'celebrating' && r.quiet) return Object.assign({}, EMOTIONS.celebrating, { e: 'Proud', confetti: 0, steps: null }); // chat reply, no save behind it
    if (kind === 'clipboard' && r.immediate) kind = 'confirm';
    return REACTIONS[kind] || REACTIONS.task;
  }

  function react(list) {
    if (!svgEl) return;
    const now = Date.now();
    let interruptNow = false;
    (Array.isArray(list) ? list : [list]).forEach((r) => {
      if (!r || typeof r !== 'object') return;
      const key = (r.kind || '') + '|' + (r.msg || '');
      if (!r.force && r.msg && now - (recentMsgs.get(key) || 0) < 120000) return; // no nagging
      if (r.msg) recentMsgs.set(key, now);
      if (recentMsgs.size > 200) recentMsgs.delete(recentMsgs.keys().next().value);
      const def = defFor(r), level = levelOf(r, def);
      if (focusMode && level > 6 && r.kind !== 'focusEnd') { if (r.msg && !r.quiet) say(r.msg, r.detail, r.action, 8000); return; }
      const item = { r, def, level, seq: now + Math.random() };
      queue.push(item);
      const curLv = running ? running.level : 99;
      if (r.immediate || curLv >= 8 || (level < curLv && level <= 4) || (running && running.kind === 'hold' && level <= 4)) interruptNow = true;
    });
    queue.sort((a, b) => a.level - b.level || ((b.r.priority || 0) - (a.r.priority || 0)) || a.seq - b.seq);
    if (queue.length > 6) queue.length = 6;
    if (interruptNow && queue.length) {
      // an interrupted reaction is not lost: it resumes (without repeating its message) after the more important one
      if (running && running.kind === 'reaction' && running.src && !running.src.resumed) { queue.push(Object.assign({}, running.src, { resumed: true })); queue.sort((x, y) => x.level - y.level || x.seq - y.seq); if (queue.length > 6) queue.length = 6; }
      interrupt(); next(); return;
    }
    if (!running && queue.length) next();
  }

  function next() {
    const item = queue.shift();
    if (!item) { running = null; restPose(); return; }
    if (sleeping) { sleeping = false; }
    const { r, def, level, resumed } = item;
    const total = r.duration || def.duration || 4200;
    let steps = def.steps ? def.steps.map(([e, d]) => st(e, d)) : [st(def.e, total)];
    if (def.steps && r.duration) { const sum = steps.reduce((s, x) => s + x.d, 0); if (sum < r.duration) steps[steps.length - 1].d += r.duration - sum; }
    if (def.pose) steps = steps.map((s) => Object.assign({ pose: def.pose }, s));
    const reduced = isReduced();
    play({
      kind: 'reaction', level, mood: def.mood, props: def.props, steps, src: item,
      onStart: () => {
        if (r.badge) setBadge(r.badge);
        if (resumed) return;
        if (r.msg && !r.quiet) say(r.msg, r.detail, r.action, steps.reduce((s, x) => s + x.d, 0) + 3000, def.mood);
        if (opts.fx && !reduced) {
          const n = r.confetti || def.confetti;
          if (n && opts.fx.confetti) opts.fx.confetti(n);
          if (def.fireworks && opts.fx.fireworks) opts.fx.fireworks();
        }
        if (def.banner && opts.onBanner) opts.onBanner(r);
        if (def.certificate && opts.onCertificate) opts.onCertificate(r);
        if (opts.sound) opts.sound(def.sound || 'chime');
      },
    });
  }

  function emote(name, msg, detail, extra) { react(Object.assign({ kind: EMOTIONS[name] ? name : 'happy', priority: 5, msg, detail }, extra || {})); }

  // Hold an emotion until the next reaction (used while the chat is thinking or saving).
  function hold(name) {
    if (!svgEl) return;
    const d = EMOTIONS[name] || EMOTIONS.thinking;
    interrupt(); sleeping = false;
    running = { kind: 'hold', level: 3 };
    setScene(d.props); setExprInternal(d.e); if (d.pose) pose = POSE[d.pose]; setMood(d.mood);
    holdTimer = setTimeout(() => { if (running && running.kind === 'hold') { running = null; proceed(); } }, 20000);
  }

  function rest() { interrupt(); proceed(); }

  function setExpr(name) { setExprInternal(name); }

  // Idle activities
  function canIdle() {
    return !!svgEl && !isPaused() && decorOn() && !isReduced() && !doc.hidden && !typing() && !drawerOpen() && !dockAway()
      && !focusMode && !sleeping && !running && !(dock && dock.classList.contains('chat-open'));
  }
  function activity(name) {
    const a = ACTIVITIES[name] || actById[ACT_ALIAS[name]];
    if (!a || running || sleeping || focusMode || !svgEl) return;
    cooldown.set(a.id, Date.now());
    play(Object.assign({ kind: 'activity', level: SEASONS.includes(a.cat) ? 8 : 9 }, a));
  }
  function pickIdle() {
    const t = istNow(), s = season(), cool = 10 * 60 * 1000;
    const block = t.h < 11 ? 'Morning' : t.h < 17 ? (Math.random() < .5 ? 'Working' : 'Playful') : t.h < 21 ? (Math.random() < .5 ? 'Evening' : 'Relaxation') : 'Relaxation';
    let pool = ACTS.filter((a) => a.cat === block && !['sleep', 'gotosleep', 'bye', 'wake'].includes(a.id));
    if (s && Math.random() < .4) { const sp = ACTS.filter((a) => a.cat === s); if (sp.length) pool = sp; }
    pool = pool.filter((a) => !cooldown.has(a.id) || Date.now() - cooldown.get(a.id) > cool);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  function tick() {
    if (!svgEl || doc.hidden) return;
    const now = Date.now();
    // something decorative is running but the user is now busy: stop it
    if (running && running.level >= 8 && (typing() || drawerOpen() || isPaused() || isReduced() || !decorOn())) { interrupt(); restPose(); lastIdleEnd = now; return; }
    if (!sleeping && !running && !focusMode && decorOn() && now - lastInput > 3 * 60 * 1000) { sleep(); return; }
    if (!canIdle()) return;
    if (now - lastIdleEnd > 30000 + Math.random() * 30000) { const a = pickIdle(); if (a) activity(a.id); else lastIdleEnd = now; }
  }

  function sleep() {
    if (sleeping || running || focusMode || !decorOn() || !svgEl) return;
    sleeping = true; sleptAt = Date.now(); restPose();
  }
  function wake(silent) {
    if (!sleeping) return false;
    sleeping = false;
    const long = Date.now() - sleptAt > 10 * 60 * 1000;
    if (!silent && long) react({ kind: 'wake', priority: 0, msg: `Oh! Welcome back, ${has(opts.name, false) ? opts.name() : ''}! Shall we continue where we left off?`.replace(', !', '!'), detail: opts.summary ? opts.summary() : '' });
    else if (!silent && !running && canIdle()) play(Object.assign({ kind: 'activity', level: 9 }, actById.wake, { steps: actById.wake.steps.slice(1) }));
    else if (!running) restPose();
    return true;
  }
  function activityPing() {
    const now = Date.now(), idleFor = now - lastInput; lastInput = now;
    if (sleeping) wake(false);
    return idleFor;
  }

  function setFestival(mode) {
    festival = mode || 'default';
    if (el) el.setAttribute('data-festival', festival);
    setScene(running && running.props ? running.props : (focusMode ? ['laptop'] : []), true);
  }
  function setFocus(on) { focusMode = !!on; if (focusMode && running && running.level >= 7) interrupt(); if (!running) restPose(); }

  // Cloud sync watcher: security / conflict / offline states (read-only, no network calls).
  let lastSync = '';
  function watchSync() {
    const s = root.MAHI_SYNC && root.MAHI_SYNC.status; if (!s || s === lastSync) return;
    const prev = lastSync; lastSync = s;
    const cool = (k, ms) => { const t = syncCool.get(k) || 0; if (Date.now() - t < ms) return false; syncCool.set(k, Date.now()); return true; };
    if (s === 'auth' && cool('auth', 10 * 60000)) react({ kind: 'security', msg: 'Please sign in again so your work keeps syncing.', detail: 'Your changes are kept on this device until then.' });
    else if (s === 'conflict' && cool('conflict', 10 * 60000)) react({ kind: 'conflict', msg: 'A record changed on another device.', detail: 'Please choose which version to keep.' });
    else if (s === 'offline' && cool('offline', 10 * 60000)) react({ kind: 'offline', quiet: true });
    else if (s === 'synced' && ['offline', 'error', 'auth', 'conflict'].includes(prev) && cool('reconnected', 5 * 60000)) react({ kind: 'reconnected', quiet: true });
  }

  // =====================================================================================
  // 12. Mount
  // =====================================================================================
  function mount(container, options) {
    timers.forEach((t) => clearInterval(t)); observers.forEach((o) => o.disconnect()); timers = []; observers = []; stopLoop();
    opts = Object.assign({ reduced: () => false, paused: () => false, decor: () => true, name: () => '', voice: () => false }, options || {});
    el = container; N = {};
    el.innerHTML = `<div class="mahi-stage">${svgMarkup()}</div><div class="mahi-bubble" role="status" aria-live="polite"></div>`;
    svgEl = el.querySelector('.mahi-svg'); bubble = el.querySelector('.mahi-bubble');
    dock = el.closest('.mahi-dock');
    activeProps = ''; shownSym = [null, null]; nextBlink = performance.now() + 2500;
    el.setAttribute('data-festival', festival);
    restPose();
    startLoop();

    svgEl.setAttribute('tabindex', '0');
    const open = () => { if (opts.onClick) opts.onClick(); else if (!running) activity(['wave', 'coffee', 'type', 'clip', 'dance'][Math.floor(Math.random() * 5)]); };
    svgEl.addEventListener('click', open);
    svgEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });

    // Eyes follow the pointer (no layout work per event; the rect is refreshed at most once a second).
    let rect = null, rectAt = 0;
    doc.addEventListener('pointermove', (e) => {
      if (doc.hidden || isReduced() || isPaused() || dockAway() || drawerOpen()) return;
      const now = performance.now();
      if (!rect || now - rectAt > 1000) { rect = svgEl.getBoundingClientRect(); rectAt = now; }
      if (!rect.width) { mouse.has = false; return; }
      mouse = { x: ((e.clientX - rect.left) / rect.width - .5) * 2.4 / 6, y: ((e.clientY - rect.top) / rect.height - .35) * 2.4 / 6, has: true };
      if (!raf) kick(400);
    }, { passive: true });
    doc.addEventListener('keydown', (e) => { const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) lastKey = Date.now(); }, { passive: true, capture: true });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) { stopLoop(); if (root.speechSynthesis && speaking) root.speechSynthesis.cancel(); } else { lastDraw = 0; kick(); } });

    // React to the app's theme/season, drawer, pause and dock state.
    if (root.MutationObserver) {
      const mo1 = new MutationObserver(() => setScene(running && running.props ? running.props : (focusMode && !running ? ['laptop'] : []), true));
      mo1.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-season', 'data-theme'] });
      const mo2 = new MutationObserver(() => { if (running && running.level >= 8 && (drawerOpen() || isPaused() || isReduced())) { interrupt(); restPose(); } kick(); });
      mo2.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
      observers.push(mo1, mo2);
      if (dock) { const mo3 = new MutationObserver(() => kick()); mo3.observe(dock, { attributes: true, attributeFilter: ['class'] }); observers.push(mo3); }
    }
    if (root.speechSynthesis) { loadVoices(); try { root.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { /* old browsers */ } }
    timers.push(setInterval(tick, 3000), setInterval(watchSync, 4000));
    lastIdleEnd = Date.now() - 15000;
  }

  root.MAHI_CHAR = {
    svgMarkup, EYES, EXPR, MOUTH, PROPS, FESTIVE, mount, react, emote, hold, say, speak, activity, setFestival, setFocus, activityPing, wake, sleep,
    isSleeping: () => sleeping, isBusy: () => !!running, rest, setExpr,
    ACTIVITIES: Object.keys(ACTIVITIES), REACTIONS: Object.keys(REACTIONS), EMOTIONS: Object.keys(EMOTIONS),
    state: () => ({ expr: tgtName, running: running && (running.name || running.kind), level: running && running.level, queue: queue.length, sleeping, season: season(), props: activeProps }),
  };
})(window);
