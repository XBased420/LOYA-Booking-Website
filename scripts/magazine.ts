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
  html.style.scrollSnapType = 'y proximity';
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

  function build() {
    const m = innerWidth > 760 ? 'spread' : 'single';
    const vh = innerHeight;
    if (m === 'spread') { ph = Math.min(vh * 0.8, (innerWidth - 140) / 2 * 1.3); pw = ph / 1.3; }
    else { pw = Math.min(innerWidth - 32, (vh - 170) / 1.3); ph = pw * 1.3; }
    book.style.width = (m === 'spread' ? pw * 2 : pw) + 'px';
    book.style.height = ph + 'px';
    if (m === mode) { layout(); return; }
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
    track.style.height = `calc(${turns + 1} * 100vh)`;
    track.querySelectorAll('.snappt').forEach(n => n.remove());
    for (let s = 0; s <= turns; s++) { const n = el('i', 'snappt'); n.style.top = s * 100 + 'vh'; track.appendChild(n); }
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
  let curls = {}, pairs = [];
  function stillClone(idx) {
    // a frozen copy of a page for the bending strips: videos become their poster stills
    const c = pages[idx].cloneNode(true);
    c.querySelectorAll('video').forEach((v, k) => { const im = document.createElement('img'); im.src = v.getAttribute('poster'); im.alt = ''; im.className = 'vpost'; im.dataset.v = k; v.replaceWith(im); });
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
    root._N = N; root._on = false; root.style.visibility = 'hidden'; { const n = leaves.length, e0 = clamp(shown - i, 0, 1) >= .5 ? 1 : 0, zp = ((n - i) + ((i + 1) - (n - i)) * e0) * dz; root.style.transform = `translateZ(${(zp - 1).toFixed(2)}px)`; }
    bend(root, clamp(shown - i, 0, 1) >= .5 ? 1 : 0); book.appendChild(root); return root;
  }
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
  const progress = () => clamp((scrollY - trackTop) / innerHeight, 0, turns);
  const cur = () => Math.round(progress());

  /* ── video freeze: swap each video for a still of its current frame while pages move ── */
  let moving = false;
  function freeze() {
    faces.forEach(f => f._videos.forEach(v => {
      let cv = v._cv;
      if (!cv) { cv = v._cv = document.createElement('canvas'); cv.className = 'vfreeze'; v.after(cv); }
      const w = v.offsetWidth, h = v.offsetHeight, cs = getComputedStyle(v);
      cv.style.left = v.offsetLeft + 'px'; cv.style.top = v.offsetTop + 'px'; cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.style.transform = cs.transform === 'none' ? '' : cs.transform; cv.style.transformOrigin = cs.transformOrigin;
      const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
      if (v.readyState >= 2 && v.videoWidth) {
        // object-fit: cover, by hand
        const s = Math.max(cv.width / v.videoWidth, cv.height / v.videoHeight), dw = v.videoWidth * s, dh = v.videoHeight * s;
        try { g.drawImage(v, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh); } catch (e) {}
      }
      v.pause();
    }));
    book.classList.add('moving');
    // hand the same frame to the bending copy of the leaf, so grabbing a video page doesn't jump to its poster
    faces.forEach(f => f._videos.forEach((v, k) => {
      const c = curls[f._leaf]; if (!c || !v._cv || !(v.readyState >= 2)) return;
      let url; try { url = v._cv.toDataURL('image/jpeg', .85); } catch (e) { return; }
      c.querySelectorAll(`.sl--${f._sd} img.vpost[data-v="${k}"]`).forEach(im => { im.src = url; });
    }));
  }
  function thaw() {
    book.classList.remove('moving');
    faces.forEach(f => { if (f._shown) f._videos.forEach(v => v.play().catch(() => {})); });
  }

  /* per-frame state, so each frame only touches what actually changed */
  let lastS = -1, lastTurned = -1, lastHint = -1, castOn = null;
  function render(p = shown) {
    const n = leaves.length;
    const T = leaves.map((_, i) => { const v = clamp(p - i, 0, 1); return reduce ? Math.round(v) : v; }), E = T.map(ease);
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
      leaf.style.transform = `translateZ(${z.toFixed(2)}px) rotateY(${(-180 * e).toFixed(3)}deg)`;
      leaf.style.zIndex = t < .5 ? 100 + (n - i) : i + 1;
      // mid-turn, swap the stiff leaf for the bending strips
      const turning = CURL && t > 0 && t < 1;
      if (turning) { const c = curls[i] || (curls[i] = buildCurl(i)); c.style.transform = `translateZ(${(z + .6).toFixed(2)}px)`; if (!c._on) { c.style.visibility = 'visible'; c._on = true; } bend(c, e); if (leaf._vh !== 1) { leaf.style.visibility = 'hidden'; leaf._vh = 1; } }
      else { if (curls[i] && curls[i]._on) { curls[i].style.visibility = 'hidden'; curls[i]._on = false; } if (leaf._vh) { leaf.style.visibility = ''; leaf._vh = 0; } }
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
    shown += (target - shown) * (reduce ? 1 : 1 - Math.exp(-dt / 95));
    if (Math.abs(target - shown) < .0006) shown = target;
    render(shown);
    if (shown !== target) requestAnimationFrame(tick);
    else { loopOn = false; lastTs = 0; warmSoon(); }
  }
  function kick() { if (!loopOn) { loopOn = true; requestAnimationFrame(tick); } }
  /* pre-build the bending strips for the leaves you're about to turn, while nothing is moving */
  let warmT = 0;
  function warmSoon() {
    clearTimeout(warmT);
    warmT = setTimeout(() => {
      if (!alive) return;
      if (!CURL || loopOn) return;
      const s = Math.round(shown), want = [s - 1, s, s + 1].filter(i => i >= 0 && i < leaves.length && (mode === 'spread' || i < turns));
      Object.keys(curls).forEach(k => { if (Math.abs(k - s) > 2) { curls[k].remove(); delete curls[k]; } });
      const next = want.find(i => !curls[i]);
      if (next !== undefined) { curls[next] = buildCurl(next); warmSoon(); }
    }, 120);
  }
  function label(s) {
    const idx = mode === 'spread' ? (s === 0 ? [0] : [2 * s - 1, 2 * s].filter(i => i < pages.length)) : [s];
    return idx.map(i => `p. ${pages[i].dataset.num || '—'} <b>${pages[i].dataset.title}</b>`).join(' &nbsp;/&nbsp; ');
  }
  function goSpread(s) { s = clamp(s, 0, turns); scrollTo({ top: track.offsetTop + s * innerHeight, behavior: reduce ? 'auto' : 'smooth' }); }
  function goPage(i) { goSpread(mode === 'spread' ? Math.ceil(i / 2) : Math.min(i, turns)); }

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
    const a = e.target.closest('[data-go]'); if (!a) return;
    e.preventDefault(); closeMenu(); goPage(+a.dataset.go);
  });
  const btn = root.querySelector('#mag-menu-btn');
  function closeMenu() { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  btn.onclick = e => { e.stopPropagation(); list.hidden = !list.hidden; btn.setAttribute('aria-expanded', String(!list.hidden)); };
  on(document, 'keydown', e => {
    if (e.key === 'Escape') closeMenu();
    if (e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goSpread(cur() + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goSpread(cur() - 1); }
  });
  on(document, 'click', e => { if (!e.target.closest('.menu')) closeMenu(); });
  // horizontal swipe on phones turns pages too
  let sx = 0, sy = 0;
  on(window, 'touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  on(window, 'touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) goSpread(cur() + (dx < 0 ? 1 : -1));
  }, { passive: true });

  on(window, 'scroll', kick, { passive: true });
  let rt; on(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(() => alive && build(), 120); });
  build();

  return function teardown() {
    alive = false;
    offs.forEach(off => off());
    html.style.scrollSnapType = prevSnap;
    root.classList.remove('is-live');
    clearTimeout(warmT); clearTimeout(fadeT); cancelAnimationFrame(eqRaf);
    try { if (song) { song.pause(); song.src = ''; } if (ac) ac.close(); } catch (e) {}
    root.querySelectorAll('video').forEach(v => v.pause());
  };
}
