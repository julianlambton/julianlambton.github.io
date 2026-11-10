/* ============================================================
   V5 PORTFOLIO — SCRIPT.JS
   1. 2D canvas stream (fallback, only if WebGL stream.js failed)
   2. Nav toggle (hamburger on mobile)
   3. Scroll reveals
   4. SKILLS wheel / carousel  <- edit the SKILLS array below
   5. Contact block scroll animation
   6. Nav highlight, scroll progress bar, copy email, footer year
   ============================================================ */

'use strict';

/* ─── UTILS ─── */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rng = (lo, hi) => Math.random() * (hi - lo) + lo;

/* =============================================
   1. THE STREAM — 2D canvas fallback
      Runs only when WebGL stream (stream.js) failed.
   ============================================= */
if (window.__glStream !== true)
(function initStream() {
  const canvas = document.getElementById('stream-canvas');
  if (!canvas) return;

  /* Respect prefers-reduced-motion: one static frame, no animation */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = canvas.getContext('2d');
  const MOBILE = () => window.innerWidth <= 700;

  /* Config */
  const LINE_COUNT_FULL   = 6;
  const LINE_COUNT_MOBILE = 3;
  const BASE_COLORS = ['#B8F53D', '#3FA34D', '#8ADE2A', '#50C860', '#D4F87A', '#2E8B3C'];

  /* Per-line state */
  let lines = [];

  function buildLines(count) {
    lines = [];
    for (let i = 0; i < count; i++) {
      lines.push({
        color:      BASE_COLORS[i % BASE_COLORS.length],
        phase:      rng(0, Math.PI * 2),
        speed:      rng(0.00018, 0.00032),          /* idle drift speed */
        amplitude:  rng(0.06, 0.16),                /* fraction of height */
        freq:       rng(0.6, 1.4),                  /* sine frequency multiplier */
        alpha:      rng(0.15, 0.55),
        width:      rng(1.2, 3.2),
        blur:       rng(12, 18),
        offsetX:    rng(-0.15, 0.15),               /* fraction of width */
        scrollOff:  0,                              /* lerp target from scroll */
        scrollCur:  0,                              /* smoothed scroll value */
      });
    }
  }

  /* Resize */
  let dpr = 1;
  function resize() {
    dpr = clamp(window.devicePixelRatio || 1, 1, MOBILE() ? 1.5 : 2);
    canvas.width  = window.innerWidth  * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);
    buildLines(MOBILE() ? LINE_COUNT_MOBILE : LINE_COUNT_FULL);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  resize();

  /* Scroll tracking */
  let scrollProgress = 0;  /* 0 at top, 1 at bottom */
  window.addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = max > 0 ? window.scrollY / max : 0;
  }, { passive: true });

  /* Section brightness map:
     hero → subtle (.3), stack → brightest (1.0), contact → fade (.2) */
  function sectionBrightness(sp) {
    if (sp < 0.25)       return lerp(0.3, 0.55, sp / 0.25);
    if (sp < 0.55)       return lerp(0.55, 1.0, (sp - 0.25) / 0.30);
    if (sp < 0.80)       return lerp(1.0, 0.45, (sp - 0.55) / 0.25);
    return lerp(0.45, 0.2, (sp - 0.80) / 0.20);
  }

  /* Draw one ribbon line */
  function drawLine(line, t, brightness) {
    const W = window.innerWidth;
    const H = window.innerHeight;

    /* Smooth the scroll offset */
    line.scrollOff = scrollProgress * 0.35;
    line.scrollCur = lerp(line.scrollCur, line.scrollOff, 0.08);

    const phase  = line.phase + t * line.speed * Math.PI * 2 * 18;
    const amp    = line.amplitude * H;
    const baseX  = (0.5 + line.offsetX + line.scrollCur) * W;
    const spread = W * 0.38;

    /* Build 5 bezier control points */
    const pts = [];
    for (let i = 0; i <= 4; i++) {
      const frac = i / 4;
      const x = baseX + Math.sin(frac * Math.PI * line.freq + phase + i * 0.8) * spread;
      const y = H * frac;
      pts.push({ x, y });
    }

    const alpha = clamp(line.alpha * brightness, 0, 1);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur  = line.blur;
    ctx.shadowColor = line.color;
    ctx.strokeStyle = line.color;
    ctx.lineWidth   = line.width;
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur  = pts[i];
      const cpx  = (prev.x + cur.x) / 2;
      const cpy  = (prev.y + cur.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  /* Animation loop */
  let lastT = 0;
  let rafId = null;

  function frame(ts) {
    if (document.hidden) {
      rafId = requestAnimationFrame(frame);
      return;
    }
    lastT = ts;
    const t = ts / 1000;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const brightness = sectionBrightness(scrollProgress);
    lines.forEach(line => drawLine(line, t, brightness));

    rafId = requestAnimationFrame(frame);
  }

  if (reduced) {
    /* One static frame */
    const brightness = 0.4;
    lines.forEach(line => drawLine(line, 0, brightness));
  } else {
    rafId = requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !rafId) {
        rafId = requestAnimationFrame(frame);
      }
    });
  }
})();


