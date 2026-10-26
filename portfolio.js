(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const panels = [...document.querySelectorAll('.panel')];
  const chapterButtons = [...document.querySelectorAll('[data-chapter]')];
  const board = $('#board');
  const viewport = $('#board-viewport');
  const layer = $('#effect-layer');
  const canvas = $('#effect-canvas');
  const ctx = canvas.getContext('2d');
  const eraser = $('#moving-eraser');
  const shards = $('#shards');
  const target = $('#impact-target');
  const next = $('#next-button');
  const back = $('#back-button');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const effectsButton = $('#effects-toggle');
  const arrows = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" stroke-width="1.5"/></svg>';
  document.querySelectorAll('.contact-shortcut > span, .skill-open, .subtle-link > span, .email-link > span, .contact-socials span, #next-icon').forEach(el => { el.innerHTML = arrows; });
  $('#year').textContent = new Date().getFullYear();

  let preferredEffects = true;
  try { preferredEffects = localStorage.getItem('adjelson-effects') !== 'off'; } catch { /* Storage is optional. */ }
  let current = Math.max(0, panels.findIndex(panel => '#' + panel.id === location.hash));
  let busy = false, pending = current, token = 0, fallback;
  let effectWidth = 0, effectHeight = 0;
  const running = new Set();
  const canAnimate = () => preferredEffects && !motionQuery.matches && Boolean(ctx) && typeof Element.prototype.animate === 'function';
  const labels = ['Passar o apagador', 'Quebrar o óbvio', 'Limpar para continuar', 'Revelar quem está por trás', 'Voltar ao início'];

  document.body.classList.add('interactive');
  $('#experience-controls').hidden = false;
  effectsButton.hidden = false;

  function syncEffects() {
    const enabled = canAnimate();
    document.body.classList.toggle('reduced-motion', !enabled);
    effectsButton.setAttribute('aria-pressed', String(enabled));
    $('#effects-label').textContent = enabled ? 'Efeitos ligados' : 'Efeitos reduzidos';
    effectsButton.title = motionQuery.matches ? 'Movimento reduzido nas preferências do dispositivo.' : 'Ativar ou reduzir as animações';
  }
  function setBusy(value) {
    busy = value;
    board.classList.toggle('is-transitioning', value);
    board.setAttribute('aria-busy', String(value));
    next.disabled = value;
    back.disabled = value || current === 0;
    chapterButtons.forEach(button => { button.disabled = value; });
  }
  function activate(index, announce = true) {
    current = index;
    panels.forEach((panel, i) => { panel.hidden = i !== index; });
    panels[index].scrollTop = 0;
    requestAnimationFrame(syncScrollHint);
    board.classList.toggle('is-contact', index === 4);
    $('#chapter-instruction').textContent = panels[index].dataset.instruction;
    $('#current-step').textContent = String(index + 1).padStart(2, '0');
    $('#next-label').textContent = labels[index];
    chapterButtons.forEach((button, i) => {
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    if (announce) $('#announcement').textContent = `Etapa ${index + 1} de 5. ${panels[index].querySelector('h1, h2').textContent}`;
    setBusy(busy);
    window.dispatchEvent(new Event('portfolio:chapter'));
  }
  function syncScrollHint() {
    const panel = panels[current];
    $('#scroll-hint').hidden = panel.scrollHeight - panel.clientHeight - panel.scrollTop < 24;
  }
  panels.forEach(panel => panel.addEventListener('scroll', syncScrollHint, { passive: true }));
  addEventListener('resize', syncScrollHint);
  function remember(index) {
    const hash = '#' + panels[index].id;
    if (location.hash !== hash) {
      try { history.pushState({ chapter: index }, '', hash); } catch { location.hash = hash; }
    }
  }
  function focusHeading(index) {
    const heading = panels[index].querySelector('h1, h2');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  function cleanEffects() {
    running.forEach(animation => animation.cancel()); running.clear();
    panels.forEach(panel => { panel.style.maskImage = ''; panel.style.webkitMaskImage = ''; panel.style.visibility = ''; panel.style.opacity = ''; });
    layer.classList.remove('is-active');
    eraser.style.display = 'none';
    target.style.display = 'none';
    shards.replaceChildren();
    ctx?.clearRect(0, 0, effectWidth, effectHeight);
  }
  function finish(index, focus = true) {
    clearTimeout(fallback);
    cleanEffects();
    activate(index);
    setBusy(false);
    remember(index);
    if (focus) focusHeading(index);
  }
  function resizeEffect() {
    const rect = layer.getBoundingClientRect();
    effectWidth = rect.width; effectHeight = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(effectWidth * ratio);
    canvas.height = Math.round(effectHeight * ratio);
    ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function progress(duration, callback, id) {
    return new Promise(resolve => {
      const start = performance.now();
      function step(now) {
        if (id !== token) { resolve(false); return; }
        const t = canAnimate() ? Math.max(0, Math.min((now - start) / duration, 1)) : 1;
        callback(t);
        if (t < 1) requestAnimationFrame(step); else resolve(true);
      }
      requestAnimationFrame(step);
    });
  }
  async function tween(element, frames, options) {
    const animation = element.animate(frames, options);
    running.add(animation);
    try { await animation.finished; } catch { /* A mode change can cancel an effect. */ }
    running.delete(animation);
  }
  async function enter(panel, id) {
    if (!canAnimate() || id !== token) return;
    const elements = [...panel.children].filter(el => el.tagName !== 'CANVAS');
    await Promise.all(elements.map((el, i) => tween(el,
      [{ opacity: 0, transform: 'translateY(13px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 450, delay: i * 65, easing: 'cubic-bezier(.2,.8,.2,1)' })));
  }

  // Real erasure: a Canvas alpha mask removes the DOM along the eraser's path.
  async function erase(from, to, id) {
    layer.classList.add('is-active'); resizeEffect();
    const mask = document.createElement('canvas');
    mask.width = 640; mask.height = Math.round(640 * effectHeight / effectWidth);
    const m = mask.getContext('2d');
    if (!m) { activate(to); return; }
    m.fillStyle = '#000'; m.fillRect(0, 0, mask.width, mask.height);
    m.globalCompositeOperation = 'destination-out';
    m.lineWidth = mask.height / 5.2; m.lineCap = 'round'; m.lineJoin = 'round';
    const rows = 6, points = [];
    for (let row = 0; row < rows; row++) {
      const y = (row + .5) / rows;
      points.push({ x: row % 2 ? 1.08 : -.08, y });
      points.push({ x: row % 2 ? -.08 : 1.08, y });
    }
    eraser.style.display = 'flex';
    let previous = points[0], completed = 0;
    const dust = [];
    await progress(1950, t => {
      const distance = t * (points.length - 1);
      const part = Math.min(Math.floor(distance), points.length - 2);
      const f = Math.min(distance - part, 1);
      while (completed < part) {
        const nextPoint = points[++completed];
        m.beginPath(); m.moveTo(previous.x * mask.width, previous.y * mask.height); m.lineTo(nextPoint.x * mask.width, nextPoint.y * mask.height); m.stroke();
        previous = nextPoint;
      }
      const a = points[part], b = points[part + 1];
      const point = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      m.beginPath(); m.moveTo(previous.x * mask.width, previous.y * mask.height); m.lineTo(point.x * mask.width, point.y * mask.height); m.stroke();
      previous = point;
      const image = `url(${mask.toDataURL()})`;
      from.style.maskImage = image; from.style.webkitMaskImage = image;
      const x = point.x * effectWidth, y = point.y * effectHeight;
      eraser.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${part % 4 < 2 ? -12 : 12}deg)`;
      ctx.clearRect(0, 0, effectWidth, effectHeight);
      for (let i = 0; i < 6; i++) dust.push({ x, y: y + 15, vx: (Math.random() - .5) * 4, vy: Math.random() * 1.5, life: 1 });
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i]; p.x += p.vx; p.y += p.vy; p.vy += .035; p.life -= .025;
        if (p.life <= 0) { dust.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(222,233,202,${p.life * .28})`; ctx.fillRect(p.x, p.y, 1.5, 1.5);
      }
    }, id);
    if (id !== token) return;
    from.style.maskImage = ''; from.style.webkitMaskImage = '';
    eraser.style.display = 'none'; ctx.clearRect(0, 0, effectWidth, effectHeight);
    activate(to); await enter(panels[to], id);
  }

  // A radial fracture mesh splits copies of the actual panel into glass shards.
  function fractureMesh() {
    const n = effectWidth < 600 ? 9 : 12;
    const center = { x: .5, y: .48 };
    const inner = [], outer = [], polygons = [];
    for (let i = 0; i < n; i++) {
      const angle = i / n * Math.PI * 2 + .08;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const radius = .13 + (i % 3) * .035;
      inner.push({ x: center.x + dx * radius, y: center.y + dy * radius });
      const reach = Math.min(dx > 0 ? (1 - center.x) / dx : -center.x / dx, dy > 0 ? (1 - center.y) / dy : -center.y / dy);
      outer.push({ x: center.x + dx * reach, y: center.y + dy * reach });
    }
    // The corners are included so the fracture covers the entire rectangular panel.
    const corners = [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      polygons.push([center, inner[i], inner[j]], [inner[i], outer[i], outer[j]], [inner[i], outer[j], inner[j]]);
    }
    // Corner fragments extend the nearest outer pair through each missing corner.
    corners.forEach(corner => {
      const sorted = outer.map((point, i) => ({ point, i, d: Math.hypot(point.x - corner.x, point.y - corner.y) })).sort((a,b) => a.d - b.d);
      polygons.push([sorted[0].point, corner, sorted[1].point]);
    });
    return polygons;
  }
  async function shatter(from, to, id) {
    layer.classList.add('is-active'); resizeEffect();
    target.style.display = 'grid';
    await tween(target, [{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 300 });
    if (id !== token) return;
    const cx = effectWidth * .5, cy = effectHeight * .48;
    // A short perspective projectile rushes into the centre; one soft impact flash.
    await progress(260, t => {
      ctx.clearRect(0, 0, effectWidth, effectHeight);
      const radius = 3 + (1 - t) * 55;
      ctx.strokeStyle = `rgba(222,244,181,${t * .8})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(239,246,219,${t})`;
      ctx.beginPath(); ctx.arc(cx, cy, 2 + t * 5, 0, Math.PI * 2); ctx.fill();
    }, id);
    if (id !== token) return;
    target.style.display = 'none';
    const polygons = fractureMesh();
    await progress(330, t => {
      ctx.clearRect(0, 0, effectWidth, effectHeight);
      ctx.fillStyle = `rgba(230,243,209,${Math.max(0, .21 - t * .4)})`; ctx.fillRect(0, 0, effectWidth, effectHeight);
      ctx.strokeStyle = `rgba(217,235,199,${.5 + t * .3})`; ctx.lineWidth = .8;
      const count = Math.ceil(t * polygons.length);
      polygons.slice(0, count).forEach(poly => {
        ctx.beginPath(); poly.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x * effectWidth, p.y * effectHeight); else ctx.lineTo(p.x * effectWidth, p.y * effectHeight); }); ctx.closePath(); ctx.stroke();
      });
      ctx.fillStyle = '#111a15';ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();
    }, id);
    if (id !== token) return;
    const fragments = polygons.map(poly => {
      const fragment = document.createElement('div'); fragment.className = 'shard';
      fragment.style.clipPath = `polygon(${poly.map(p => `${p.x * 100}% ${p.y * 100}%`).join(',')})`;
      const copy = from.cloneNode(true); copy.removeAttribute('id'); copy.removeAttribute('aria-labelledby');
      copy.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      copy.inert = true;
      fragment.append(copy); shards.append(fragment); copy.scrollTop = from.scrollTop;
      const mx = poly.reduce((sum, p) => sum + p.x, 0) / poly.length - .5;
      const my = poly.reduce((sum, p) => sum + p.y, 0) / poly.length - .48;
      return { fragment, mx, my };
    });
    activate(to);
    ctx.clearRect(0, 0, effectWidth, effectHeight);
    await Promise.all(fragments.map(({ fragment, mx, my }, i) => tween(fragment,
      [{ transform: 'translate3d(0,0,0) rotate(0)', opacity: 1 },
       { transform: `translate3d(${mx * effectWidth * 1.4}px,${my * effectHeight * 1.6 + 120}px,${150 + (i % 4) * 70}px) rotate(${mx * 70}deg) rotateX(${my * 85}deg)`, opacity: 0 }],
      { duration: 850, delay: (i % 5) * 16, easing: 'cubic-bezier(.2,.65,.3,1)', fill: 'forwards' })));
    if (id !== token) return;
    shards.replaceChildren(); await enter(panels[to], id);
  }
  async function navigate(index, effect = 'fade', focus = true) {
    if (busy || index === current || index < 0 || index >= panels.length) return;
    const id = ++token; pending = index;
    setBusy(true);
    // A cancellation or a slow background tab must never leave the controls locked.
    fallback = setTimeout(() => { if (id === token) { ++token; finish(index, focus); } }, 7000);
    try {
      const from = panels[current];
      if (!canAnimate()) activate(index);
      else if (effect === 'erase') await erase(from, index, id);
      else if (effect === 'shatter') await shatter(from, index, id);
      else {
        await tween(from, [{ opacity: 1 }, { opacity: 0 }], { duration: 140 });
        if (id !== token) return;
        from.style.opacity = '';
        activate(index); await enter(panels[index], id);
      }
    } catch (error) {
      console.warn('A transição foi simplificada.', error);
    } finally {
      if (id === token) finish(index, focus);
    }
  }
  function forward() { navigate(current === 4 ? 0 : current + 1, current === 4 ? 'fade' : current % 2 === 0 ? 'erase' : 'shatter'); }
  next.addEventListener('click', forward);
  back.addEventListener('click', () => navigate(current - 1));
  chapterButtons.forEach(button => button.addEventListener('click', () => navigate(Number(button.dataset.chapter))));
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const index = panels.findIndex(panel => '#' + panel.id === link.hash);
    if (index < 0) return;
    event.preventDefault();
    if (index === current) focusHeading(index); else navigate(index);
  }));
  addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); forward(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(current - 1); }
    if (event.key === 'Escape' && busy) { ++token; finish(pending); }
  });
  function hashChanged() {
    const index = panels.findIndex(panel => '#' + panel.id === location.hash);
    if (index >= 0 && index !== current) {
      if (busy) { ++token; finish(index, false); } else navigate(index, 'fade', false);
    }
  }
  addEventListener('popstate', hashChanged);
  addEventListener('hashchange', hashChanged);
  effectsButton.addEventListener('click', () => {
    preferredEffects = !preferredEffects;
    try { localStorage.setItem('adjelson-effects', preferredEffects ? 'on' : 'off'); } catch { /* Optional persistence. */ }
    syncEffects();
    if (busy) { ++token; finish(pending); }
    window.dispatchEvent(new Event('portfolio:effects'));
  });
  motionQuery.addEventListener('change', () => { syncEffects(); if (busy) { ++token; finish(pending); } window.dispatchEvent(new Event('portfolio:effects')); });
  addEventListener('resize', () => { if (busy) { ++token; finish(pending, false); } });

  const descriptions = {
    frontend: ['01 — FRONTEND', 'Interfaces que dão vontade de usar.', 'Componentes reutilizáveis, interfaces responsivas e integração de APIs. O meu foco é React e TypeScript, com atenção à experiência de quem está do outro lado.'],
    backend: ['02 — BACKEND & DADOS', 'O que está por trás também conta.', 'APIs REST, bases de dados relacionais e aplicações orientadas à gestão de informação. Node.js, Express, SQL, PostgreSQL e MySQL fazem parte da minha caixa de ferramentas.'],
    workflow: ['03 — FERRAMENTAS & EQUIPA', 'Bom código constrói-se em conjunto.', 'Git, code reviews, Docker e Agile/Scrum. Uso também ferramentas de IA generativa, incluindo Claude Code, para apoiar a aprendizagem e o desenvolvimento.']
  };
  document.querySelectorAll('[data-skill]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-skill]').forEach(other => { const selected = other === button; other.classList.toggle('is-selected', selected); other.setAttribute('aria-pressed', String(selected)); });
    const [label, title, text] = descriptions[button.dataset.skill];
    const detail = $('#skill-detail');
    detail.querySelector('.detail-label').textContent = label;
    detail.querySelector('h3').textContent = title;
    detail.querySelector('p').textContent = text;
    if (canAnimate()) tween(detail, [{ opacity: .3, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 });
  }));

  // A quiet, responsive circuit field behind the final portrait and contact links.
  const network = $('#contact-network');
  const nc = network.getContext('2d');
  let nw = 0, nh = 0, netFrame = 0, lastTime = 0, phase = 0;
  function drawNetwork() {
    if (!nc || !nw || !nh) return;
    nc.clearRect(0, 0, nw, nh);
    const spacing = 46;
    nc.strokeStyle = '#7ec5b516'; nc.lineWidth = .6;
    for (let x = 0; x < nw; x += spacing) { nc.beginPath(); nc.moveTo(x, 0); nc.lineTo(x, nh); nc.stroke(); }
    for (let y = 0; y < nh; y += spacing) { nc.beginPath(); nc.moveTo(0, y); nc.lineTo(nw, y); nc.stroke(); }
    for (let i = 0; i < 14; i++) {
      const x = ((i * 173 + 25) % Math.max(nw, 1)), y = ((i * 97 + 55) % Math.max(nh, 1));
      const length = 50 + (i % 4) * 25;
      nc.strokeStyle = '#93d9c52b'; nc.lineWidth = 1;
      nc.beginPath();nc.moveTo(x, y);nc.lineTo(x + length, y);nc.lineTo(x + length + 18, y - 18);nc.lineTo(x + length + 18, y - 55);nc.stroke();
      const p = (phase * .16 + i * .11) % 1;
      nc.fillStyle = '#b5e8c4';nc.beginPath();nc.arc(x + p * length, y, 1.7, 0, Math.PI * 2);nc.fill();
      nc.strokeStyle = '#a1ddbf55';nc.beginPath();nc.arc(x,y,3,0,Math.PI*2);nc.stroke();
    }
  }
  function networkLoop(now) {
    netFrame = 0;
    if (current !== 4 || document.hidden || !canAnimate()) return;
    if (now - lastTime > 40) { phase += .035; lastTime = now; drawNetwork(); }
    netFrame = requestAnimationFrame(networkLoop);
  }
  function syncNetwork() {
    cancelAnimationFrame(netFrame); netFrame = 0;
    if (current !== 4 || !nc) return;
    const rect = network.getBoundingClientRect(); nw = rect.width; nh = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    network.width = nw * ratio; network.height = nh * ratio; nc.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawNetwork();
    if (canAnimate() && !document.hidden) netFrame = requestAnimationFrame(networkLoop);
  }
  addEventListener('portfolio:chapter', syncNetwork);
  addEventListener('portfolio:effects', syncNetwork);
  addEventListener('resize', syncNetwork);
  document.addEventListener('visibilitychange', syncNetwork);
  syncEffects(); activate(current, false);
})();
