// @ts-nocheck
/* ═══════════════════════════════════════════════════════════════
   THE MAGAZINE ENGINE — turns the homepage into a 3D issue you read
   by scrolling. Ported 1:1 from the approved artifact (v8.3).

   mount(root) builds everything inside `root` (the .mag element) and
   returns a teardown. The site uses Astro's ClientRouter, so leaving
   the homepage doesn't reload the document: teardown removes every
   listener, stops the loops and the song, and resets scroll-snap.

   The parts, in the order they run:
   • build()   clones the ten pages onto leaves (spreads on desktop,
               single pages under 760px) and adds the paper block,
               spine and desk shadow.
   • tick()    eases toward the scroll position so wheel notches
               don't step the turn, then calls render().
   • render()  places each leaf (height in the stack + rotation),
               swaps a turning leaf for its bending strips, casts
               its shadow, and updates labels only when they change.
   • curl      pre-built hinged strips with edge-blended lighting;
               switched fully off at rest (on a real GPU a parked copy
               bled through as lines).
   • freeze    while any page moves, videos become canvases of their
               current frame: playing video is a GPU overlay that
               ignores 3D stacking and punched through turning pages.
   • sound     optional page-flip noise, and the song on the Music
               page with a spectrum that reacts to it.
   ═══════════════════════════════════════════════════════════════ */