/* =============================================
   2. NAV TOGGLE (hamburger)
   ============================================= */
(function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const links  = document.getElementById('nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });

  /* Close on link click (smooth scroll already handled by CSS) */
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();


/* =============================================
   3. INTERSECTION OBSERVER REVEALS
      80ms stagger per element within a parent
   ============================================= */
(function initReveals() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return; /* CSS already makes them visible */

  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;

      /* Compute stagger: position among siblings with .reveal */
      const siblings = el.parentElement
        ? [...el.parentElement.querySelectorAll('.reveal')]
        : [];
      const idx = siblings.indexOf(el);
      const delay = idx >= 0 ? idx * 80 : 0;

      setTimeout(() => el.classList.add('visible'), delay);
      observer.unobserve(el);
    });
  }, { threshold: 0.2 });

  elements.forEach(el => observer.observe(el));
})();


/* =============================================
   4. SKILLS — wheel (desktop) / snap carousel (mobile)
      Edit descriptions here. Keep them short and true.
   ============================================= */
const SKILLS = [
  { label: 'Python', title: 'Python',
    desc: 'Ongoing self-directed practice building functional modules, including the 100 Days of Code program since May 2026.' },
  { label: 'Java', title: 'Java',
    desc: 'Part of my core toolkit, alongside the object-oriented principles I use to keep code organized and reusable.' },
  { label: 'JavaScript', title: 'JavaScript',
    desc: 'One of my core languages, used on the backend through Node.js and on the front end.' },
  { label: 'TypeScript', title: 'TypeScript',
    desc: 'Wrote the Smart Agriculture backend and the Scouting Report App in TypeScript.' },
  { label: 'HTML & CSS', title: 'HTML & CSS',
    desc: 'The foundation of my front-end work: structuring pages and building responsive layouts.' },
  { label: 'SQL & Postgres', title: 'SQL & PostgreSQL',
    desc: 'Query and structure data with SQL. The Scouting Report App stores players, teams, scouts and reports in PostgreSQL.' },
  { label: 'Node & Express', title: 'Node.js & Express',
    desc: 'Built backends with Node.js and Express, keeping database connections separate from route handlers.' },
  { label: 'React', title: 'React',
    desc: 'Built the Scouting Report App dashboard with React and Vite, including a live form that updates the UI instantly.' },
  { label: 'Git & GitHub', title: 'Git & GitHub',
    desc: 'Use Git and GitHub for source control and project documentation across my projects.' },
  { label: 'Testing', title: 'Testing & Debugging',
    desc: 'Test programming logic, track down errors and refactor code to make it more readable and maintainable.' },
];

