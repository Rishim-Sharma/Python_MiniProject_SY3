(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const MODES = Object.fromEntries(JSON.parse($('#modes-data').textContent).map(m => [m.id, m]));
  const MODE_IDS = Object.keys(MODES);
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---------- custom cursor ---------- */
  if (fine) {
    const dot = $('.cursor-dot'), ring = $('.cursor-ring');
    let x = 0, y = 0, rx = 0, ry = 0, seen = false;
    document.body.classList.add('has-cursor');
    addEventListener('pointermove', e => {
      x = e.clientX; y = e.clientY;
      if (!seen) { rx = x; ry = y; seen = true; }
      dot.style.transform = `translate3d(${x}px,${y}px,0)`;
      dot.style.opacity = ring.style.opacity = 1;
            const hit = e.target.closest('a,button,label,input,summary');
      ring.classList.toggle('is-hover', !!hit);
    });
    addEventListener('pointerdown', () => ring.classList.add('is-down'));
    addEventListener('pointerup', () => ring.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => { dot.style.opacity = ring.style.opacity = 0; });
    (function loop() {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      requestAnimationFrame(loop);
    })();

    if (!reduce) {
      $$('[data-magnetic]').forEach(el => {
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px,${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
      });
    }
  }

  /* ---------- tooltip ---------- */
  const tip = $('#tip');
  addEventListener('pointermove', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.style.opacity = 0; return; }
    tip.textContent = t.dataset.tip;
    tip.style.opacity = 1;
    tip.style.transform = `translate(${Math.min(e.clientX + 16, innerWidth - tip.offsetWidth - 8)}px,${e.clientY + 18}px)`;
  });

  /* ---------- scroll progress + active nav ---------- */
  const prog = $('#progress');
  const onScroll = () => {
    const h = document.documentElement;
    prog.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100 + '%';
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const links = $$('nav a');
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => io.observe(s));

  /* ---------- orbit canvas ---------- */
  const cv = $('#orbit'), g = cv.getContext('2d');
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.1 + 0.3 }));
  let W = 0, H = 0, ang = -1.2, station = -Math.PI * 0.28, last = 0, trail = [], inRange = false;
  const col = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  function size() {
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = W * d; cv.height = H * d;
    g.setTransform(d, 0, 0, d, 0, 0);
  }
  function draw(t) {
    const dt = last ? Math.min(t - last, 50) : 16; last = t;
    if (!reduce) ang += dt * 0.00035;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.19, O = Math.min(W, H) * 0.4;
    const ink = col('--ink'), line = col('--line'), accent = col('--accent'), teal = col('--teal'), panel = col('--panel');
    g.clearRect(0, 0, W, H);

    g.fillStyle = ink;
    stars.forEach(s => { g.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.0006 + s.x * 20)); g.fillRect(s.x * W, s.y * H, s.s, s.s); });
    g.globalAlpha = 1;

    g.strokeStyle = line; g.lineWidth = 1; g.setLineDash([3, 6]);
    g.beginPath(); g.arc(cx, cy, O, 0, 7); g.stroke(); g.setLineDash([]);

    g.fillStyle = panel; g.strokeStyle = ink; g.globalAlpha = 0.9;
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill(); g.stroke();
    g.globalAlpha = 0.25; g.strokeStyle = ink;
    [-0.5, 0, 0.5].forEach(k => { g.beginPath(); g.ellipse(cx, cy + k * R, R * Math.sqrt(1 - k * k), R * 0.14, 0, 0, 7); g.stroke(); });
    g.beginPath(); g.ellipse(cx, cy, R * 0.45, R, 0, 0, 7); g.stroke();
    g.globalAlpha = 1;

    const sx = cx + Math.cos(station) * R, sy = cy + Math.sin(station) * R;
    const px = cx + Math.cos(ang) * O, py = cy + Math.sin(ang) * O;
    trail.push([px, py]); if (trail.length > 46) trail.shift();
    trail.forEach(([a, b], i) => { g.globalAlpha = i / trail.length * 0.5; g.fillStyle = accent; g.fillRect(a - 1, b - 1, 2, 2); });
    g.globalAlpha = 1;

    const near = Math.abs(wrap(ang - station)) < 0.6;
    if (near !== inRange) {
      inRange = near;
      const el = $('#orbitState'); el.textContent = near ? 'In range' : 'Out of range'; el.classList.toggle('in', near);
    }
    if (near) {
      g.strokeStyle = teal; g.lineWidth = 1.5; g.setLineDash([5, 4]); g.lineDashOffset = -t * 0.02;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(px, py); g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = near ? teal : ink;
    g.fillRect(sx - 4, sy - 4, 8, 8);
    g.font = '10px "IBM Plex Mono",monospace'; g.fillStyle = ink; g.globalAlpha = 0.7;
    g.fillText('GROUND', sx + (Math.cos(station) >= 0 ? 10 : -56), sy + (Math.sin(station) >= 0 ? 16 : -8));
    g.globalAlpha = 1;

    g.save(); g.translate(px, py); g.rotate(ang + Math.PI / 4);
    g.fillStyle = accent; g.fillRect(-7, -7, 14, 14);
    g.strokeStyle = col('--bg'); g.lineWidth = 1.5; g.strokeRect(-3.5, -3.5, 7, 7);
    g.restore();
    g.fillStyle = accent; g.fillText('SOMAIYASAT', px + (Math.cos(ang) >= 0 ? 14 : -78), py - 12);

    if (!reduce) requestAnimationFrame(draw);
  }
  cv.addEventListener('click', e => {
    const r = cv.getBoundingClientRect();
    station = Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2);
    trail = []; if (reduce) draw(performance.now());
  });
  addEventListener('resize', () => { size(); if (reduce) draw(performance.now()); });
  document.fonts?.ready.then(() => { if (reduce) draw(performance.now()); });
  size(); requestAnimationFrame(draw);

  /* ---------- pass simulator (talks to Flask) ---------- */
  const els = { link: $('#link'), batt: $('#batt'), mins: $('#mins'), ecl: $('#ecl'), fault: $('#fault') };
  const segEls = Object.fromEntries($$('.seg').map(s => [s.dataset.id, s]));
  let ctrl;

  function labels() {
    $('#linkO').textContent = els.link.value + '%';
    $('#battO').textContent = els.batt.value + '%';
    $('#minsO').textContent = els.mins.value + ' min';
    ['link', 'batt', 'mins'].forEach(k => {
      const i = els[k];
      i.style.setProperty('--p', (i.value - i.min) / (i.max - i.min) * 100 + '%');
    });
  }
  async function run() {
    labels();
    const q = new URLSearchParams({
      link: els.link.value, battery: els.batt.value, minutes: els.mins.value,
      eclipse: +els.ecl.checked, fault: +els.fault.checked,
    });
    ctrl?.abort(); ctrl = new AbortController();
    try {
      const r = await fetch('/api/schedule?' + q, { signal: ctrl.signal });
      render(await r.json());
    } catch (e) {
      if (e.name !== 'AbortError') $('#reason').textContent = 'Could not reach the Flask server.';
    }
  }
  function render(d) {
    const st = $('#status'); st.textContent = d.status; st.className = 'pill ' + d.tone;
    $('#reason').textContent = d.reason;
    $('#endLbl').textContent = 'Pass end · ' + (d.total / 60) + ' min';

    MODE_IDS.forEach(id => { segEls[id].style.width = '0%'; segEls[id].textContent = ''; segEls[id].removeAttribute('data-tip'); });
    d.segments.forEach((s, i) => {
      const el = segEls[s.id], pct = s.seconds / d.total * 100;
      el.style.order = i; el.style.width = pct + '%';
      el.textContent = pct > 9 ? MODES[s.id].name : '';
      el.dataset.tip = `${MODES[s.id].full} · ${s.seconds} s · ${s.kb} kB`;
    });
    MODE_IDS.forEach(id => { if (!d.segments.some(s => s.id === id)) segEls[id].style.order = 9; });

    const names = o => o.map(id => `<b>${MODES[id].name}</b>`).join(' → ');
    $('#order').innerHTML = d.fallback
      ? `<span class="bad">AI order ${names(d.ai_order)}</span><span>rejected, using</span>${names(d.order)}`
      : `<span>Model order</span>${names(d.order)}`;

    $('#meter').innerHTML =
      `<span>Airtime <b>${d.used} of ${d.total} s</b></span>` +
      `<span>Battery used <b>${d.battery_used}%</b></span>` +
      `<span>Reserve <b>${d.reserve}%</b></span>` +
      `<span>Data <b>${d.kb} kB</b></span>`;

    $('#log').innerHTML = d.log.map((l, i) =>
      `<li style="animation-delay:${i * 45}ms"><span class="tag ${l.kind}">${l.kind}</span><span><b>${l.label}.</b> ${l.text}</span></li>`).join('');
  }
  Object.values(els).forEach(el => el.addEventListener('input', run));
  $$('[data-p]').forEach(b => b.addEventListener('click', () => {
    const [l, bt, m, e] = b.dataset.p.split(',');
    els.link.value = l; els.batt.value = bt; els.mins.value = m;
    els.ecl.checked = e === '1'; els.fault.checked = false; run();
  }));
  run();

  /* ---------- one-day chart ---------- */
  const chart = $('#chart'), MAXKB = Object.values(MODES).reduce((a, m) => a + m.kb, 0);
  async function loadDay(seed) {
    try {
      const r = await fetch('/api/day' + (seed ? '?seed=' + seed : ''));
      const d = await r.json();
      chart.innerHTML = d.passes.map(p => `
        <button class="pass" data-i="${p.n - 1}">
          <div class="stack">${MODE_IDS.filter(id => p.by_mode[id]).map(id =>
            `<i class="${id}" data-h="${p.by_mode[id] / MAXKB * 100}" data-tip="${MODES[id].name} · ${p.by_mode[id]} kB"></i>`).join('')}</div>
          <span class="n">P${p.n}</span>
          <span class="m">${p.link}% link<br>${p.minutes} min · ${p.battery}% batt</span>
          <span class="flag ${p.fault ? 'f' : 'ecl'}">${p.fault ? 'Fault' : p.eclipse ? 'Eclipse' : '&nbsp;'}</span>
        </button>`).join('');
      requestAnimationFrame(() => requestAnimationFrame(() =>
        $$('.stack i', chart).forEach(i => { i.style.height = i.dataset.h + '%'; })));
      $('#dayTotal').textContent = `Day ${d.seed} · ${d.total_kb} kB downlinked`;
      $$('.pass', chart).forEach(b => b.addEventListener('click', () => {
        const p = d.passes[+b.dataset.i];
        els.link.value = p.link; els.batt.value = p.battery; els.mins.value = p.minutes;
        els.ecl.checked = p.eclipse; els.fault.checked = p.fault; run();
        $('#simulator').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
      }));
    } catch (e) { $('#dayTotal').textContent = 'Could not reach the Flask server.'; }
  }
  $('#newDay').addEventListener('click', () => loadDay(Math.floor(Math.random() * 9998) + 1));
  loadDay(7);

  /* ---------- mission steps ---------- */
  const STEPS = [
    ['Launch', 'SomaiyaSat rides inside SomaiyaPod, the deployer. It stays switched off and held tight through launch.'],
    ['Release', 'At the planned point in orbit a timer fires and the pod pushes the satellite out.'],
    ['Wake up', 'Separation switches turn the satellite on. It checks its battery and sends first health data.'],
    ['Passes', 'On every ground pass the scheduler reads link and battery, then picks what to send. This is the part you tried above.'],
    ['Review', 'The ground station decodes the data. Telemetry feeds back into a better model for next time.'],
  ];
  let cur = 0;
  const stepper = $('#stepper'), panel = $('#stepPanel');
  STEPS.forEach((s, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<i>${i + 1}</i><span>${s[0]}</span>`;
    b.addEventListener('click', () => go(i));
    stepper.appendChild(b);
  });
  function go(i) {
    cur = Math.max(0, Math.min(STEPS.length - 1, i));
    panel.classList.add('swap');
    setTimeout(() => {
      $('#stN').textContent = '0' + (cur + 1);
      $('#stT').textContent = STEPS[cur][0];
      $('#stP').textContent = STEPS[cur][1];
      panel.classList.remove('swap');
    }, reduce ? 0 : 160);
    $$('button', stepper).forEach((b, j) => { b.classList.toggle('on', j === cur); b.classList.toggle('done', j < cur); });
    $('#fill').style.width = cur / (STEPS.length - 1) * 100 + '%';
    $('#prev').disabled = cur === 0; $('#next').disabled = cur === STEPS.length - 1;
  }
  $('#prev').addEventListener('click', () => go(cur - 1));
  $('#next').addEventListener('click', () => go(cur + 1));
  $('#mission').addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') go(cur + 1);
    if (e.key === 'ArrowLeft') go(cur - 1);
  });
  go(0);
})();