export function mount(root) {
  let alive = true;
  const offs = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  const html = document.documentElement, prevSnap = html.style.scrollSnapType;
  // No CSS scroll-snap: browsers disagree on what a wheel notch or a trackpad flick should do with it
  // (spring back, or fly through two pages). The magazine handles input itself — see "input" below.
  html.style.scrollSnapType = 'none';
  root.classList.add('is-live');

  // the ten printed pages, rendered by MagPages.astro; lifted out of the document and used as the originals to clone
  const src = root.querySelector('.mag__src');
  const pages = [...src.querySelectorAll(':scope > .pg')];
  src.querySelectorAll('video').forEach(v => v.pause());
  src.remove();
  const book = root.querySelector('#mag-book'), track = root.querySelector('#mag-track');
  const where = root.querySelector('#mag-where'), hint = root.querySelector('#mag-hint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = null, leaves = [], faces = [], pw = 0, ph = 0, turns = 0, firstBuild = true, turnedOnce = false;
  let feL, feR, btL, btR, spL, spR, shL, shR, TH = 20, dz = 4;

  /* things that animate in when their page comes into view */
  const ANIM = '.player,.arm,.kicker,.hd,.snap,.ransom i,.toc li,.exp li,.rates > div,.tools,.badge,.audio__frame,.about__body,.vinyl,.music__dek,.dj__dek,.checks li,.checks .box,.fine,.card,.contact li,.hand,.more,.cta,.sticker,.cover__lines li,.cover__roles,.barcode,.back__foot';
  function prep(pg) {
    pg.querySelectorAll('.mast').forEach(m => { m.innerHTML = [...m.textContent].map((c, i) => `<span class="ml" style="--d:${i}">${c}</span>`).join(''); });
    pg.querySelectorAll(ANIM).forEach((el, i) => { el.classList.add('anim'); el.style.setProperty('--d', Math.min(i, 14)); });
    return pg;
  }

  const list = root.querySelector('#mag-menu'), dots = root.querySelector('#mag-dots');
  pages.forEach((p, i) => {
    const li = document.createElement('li'); li.style.setProperty('--i', i);
    li.innerHTML = `<a href="#p${i}" data-go="${i}"><b>${p.dataset.num || '—'}</b>${p.dataset.title}</a>`;
    list.appendChild(li);
  });

  // A phone's address bar slides in and out while you scroll, which changes innerHeight but
  // not the small-viewport unit (svh). Everything — page size, scroll distance per turn and the
  // snap points — is measured in that one stable unit, so the book never rests half-turned and
  // never rebuilds mid-scroll just because the bar moved.
  const probe = el('div'); probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
  root.appendChild(probe);
  let unit = innerHeight, builtW = 0, builtU = 0;
  function build() {
    const m = innerWidth > 760 ? 'spread' : 'single';
    unit = probe.offsetHeight || innerHeight; builtW = innerWidth; builtU = unit;
    const vh = unit;
    if (m === 'spread') { ph = Math.min(vh * 0.8, (innerWidth - 140) / 2 * 1.3); pw = ph / 1.3; }
    else { pw = Math.min(innerWidth - 32, (vh - 170) / 1.3); ph = pw * 1.3; }
    book.style.width = (m === 'spread' ? pw * 2 : pw) + 'px';
    book.style.height = ph + 'px';
    if (m === mode) { track.style.height = (turns + 1) * unit + 'px'; track.querySelectorAll('.snappt').forEach((n, s) => n.style.top = s * unit + 'px'); layout(); return; }
    mode = m; book.innerHTML = ''; leaves = []; faces = []; moving = false;
    const clone = i => pages[i] ? prep(pages[i].cloneNode(true)) : null;
    pairs = []; dropCurls();
    if (m === 'spread') for (let i = 0; i < pages.length; i += 2) pairs.push([i, i + 1]);
    else pages.forEach((_, i) => pairs.push([i, null]));
    pairs.forEach(([f, b]) => {
      const leaf = document.createElement('div'); leaf.className = 'leaf';
      const mk = (cls, idx) => {
        const face = document.createElement('div'); face.className = 'face ' + cls + (idx === null ? ' face--blank' : '');
        if (idx !== null && pages[idx]) face.appendChild(clone(idx));
        face.insertAdjacentHTML('beforeend', '<i class="shade"></i><i class="cast"></i>');
        face._shade = face.querySelector('.shade'); face._cast = face.querySelector('.cast');
        face._videos = [...face.querySelectorAll('video')];
        return face;
      };
      const front = mk('face--front', f), back = mk('face--back', b);
      leaf.append(front, back); leaf._f = front; leaf._b = back; leaf._side = 0;
      front._leaf = back._leaf = leaves.length; front._sd = 'f'; back._sd = 'b';
      book.appendChild(leaf); leaves.push(leaf); faces.push(front, back);
    });
    const spineText = '<i><b>LOYA</b>Issue 01 <em>●</em> Fall 2026 <em>●</em> Audio Engineer · DJ · Creative · Artist</i>';
    feL = el('div', 'blk fe'); feR = el('div', 'blk fe'); btL = el('div', 'blk bt'); btR = el('div', 'blk bt');
    spL = el('div', 'blk spine spine--l', spineText); spR = el('div', 'blk spine spine--r', spineText);
    shL = el('div', 'bshadow'); shR = el('div', 'bshadow');
    book.append(shL, shR, feL, feR, btL, btR, spL, spR);

    turns = m === 'spread' ? leaves.length : leaves.length - 1;
    { const p0 = progress(); leaves.forEach((l, i) => l._side = p0 - i >= .5 ? 1 : 0); }
    track.style.height = (turns + 1) * unit + 'px';
    track.querySelectorAll('.snappt').forEach(n => n.remove());
    for (let s = 0; s <= turns; s++) { const n = el('i', 'snappt'); n.style.top = s * unit + 'px'; track.appendChild(n); }
    dots.innerHTML = '';
    for (let s = 0; s <= turns; s++) { const d = el('button'); d.setAttribute('aria-label', 'Go to ' + label(s).replace(/<[^>]+>/g, '')); d.onclick = () => goSpread(s); dots.appendChild(d); }
    faces.forEach(f => f._videos.forEach(v => { v.muted = true; }));
    // hold the cover's entrance until the magazine has landed on the desk
    const delay = firstBuild && !reduce ? 750 : 0; firstBuild = false;
    faces.forEach(f => { f._open = false; f._shown = false; });
    setTimeout(() => { if (!alive) return; ready = true; shown = progress(); leaves.forEach(l => l._t = undefined); render(); warmSoon(); }, delay);
    layout();
  }
  let ready = false;

  /* ── curl: a turning leaf is re-drawn as N hinged strips so the paper bends ── */
  const CURL = !reduce;
  /* Where idle bending copies (and a flat leaf that's mid-turn) wait: far off-screen. Moving them is
     a transform, which nothing inherits, so switching a copy in or out costs nothing. Hiding them with
     visibility did the same job but made the browser restyle every element of every page clone in the
     copy — the stall at the start of each turn. Off-screen they also can't bleed through the page. */
  const PARK = 'translate3d(-12000px,0,0)';
  // A parked copy is flattened to a single plain layer: strips unrotated, light layers merged. Only the
  // copy that's actually bending gets its strips as 3D layers and its light on layers of its own (so the
  // light can change every frame without repainting the photo and type under it).
  // content-visibility: hidden makes the browser skip a parked copy entirely (no layers, no paint)
  // while keeping its finished layout, so waking it is cheap. Browsers without it still get the
  // off-screen park.
  function park(c) { c.style.transform = PARK; c.style.contentVisibility = 'hidden'; c._s.forEach(o => { o.s.style.transform = ''; o.sh[0].style.willChange = o.sh[1].style.willChange = ''; o._fb = o._bb = null; }); }
  function wake(c) { c.style.contentVisibility = 'visible'; c._s.forEach(o => { o.sh[0].style.willChange = o.sh[1].style.willChange = 'transform'; }); }
  let curls = {}, pairs = [];
  function stillClone(idx) {
    // a frozen copy of a page for the bending strips: videos become their poster stills
    const c = pages[idx].cloneNode(true);
    c.querySelectorAll('video').forEach((v, k) => { const cv = document.createElement('canvas'); cv.className = 'vpost'; cv.dataset.v = k; cv.dataset.poster = v.getAttribute('poster') || ''; v.replaceWith(cv); });
    // the bending copies are decoration: keep the page's one real <h1> (the cover masthead) out of them
    c.querySelectorAll('h1').forEach(h => { const d = document.createElement('div'); d.className = h.className; d.innerHTML = h.innerHTML; h.replaceWith(d); });
    c.querySelectorAll('.mast').forEach(m => { m.innerHTML = [...m.textContent].map(ch => `<span class="ml">${ch}</span>`).join(''); });
    if (c.classList.contains('pg--music') && musicOn) c.classList.add('playing');
    c.style.width = pw + 'px'; c.style.height = ph + 'px';
    return c;
  }
  function buildCurl(i) {
    const N = mode === 'spread' ? 12 : 7, sw = pw / N, OV = 2, [fi, bi] = pairs[i];
    const root = el('div', 'curl'); root.style.left = (mode === 'spread' ? pw : 0) + 'px'; root.style.width = pw + 'px'; root.style.height = ph + 'px';
    const F = stillClone(fi), B = bi !== null && pages[bi] ? stillClone(bi) : null;
    let parent = root; root._s = [];
    for (let k = 0; k < N; k++) {
      const s = el('div', 'strip'); s.style.left = (k ? sw : 0) + 'px'; s.style.width = (sw + OV) + 'px'; s.style.height = ph + 'px';
      const f = el('div', 'sl sl--f' + (k ? '' : ' sl--spine')), b = el('div', 'sl sl--b' + (B ? '' : ' sl--blank') + (k ? '' : ' sl--spine'));
      const fc = F.cloneNode(true); fc.style.left = -k * sw + 'px'; f.appendChild(fc);
      if (B) { const bc = B.cloneNode(true); bc.style.left = (-(N - 1 - k) * sw + OV) + 'px'; /* the back is mirrored about the strip's centre, overlap included */ b.appendChild(bc); }
      f.insertAdjacentHTML('beforeend', '<i class="sshade" style="left:0;right:0"></i>');
      b.insertAdjacentHTML('beforeend', '<i class="sshade" style="left:0;right:0"></i>');
      s.append(f, b); parent.appendChild(s); parent = s;
      root._s.push({ s, sh: [f.lastElementChild, b.lastElementChild], sw });
    }
    // built ahead of time but switched fully off until its leaf starts to turn. (Parking it a pixel behind
    // the flat page looked fine in software, but on a real GPU its strip edges bled through as lines.)
    root._N = N; root._on = false; root.style.transform = PARK;
    // a hidden copy for decoration only: keep it out of the accessibility tree and the tab order
    root.setAttribute('aria-hidden', 'true'); root.inert = true;
    book.appendChild(root);
    // size its video canvases once (every strip's copy is the same size) and start them on the poster still
    const vps = [...root.querySelectorAll('canvas.vpost')];
    if (vps.length) {
      const bySrc = {};
      vps.forEach(cv => (bySrc[cv.dataset.v + '|' + cv.closest('.sl').className.includes('sl--b')] ||= []).push(cv));
      Object.values(bySrc).forEach(group => {
        const w = group[0].offsetWidth, h = group[0].offsetHeight;
        group.forEach(cv => { cv.width = Math.max(1, Math.round(w * FREEZE_DPR)); cv.height = Math.max(1, Math.round(h * FREEZE_DPR)); });
        const poster = group[0].dataset.poster;
        if (poster) { const im = posterImg(poster); const paint = () => group.forEach(cv => drawCover(cv, im, im.naturalWidth, im.naturalHeight)); im.complete ? paint() : im.addEventListener('load', paint, { once: true }); }
      });
    }
    // laid out once (above), now skipped until its leaf turns
    root.style.contentVisibility = 'hidden';
    return root;
  }
  const posters = {};
  function posterImg(src) { if (!posters[src]) { const im = new Image(); im.decoding = 'async'; im.src = src; posters[src] = im; } return posters[src]; }
  function dropCurls() { Object.values(curls).forEach(c => c.remove()); curls = {}; }
  function bend(c, e) {
    // cumulative angle per strip: the free edge leads, the spine lags, and it all flattens out at either end
    const N = c._N, th = 180 * e, flex = Math.sin(Math.PI * e), b = flex * 96;
    const A = []; for (let k = 0; k < N; k++) A.push(clamp(th + b * (Math.pow((k + 1) / N, 1.5) - .42), 0, 180));
    // light is judged at each strip's edges (the average of the two strips meeting there), so it's continuous across the page
    const edge = k => k <= 0 ? A[0] * .5 : k >= N ? A[N - 1] : (A[k - 1] + A[k]) / 2;
    const rad = Math.PI / 180;
    // front: darkens as it tips away from you, with a soft sheen where the curve faces the light
    const fd = a => (1 - Math.cos(a * rad)) * .4, fg = a => .3 * flex * Math.exp(-Math.pow((a - 38) / 22, 2));
    // back: brightest once it's lying flat again, sheen on its side of the curve
    const bd = a => (1 + Math.cos(a * rad)) * .4, bg = a => .24 * flex * Math.exp(-Math.pow((a - 142) / 22, 2));
    let prev = 0;
    for (let k = 0; k < N; k++) {
      const o = c._s[k];
      o.s.style.transform = `rotateY(${(-(A[k] - prev)).toFixed(3)}deg)`; prev = A[k];
      // blend across the strip's own width, then hold that value over the sliver it shares with the next strip
      const l = edge(k), r = edge(k + 1), f = (v) => v.toFixed(3), w = o.sw.toFixed(1) + 'px';
      const g2 = (dir, rgb, a0, a1) => `linear-gradient(${dir},rgba(${rgb},${f(a0)}) 0,rgba(${rgb},${f(a1)}) ${w},rgba(${rgb},${f(a1)}) 100%)`;
      const front = g2('90deg', '255,248,251', fg(l), fg(r)) + ',' + g2('90deg', '24,8,18', fd(l), fd(r));
      const back = g2('270deg', '255,248,251', bg(l), bg(r)) + ',' + g2('270deg', '24,8,18', bd(l), bd(r));
      if (o._fb !== front) { o.sh[0].style.background = front; o._fb = front; }
      if (o._bb !== back) { o.sh[1].style.background = back; o._bb = back; }
    }
  }
  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

  function layout() {
    const off = mode === 'spread' ? pw : 0;
    leaves.forEach(l => { l.style.width = pw + 'px'; l.style.height = ph + 'px'; l.style.left = off + 'px'; });
    faces.forEach(f => f._videos.forEach(v => { v._geo = null; }));
    dropCurls(); trackTop = track.offsetTop; shown = progress(); leaves.forEach(l => l._t = undefined); lastS = lastTurned = lastHint = -1;
    // thickness: about 5% of the page width, shared between the leaves
    TH = Math.max(14, Math.round(pw * .065)); dz = TH / leaves.length;
    const geo = (e, l, tp, w, h) => { e.style.left = l + 'px'; e.style.top = tp + 'px'; e.style.width = w + 'px'; e.style.height = h + 'px'; };
    geo(feR, mode === 'spread' ? pw * 2 : pw, 0, TH, ph); geo(feL, 0, 0, TH, ph);
    geo(btR, off, ph, pw, TH); geo(btL, 0, ph, pw, TH);
    geo(spL, off, 0, TH, ph); geo(spR, off - TH, 0, TH, ph);
    geo(shL, 0, 0, pw, ph); geo(shR, off, 0, pw, ph);
    spL.style.setProperty('--sp-fs', Math.max(7, TH * .4) + 'px'); spR.style.setProperty('--sp-fs', Math.max(7, TH * .4) + 'px');
    feL.hidden = btL.hidden = shL.hidden = spR.hidden = mode === 'single';
    render(); warmSoon();
  }

  const ease = t => (1 - Math.cos(Math.PI * t)) / 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let trackTop = 0;
  const progress = () => clamp((scrollY - trackTop) / unit, 0, turns);
  const cur = () => Math.round(progress());

  /* ── video freeze: swap each video for a still of its current frame while pages move ──
     Playing video is a GPU overlay that ignores 3D stacking, so during a turn every video is hidden
     and the ones on screen are replaced by a canvas holding their current frame. This runs on the
     first frame of every turn, so it has to be cheap: geometry is measured once per layout, canvases
     are drawn at ≤1.25× (it's moving), nothing is encoded, and off-screen videos are just hidden. */
  let moving = false;
  const FREEZE_DPR = Math.min(devicePixelRatio || 1, 1.25);
  // draw a video (or image) into a canvas the way object-fit: cover would
  function drawCover(cv, src, sw, sh) {
    if (!sw || !sh) return false;
    const g = cv.getContext('2d'); const s = Math.max(cv.width / sw, cv.height / sh), dw = sw * s, dh = sh * s;
    try { g.drawImage(src, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh); return true; } catch (e) { return false; }
  }
  function freeze() {
    faces.forEach(f => f._videos.forEach(v => {
      v.pause(); v.style.visibility = 'hidden';
      if (!f._shown || !(v.readyState >= 2 && v.videoWidth)) return;
      let cv = v._cv;
      if (!cv) { cv = v._cv = document.createElement('canvas'); cv.className = 'vfreeze'; v.after(cv); }
      if (!v._geo) {
        const cs = getComputedStyle(v);
        v._geo = { l: v.offsetLeft, t: v.offsetTop, w: v.offsetWidth, h: v.offsetHeight, tf: cs.transform === 'none' ? '' : cs.transform, to: cs.transformOrigin };
        Object.assign(cv.style, { left: v._geo.l + 'px', top: v._geo.t + 'px', width: v._geo.w + 'px', height: v._geo.h + 'px', transform: v._geo.tf, transformOrigin: v._geo.to });
        cv.width = Math.max(1, Math.round(v._geo.w * FREEZE_DPR)); cv.height = Math.max(1, Math.round(v._geo.h * FREEZE_DPR));
      }
      if (drawCover(cv, v, v.videoWidth, v.videoHeight)) cv.style.display = 'block';
    }));
  }
  function thaw() {
    faces.forEach(f => f._videos.forEach(v => { v.style.visibility = ''; if (v._cv) v._cv.style.display = ''; }));
    faces.forEach(f => { if (f._shown) f._videos.forEach(v => v.play().catch(() => {})); });
  }
  // when a leaf starts bending, paint its videos' current frames onto the bending copy's canvases,
  // so grabbing a video page doesn't jump to a different frame
  function syncCurlVideos(c, i) {
    const leaf = leaves[i]; if (!leaf) return;
    [['f', leaf._f], ['b', leaf._b]].forEach(([sd, face]) => face._videos.forEach((v, k) => {
      if (!(v.readyState >= 2 && v.videoWidth)) return;
      c.querySelectorAll(`.sl--${sd} canvas.vpost[data-v="${k}"]`).forEach(cv => drawCover(cv, v, v.videoWidth, v.videoHeight));
    }));
  }

  /* per-frame state, so each frame only touches what actually changed */
  let lastS = -1, lastTurned = -1, lastHint = -1, castOn = null;
  function render(p = shown) {
    const n = leaves.length;
    // the last fraction of a percent at either end counts as flat, so a page can't sit a hair off the stack
    const T = leaves.map((_, i) => { const v = clamp(p - i, 0, 1); return reduce ? Math.round(v) : v < .003 ? 0 : v > .997 ? 1 : v; }), E = T.map(ease);
    leaves.forEach((leaf, i) => {
      // front is visible once the leaf above it starts lifting, until this leaf passes the spine
      leaf._f._vis = E[i] < .5 && (i === 0 || T[i - 1] > 0);
      // back is visible once this leaf passes the spine, until the next leaf lands on top of it
      leaf._b._vis = mode === 'spread' && E[i] >= .5 && (i === n - 1 || T[i + 1] < 1);
    });
    const anyTurning = leaves.some((_, i) => T[i] > 0 && T[i] < 1);
    if (anyTurning !== moving) { moving = anyTurning; moving ? freeze() : thaw(); }
    let castTarget = null;
    leaves.forEach((leaf, i) => {
      const t = T[i], e = E[i];
      if (t === leaf._t) return;            // nothing moved on this leaf
      leaf._t = t;
      const s = Math.sin(Math.PI * e);
      // each leaf sits at its height in the stack: top of the right pile before, top of the left pile after
      const zR = (n - i) * dz, zL = (i + 1) * dz, z = zR + (zL - zR) * e + Math.sin(Math.PI * e) * dz * 1.5;
      leaf._z = z;
      // mid-turn the bending copy takes the leaf's place, and the flat leaf is parked off-screen
      const turning = CURL && t > 0 && t < 1;
      leaf.style.transform = turning ? PARK : `translateZ(${z.toFixed(2)}px) rotateY(${(-180 * e).toFixed(3)}deg)`;
      leaf.style.zIndex = t < .5 ? 100 + (n - i) : i + 1;
      if (turning) { const c = curls[i] || (curls[i] = buildCurl(i)); c.style.transform = `translateZ(${(z + .6).toFixed(2)}px)`; if (!c._on) { wake(c); syncCurlVideos(c, i); c._on = true; } bend(c, e); }
      else if (curls[i] && curls[i]._on) { park(curls[i]); curls[i]._on = false; }
      if (!CURL || !turning) { leaf._f._shade.style.opacity = s * .85; leaf._b._shade.style.opacity = s * .85; }
      // page-flick sound as the leaf crosses the spine
      const side = t >= .5 ? 1 : 0;
      if (side !== leaf._side) { leaf._side = side; fwip(side); if (side) turnedOnce = true; }
    });
    // shadow of the turning leaf on whatever it's lifting off / landing on (a compositor-only scale, no repaint)
    leaves.forEach((leaf, i) => {
      const t = T[i]; if (!(t > 0 && t < 1)) return;
      const e = E[i], s = Math.sin(Math.PI * e), w = Math.min(1, Math.abs(Math.cos(Math.PI * e)) + .12);
      const under = e < .5 ? leaves[i + 1] && leaves[i + 1]._f : (mode === 'spread' && leaves[i - 1] && leaves[i - 1]._b);
      if (under) { castTarget = under; under._cast.style.opacity = s.toFixed(3); under._cast.style.transform = `scaleX(${w.toFixed(4)})`; }
    });
    if (castOn && castOn !== castTarget) castOn._cast.style.opacity = 0;
    castOn = castTarget;
    if (ready) faces.forEach(f => {
      // videos play only while their page can be seen
      if (f._vis !== f._shown) { f._shown = f._vis; if (f._vis) { if (!moving) f._videos.forEach(v => v.play().catch(() => {})); } else f._videos.forEach(v => v.pause()); }
      // Pages are printed: they're already fully drawn when a turn reveals them, like a real magazine.
      // Only the cover builds itself, once, when the magazine first lands on the desk.
      if (f._vis && !f._open) {
        f._open = true;
        const isCover = f._leaf === 0 && f._sd === 'f';
        if (!isCover) { f.classList.add('instant', 'is-open'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('instant'))); }
        else requestAnimationFrame(() => requestAnimationFrame(() => f.classList.add('is-open')));
      }
    });
    if (ready) { const mo = musicFaceOpen(); if (mo && soundOn && !musicOn && !render._mo) startSong(); if (!mo && musicOn) stopSong(false); render._mo = mo; }
    // magazine slides to the spine as the cover opens, back to centre when it closes.
    // Closed, it's turned a little so you see the spine; open, it lies flat, leaning back on the desk.
    const turned = leaves.filter((l, i) => p - i >= .5).length;
    const t0 = ease(clamp(p, 0, 1)), tl = mode === 'spread' ? ease(clamp(p - (n - 1), 0, 1)) : 0;
    const x = mode === 'spread' ? (-pw / 2) * (1 - t0) + (pw / 2) * tl : 0;
    const yaw = 0, tilt = 0;   // level with the screen: no lean, no turn
    book.style.transform = `translate3d(${x.toFixed(2)}px,0,0) rotateX(${tilt.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
    // how tall each pile of paper is right now
    const sumE = E.reduce((a, b) => a + b, 0), R = (n - sumE) * dz, L = sumE * dz;
    const rr = Math.max(.001, R / TH), ll = Math.max(.001, L / TH);
    feR.style.transform = `rotateY(-90deg) scaleX(${rr.toFixed(4)})`; btR.style.transform = `rotateX(90deg) scaleY(${rr.toFixed(4)})`;
    feL.style.transform = `rotateY(-90deg) scaleX(${ll.toFixed(4)})`; btL.style.transform = `rotateX(90deg) scaleY(${ll.toFixed(4)})`;
    spL.style.transform = `rotateY(-90deg) scaleX(${rr.toFixed(4)})`; spR.style.transform = `rotateY(90deg) scaleX(${ll.toFixed(4)})`;
    spL.style.visibility = p < .85 ? 'visible' : 'hidden';
    spR.style.visibility = mode === 'spread' && p > turns - .85 ? 'visible' : 'hidden';
    // the desk shadow follows whichever halves have paper on them
    // (a half only casts a shadow once a page has actually landed there)
    shL.style.opacity = clamp(E[0] * 2 - 1, 0, 1).toFixed(3);
    shR.style.opacity = (mode === 'spread' ? clamp(1 - (E[n - 1] * 2 - 1), 0, 1) : 1).toFixed(3);
    lastTurned = turned;
    const s = Math.round(p);
    if (s !== lastS) {
      lastS = s;
      where.innerHTML = label(s);
      [...dots.children].forEach((d, k) => k === s ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current'));
    }
    const h = p > .15 ? 0 : 1; if (h !== lastHint) { hint.style.opacity = h; lastHint = h; }
  }

  /* smoothing: the magazine chases the scroll position instead of jumping with each wheel notch */
  let shown = 0, loopOn = false, lastTs = 0;
  function tick(ts) {
    if (!alive) return;
    const target = progress(), dt = lastTs ? Math.min(50, ts - lastTs) : 16; lastTs = ts;
    shown += (target - shown) * (reduce ? 1 : 1 - Math.exp(-dt / (drag ? 45 : 80)));
    if (Math.abs(target - shown) < .0006) shown = target;
    render(shown);
    if (shown !== target) requestAnimationFrame(tick);
    else { loopOn = false; lastTs = 0; warmSoon(); }
  }
  function kick() { if (!loopOn) { loopOn = true; requestAnimationFrame(tick); } }
  /* pre-build the bending copy of every leaf while nothing is moving, nearest first, one per idle
     slice, and keep them. Building one mid-turn costs a visible stall, and reading quickly through
     several pages used to hit that on every leaf. */
  let warmT = 0;
  const idle = window.requestIdleCallback ? (fn) => requestIdleCallback(fn, { timeout: 600 }) : (fn) => setTimeout(fn, 60);
  function warmSoon() {
    clearTimeout(warmT);
    warmT = setTimeout(() => idle(() => {
      if (!alive || !CURL || loopOn || !ready) return;
      const s = Math.round(shown), turnable = mode === 'spread' ? leaves.length : turns;
      const order = [...Array(turnable).keys()].sort((a, b) => Math.abs(a - s + .4) - Math.abs(b - s + .4));
      const next = order.find(i => !curls[i]);
      if (next !== undefined) { curls[next] = buildCurl(next); warmSoon(); }
    }), 80);
  }
  function label(s) {
    const idx = mode === 'spread' ? (s === 0 ? [0] : [2 * s - 1, 2 * s].filter(i => i < pages.length)) : [s];
    return idx.map(i => `p. ${pages[i].dataset.num || '—'} <b>${pages[i].dataset.title}</b>`).join(' &nbsp;/&nbsp; ');
  }
  // Every turn the magazine makes is its own tween of the scroll position (never the browser's smooth
  // scroll, whose speed varies): ~0.55s for one page, a little longer for a jump across several.
  let anim = 0, animating = false, lastAimY = 0;
  const easeIO = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  function scrollToY(y, dur) {
    cancelAnimationFrame(anim); animating = false; lastAimY = y;
    if (reduce || !dur) { scrollTo({ top: y, behavior: 'instant' }); return; }
    const y0 = scrollY, d = y - y0, t0 = performance.now(); if (Math.abs(d) < 1) return;
    animating = true;
    const step = now => {
      if (!alive) return;
      const k = Math.min(1, (now - t0) / dur);
      scrollTo({ top: y0 + d * easeIO(k), behavior: 'instant' });
      if (k < 1) anim = requestAnimationFrame(step); else animating = false;
    };
    anim = requestAnimationFrame(step);
  }
  function goSpread(s, instant, dur) {
    s = clamp(Math.round(s), 0, turns);
    const from = progress(), dist = Math.abs(s - from);
    scrollToY(track.offsetTop + s * unit, instant ? 0 : (dur ?? (dist <= 1 ? 340 + 260 * dist : 600 + 160 * Math.min(dist, 5))));
  }
  function goPage(i, instant) { goSpread(mode === 'spread' ? Math.ceil(i / 2) : Math.min(i, turns), instant); }

  /* ── page-flick sound: filtered noise, shaped like paper moving through air ── */
  let ac = null, soundOn = false, lastFwip = 0;
  let musicOn = false, song = null, musicGain = null, analyser = null, fadeT = 0;
  const soundBtn = root.querySelector('#mag-sound');
  soundBtn.onclick = () => {
    soundOn = !soundOn; soundBtn.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) { try { audio(); fwip(1); } catch (e) {} if (musicFaceOpen()) startSong(); }
    else stopSong(true);
  };
  function audio() {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume();
    if (!song) {
      song = new Audio(root.dataset.song); song.preload = 'auto'; song.loop = true;
      const src = ac.createMediaElementSource(song);
      musicGain = ac.createGain(); musicGain.gain.value = 0;
      analyser = ac.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = .78;
      src.connect(musicGain).connect(analyser).connect(ac.destination);
    }
  }
  const musicFace = () => faces.find(f => f.querySelector('.pg--music'));
  const musicFaceOpen = () => { const f = musicFace(); return !!(f && f._vis); };
  function setPlaying(on) { musicOn = on; root.querySelectorAll('.pg--music').forEach(p => p.classList.toggle('playing', on)); root.querySelectorAll('.pg--music .play').forEach(b => b.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + root.dataset.songLabel)); }
  function startSong() {
    audio(); clearTimeout(fadeT);
    song.play().then(() => {
      const now = ac.currentTime; musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(musicGain.gain.value, now); musicGain.gain.linearRampToValueAtTime(.9, now + 1.2);
      setPlaying(true); drawEq();
    }).catch(() => {});
  }
  function stopSong(fast) {
    if (!song || !musicOn) return;
    const now = ac.currentTime, d = fast ? .25 : .9;
    musicGain.gain.cancelScheduledValues(now); musicGain.gain.setValueAtTime(musicGain.gain.value, now); musicGain.gain.linearRampToValueAtTime(0, now + d);
    setPlaying(false); fadeT = setTimeout(() => song.pause(), d * 1000 + 50);
  }
  on(document, 'click', e => { if (e.target.closest('.pg--music .play')) { e.preventDefault(); musicOn ? stopSong(true) : startSong(); } });

  /* the analyzer she picked for the site background, finally with a song to react to */
  let eqRaf = 0, bars = new Float32Array(28);
  function drawEq() {
    if (!alive) return;
    cancelAnimationFrame(eqRaf);
    const f = musicFace(), cv = f && f.querySelector('.eq');
    if (!cv) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 0); if (analyser) analyser.getByteFrequencyData(data);
    const n = bars.length, gap = w * .012, bw = (w - gap * (n + 1)) / n;
    const grad = g.createLinearGradient(0, h, 0, 0); grad.addColorStop(0, 'rgba(212,72,143,.95)'); grad.addColorStop(.6, 'rgba(124,92,214,.8)'); grad.addColorStop(1, 'rgba(95,207,174,.85)');
    g.fillStyle = grad;
    let live = false;
    for (let i = 0; i < n; i++) {
      // log-spaced bands, 40Hz → 14kHz
      const lo = Math.floor(Math.pow(i / n, 2.1) * data.length * .62), hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / n, 2.1) * data.length * .62));
      let v = 0; for (let j = lo; j < hi; j++) v = Math.max(v, data[j] || 0);
      const target = musicOn ? v / 255 : 0;
      bars[i] += (target - bars[i]) * (target > bars[i] ? .55 : .12);
      if (bars[i] > .004) live = true;
      const bh = Math.max(2, bars[i] * h * .95);
      g.beginPath(); g.roundRect ? g.roundRect(gap + i * (bw + gap), h - bh, bw, bh, [bw / 2, bw / 2, 0, 0]) : g.rect(gap + i * (bw + gap), h - bh, bw, bh); g.fill();
    }
    // progress + clock
    if (song && f) { const pr = f.querySelector('.prog i'), tm = f.querySelector('.np__t'); if (song.duration) pr.style.width = (song.currentTime / song.duration * 100) + '%'; const s = Math.floor(song.currentTime); tm.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    if (musicOn || live) eqRaf = requestAnimationFrame(drawEq);
  }
  function fwip(dir) {
    if (!soundOn || !ac || !ready) return;
    const now = ac.currentTime; if (now - lastFwip < .12) return; lastFwip = now;
    const dur = .34, len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) { const x = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * Math.pow(x, .6)), 2) * (1 + .6 * Math.sin(x * 60)); }
    const src = ac.createBufferSource(); src.buffer = buf;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .8;
    const f0 = dir ? 900 : 2600, f1 = dir ? 3200 : 1100;
    bp.frequency.setValueAtTime(f0, now); bp.frequency.exponentialRampToValueAtTime(f1, now + dur);
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
    const g = ac.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.32, now + .05); g.gain.exponentialRampToValueAtTime(.001, now + dur);
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    let chain = src.connect(hp).connect(bp).connect(g);
    if (pan) { pan.pan.setValueAtTime(dir ? .5 : -.5, now); pan.pan.linearRampToValueAtTime(dir ? -.5 : .5, now + dur); chain = chain.connect(pan); }
    chain.connect(ac.destination); src.start(now); src.stop(now + dur);
    if (musicOn && musicGain) { const v = .9; musicGain.gain.cancelScheduledValues(now); musicGain.gain.setValueAtTime(musicGain.gain.value, now); musicGain.gain.linearRampToValueAtTime(v * .45, now + .04); musicGain.gain.linearRampToValueAtTime(v, now + .42); }
  }

  /* ── input ── */
  on(document, 'click', e => {
    const a = e.target.closest('[data-go]'); if (!a || !root.contains(a)) return;
    e.preventDefault(); e.stopPropagation(); closeMenu(); goPage(+a.dataset.go);
  }, true);   // capture phase: runs before Astro's router sees the click
  const btn = root.querySelector('#mag-menu-btn');
  function closeMenu() { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  btn.onclick = e => { e.stopPropagation(); list.hidden = !list.hidden; btn.setAttribute('aria-expanded', String(!list.hidden)); };
  /* ── input: one gesture, one page ──────────────────────────────────────────────────────────── */
  // where the magazine is heading (the page an in-flight turn will land on), so repeated input stacks
  const aim = () => animating ? Math.round((scrollTarget() - track.offsetTop) / unit) : cur();
  const scrollTarget = () => lastAimY;
  const turnBy = n => goSpread(clamp(aim() + n, 0, turns));

  // Keyboard: arrows, Page Up/Down, Space, Home/End. Left alone inside form fields and on buttons/links.
  on(document, 'keydown', e => {
    if (e.key === 'Escape') closeMenu();
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('input,textarea,select,[contenteditable]')) return;
    const onControl = e.target.closest('button,a,summary');
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey && !onControl)) { e.preventDefault(); turnBy(1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey && !onControl)) { e.preventDefault(); turnBy(-1); }
    else if (k === 'Home') { e.preventDefault(); goSpread(0); }
    else if (k === 'End') { e.preventDefault(); goSpread(turns); }
  });
  on(document, 'click', e => { if (!e.target.closest('.menu')) closeMenu(); });

  // Mouse wheel and trackpad: a notch, or one swipe, turns one page. After a turn, a trackpad keeps
  // sending shrinking "momentum" deltas for a second or more; that tail is ignored until something
  // clearly new starts — deltas growing again, a repeated mouse notch, a pause, or a change of direction.
  let wheelAcc = 0, wheelLock = 0, lastWheelT = 0, prevMag = 0, inTail = false, lastWheelTurnDir = 0;
  on(window, 'wheel', e => {
    if (e.ctrlKey) return;                          // pinch-zoom on a trackpad
    if (e.target.closest && e.target.closest('#mag-menu')) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? unit : 1;
    const dx = e.deltaX * scale, dy = e.deltaY * scale, d = Math.abs(dx) > Math.abs(dy) ? dx : dy, mag = Math.abs(d);
    if (!mag) return;
    const now = performance.now(), gap = now - lastWheelT; lastWheelT = now;
    const fresh = Math.sign(d) !== lastWheelTurnDir     // reversed
      || mag > prevMag * 1.25 + 1                      // a new swipe ramping up
      || (mag >= 50 && mag >= prevMag)                 // another mouse-wheel notch
      || (gap > 250 && mag >= 3 && mag >= prevMag)     // a pause, then a real push (a stalled tail keeps shrinking)
      || gap > 1200;
    prevMag = mag;
    if (now < wheelLock) return;                    // the swipe that just turned is often still speeding up
    if (fresh) inTail = false;
    if (gap > 250) wheelAcc = 0;
    if (inTail) return;
    wheelAcc += d;
    if (Math.abs(wheelAcc) >= 28) {
      const dir = Math.sign(wheelAcc); wheelAcc = 0; lastWheelTurnDir = dir;
      turnBy(dir); inTail = true; wheelLock = now + 380;
    }
  }, { passive: false });

  // Touch: the page follows your finger. Drag up (or left) to turn forward; let go past about a
  // quarter of the way, or with a flick, and it finishes the turn — otherwise it settles back.
  let drag = null;
  on(window, 'touchstart', e => {
    if (e.touches.length !== 1 || e.target.closest('.bar,#mag-menu')) { drag = null; return; }
    cancelAnimationFrame(anim); animating = false;
    const tch = e.touches[0];
    drag = { x0: tch.clientX, y0: tch.clientY, p0: Math.round(progress()), pStart: progress(), axis: null, t0: performance.now(), samples: [[performance.now(), progress()]] };
  }, { passive: true });
  on(window, 'touchmove', e => {
    if (!drag || e.touches.length !== 1) return;
    const tch = e.touches[0], dx = tch.clientX - drag.x0, dy = tch.clientY - drag.y0;
    if (!drag.axis) { if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return; drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; }
    e.preventDefault();
    const span = drag.axis === 'y' ? unit * .6 : pw * .85;
    const moved = -(drag.axis === 'y' ? dy : dx) / span;
    const p = clamp(drag.pStart + moved, Math.max(0, drag.p0 - 1), Math.min(turns, drag.p0 + 1));
    scrollTo({ top: track.offsetTop + p * unit, behavior: 'instant' });
    drag.samples.push([performance.now(), p]); if (drag.samples.length > 6) drag.samples.shift();
  }, { passive: false });
  const endDrag = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.axis) return;                            // a tap: leave links and buttons alone
    const now = performance.now(), p = progress();
    const recent = d.samples.filter(([t]) => now - t < 120), [ta, pa] = recent[0] || d.samples[0], [tb, pb] = d.samples[d.samples.length - 1];
    const v = tb > ta ? (pb - pa) / (tb - ta) : 0;   // pages per ms, over the last ~120ms
    const delta = p - d.p0, quick = now - d.t0 < 280 && Math.abs(p - d.pStart) > .08;  // a short, fast swipe
    const fwd = delta > .25 || v > .0012 || (quick && p > d.pStart), back = delta < -.25 || v < -.0012 || (quick && p < d.pStart);
    const target = d.p0 + (fwd && !back ? 1 : back && !fwd ? -1 : 0);
    goSpread(target, false, 260 + 320 * Math.min(1, Math.abs(target - p)));
  };
  on(window, 'touchend', endDrag, { passive: true });
  on(window, 'touchcancel', endDrag, { passive: true });

  // Anything else that scrolls the page (the scrollbar, find-in-page, a screen reader) gets settled
  // onto the nearest page once it stops, so the magazine never rests half-turned.
  let settleT = 0;
  on(window, 'scroll', () => {
    kick();
    clearTimeout(settleT);
    if (animating || drag) return;
    settleT = setTimeout(() => {
      if (!alive || animating || drag || performance.now() - lastWheelT < 200) return;
      const p = progress(), r = Math.round(p);
      if (Math.abs(p - r) > .002) goSpread(r);
    }, 180);
  }, { passive: true });
  let rt; on(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (alive && (innerWidth !== builtW || (probe.offsetHeight || innerHeight) !== builtU)) build(); }, 120); });
  build();

  /* Links from the long-form issue pages can open a specific printed page
     (for example /#p1 opens Contents). Wait until build has measured the
     book, then place that page in view. Plain / still opens on the cover. */
  const deepLink = location.hash.match(/^#p(\d+)$/);
  if (deepLink) setTimeout(() => alive && goPage(Number(deepLink[1]), true), 0);
  on(window, 'hashchange', () => { const m = location.hash.match(/^#p(\d+)$/); if (m) goPage(Number(m[1])); });

  return function teardown() {
    alive = false;
    offs.forEach(off => off());
    html.style.scrollSnapType = prevSnap;
    root.classList.remove('is-live');
    clearTimeout(warmT); clearTimeout(fadeT); clearTimeout(settleT); cancelAnimationFrame(eqRaf); cancelAnimationFrame(anim);
    try { if (song) { song.pause(); song.src = ''; } if (ac) ac.close(); } catch (e) {}
    root.querySelectorAll('video').forEach(v => v.pause());
  };
}