(function initSkills() {
  const root    = document.getElementById('skills-widget');
  const wheel   = document.getElementById('wheel');
  const ring    = document.getElementById('wheel-ring');
  const panel   = document.getElementById('wheel-center');
  const titleEl = document.getElementById('skill-title');
  const descEl  = document.getElementById('skill-desc');
  if (!root || !wheel || !ring || !panel || !titleEl || !descEl) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mq      = window.matchMedia('(max-width: 899px)');   /* true = carousel */
  const STEP    = 360 / SKILLS.length;
  let active = -1;
  let ringAngle = 0;
  let swapTimer = 0;
  let raf = 0;

  /* Build the buttons from the SKILLS array */
  const nodes = SKILLS.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'skill-node';
    b.setAttribute('aria-pressed', 'false');
    b.style.setProperty('--a', (i * STEP) + 'deg');
    b.innerHTML =
      '<span class="sn-index"></span><span class="sn-label"></span>' +
      '<span class="sn-title"></span><span class="sn-desc"></span>';
    b.querySelector('.sn-index').textContent = String(i + 1).padStart(2, '0');
    b.querySelector('.sn-label').textContent = s.label;
    b.querySelector('.sn-title').textContent = s.title;
    b.querySelector('.sn-desc').textContent  = s.desc;
    b.addEventListener('click', () => onPick(i));
    ring.appendChild(b);
    return b;
  });

  function onPick(i) {
    if (!mq.matches && i === active) { setActive(-1); return; }  /* click again = deselect (desktop) */
    setActive(i, { scroll: true });
  }

  function swapPanel(i) {
    const title = i >= 0 ? SKILLS[i].title : 'Select a skill';
    const desc  = i >= 0 ? SKILLS[i].desc  : 'Click any skill to see what I’ve done with it.';
    clearTimeout(swapTimer);
    if (reduced) { titleEl.textContent = title; descEl.textContent = desc; return; }
    panel.classList.add('swap');
    swapTimer = setTimeout(() => {
      titleEl.textContent = title;
      descEl.textContent  = desc;
      panel.classList.remove('swap');
    }, 160);
  }

  function setActive(i, opts) {
    opts = opts || {};
    active = i;
    root.dataset.active = String(i);
    nodes.forEach((n, k) => {
      const on = k === i;
      n.classList.toggle('active', on);
      n.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    if (!mq.matches) {
      /* wheel: rotate the ring so the active node sits at the top (shortest way round) */
      if (i >= 0 && !reduced) {
        const x = -(i * STEP) - ringAngle;
        const d = (((x % 360) + 540) % 360) - 180;
        ringAngle += d;
        wheel.style.setProperty('--ring', ringAngle + 'deg');
      }
      swapPanel(i);
    } else if (i >= 0 && opts.scroll) {
      nodes[i].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    }
  }

  /* Carousel: the card nearest the centre becomes active while scrolling */
  function nearest() {
    const r  = ring.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    let best = 0, bd = Infinity;
    nodes.forEach((n, k) => {
      const b = n.getBoundingClientRect();
      const d = Math.abs(b.left + b.width / 2 - cx);
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  }
  ring.addEventListener('scroll', () => {
    if (!mq.matches || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const i = nearest();
      if (i !== active) setActive(i);
    });
  }, { passive: true });

  /* Keyboard: arrows move between skills, Esc clears (desktop) */
  ring.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !mq.matches) { setActive(-1); return; }
    let d = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') d = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') d = -1;
    else return;
    e.preventDefault();
    const cur  = nodes.indexOf(document.activeElement);
    const base = cur >= 0 ? cur : Math.max(active, 0);
    const next = (base + d + nodes.length) % nodes.length;
    nodes[next].focus({ preventScroll: true });
    setActive(next, { scroll: true });
  });

  /* Switch cleanly between wheel and carousel when the window size crosses 900px */
  function applyMode() {
    ringAngle = 0;
    wheel.style.removeProperty('--ring');
    if (mq.matches) { ring.scrollLeft = 0; setActive(0); }
    else { setActive(-1); }
  }
  if (mq.addEventListener) mq.addEventListener('change', applyMode);
  else if (mq.addListener) mq.addListener(applyMode);
  applyMode();
})();


/* =============================================
   5. CONTACT BLOCK SCROLL ANIMATION
      scale 0.82 → 1, border-radius 48px → 24px
      driven by block's position in viewport
   ============================================= */
(function initContactAnim() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const block = document.getElementById('contact-block');
  if (!block) return;

  let ticking = false;

  function update() {
    ticking = false;
    const rect = block.getBoundingClientRect();
    const vh   = window.innerHeight;
    /* progress: 0 when bottom of block enters viewport, 1 when top reaches 20% from top */
    const raw  = 1 - (rect.bottom - vh * 0.2) / (rect.height + vh * 0.8);
    const t    = Math.min(1, Math.max(0, raw));

    const scale  = 0.82 + t * (1.0 - 0.82);
    const radius = 48  - t * (48 - 24);
    block.style.transform    = `scale(${scale.toFixed(4)})`;
    block.style.borderRadius = `${radius.toFixed(1)}px`;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  update(); /* initial state */
})();


/* =============================================
   6. EXTRAS — nav highlight, progress bar,
      copy email, footer year
   ============================================= */
(function initNavHighlight() {
  const links = [...document.querySelectorAll('#nav-links a[href^="#"]')];
  const map = links
    .map(a => ({ a, s: document.querySelector(a.getAttribute('href')) }))
    .filter(x => x.s);
  if (!map.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) map.forEach(m => m.a.classList.toggle('active', m.s === e.target));
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  map.forEach(m => io.observe(m.s));
})();

(function initProgressBar() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  let ticking = false;
  function update() {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = max > 0 ? window.scrollY / max : 0;
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();

(function initCopyEmail() {
  const btn = document.getElementById('copy-email');
  if (!btn) return;
  const email = btn.dataset.email || '';
  const label = btn.textContent;
  let timer = 0;
  function done(ok) {
    btn.textContent = ok ? 'Copied' : 'Copy failed';
    clearTimeout(timer);
    timer = setTimeout(() => { btn.textContent = label; }, 1500);
  }
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = email;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    done(ok);
  }
  btn.addEventListener('click', () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(email).then(() => done(true), fallback);
    } else {
      fallback();
    }
  });
})();

(function initYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = String(new Date().getFullYear());
})();
