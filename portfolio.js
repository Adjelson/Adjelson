(() => {
  'use strict';

  const root = document.documentElement;
  const mediaMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let systemReduced = mediaMotion.matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const motionButton = document.getElementById('motion-toggle');
  let userMotion = true;
  try { userMotion = localStorage.getItem('adjelson-effects') !== 'off'; } catch { /* Storage is optional. */ }
  const hasMotion = () => userMotion && !systemReduced;
  const activeAnimations = new Set();
  document.getElementById('year').textContent = new Date().getFullYear();

  // All sections remain in the document. Scroll and anchor navigation stay native.
  const revealElements = [...document.querySelectorAll('[data-reveal]')];
  if ('IntersectionObserver' in window) {
    root.classList.add('motion-ready');
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        reveals.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -25px 0px' });
    revealElements.forEach(el => reveals.observe(el));
  }

  const progressBar = document.querySelector('.reading-progress');
  const hero = document.querySelector('.hero');
  const art = document.querySelector('.hero-art');
  const skills = document.querySelector('.skills-section');
  const edge = document.querySelector('.liquid-edge');
  const blob = document.querySelector('.skills-blob');
  let queued = false;
  const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
  function updateScroll() {
    queued = false;
    const max = root.scrollHeight - innerHeight;
    progressBar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    if (!hasMotion()) {
      art.style.removeProperty('--art-y');
      edge.style.removeProperty('--wave-scale');
      blob.style.removeProperty('--blob-angle');
      blob.style.removeProperty('--blob-scale');
      return;
    }
    const heroRect = hero.getBoundingClientRect();
    if (heroRect.bottom > 0) art.style.setProperty('--art-y', `${clamp(-heroRect.top * .07, -12, 75)}px`);
    const skillRect = skills.getBoundingClientRect();
    if (skillRect.top < innerHeight && skillRect.bottom > 0) {
      const phase = clamp((innerHeight - skillRect.top) / (innerHeight + skillRect.height), 0, 1);
      edge.style.setProperty('--wave-scale', String(.6 + phase * .8));
      blob.style.setProperty('--blob-angle', `${phase * 65 - 10}deg`);
      blob.style.setProperty('--blob-scale', String(.8 + phase * .5));
    }
  }
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  addEventListener('resize', updateScroll);
  if ('ResizeObserver' in window) new ResizeObserver(updateScroll).observe(document.body);

  const dot = document.querySelector('.pointer-dot');
  document.addEventListener('pointermove', event => {
    if (!finePointer.matches || !hasMotion()) return;
    dot.style.left = event.clientX + 'px';
    dot.style.top = event.clientY + 'px';
    dot.classList.toggle('is-visible', !event.target.closest('a, button'));
  }, { passive: true });
  document.addEventListener('pointerleave', () => dot.classList.remove('is-visible'));

  art.addEventListener('pointermove', event => {
    if (!finePointer.matches || !hasMotion()) return;
    const rect = art.getBoundingClientRect();
    art.style.setProperty('--art-turn', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 15 - 6}deg`);
  }, { passive: true });
  art.addEventListener('pointerleave', () => art.style.removeProperty('--art-turn'));

  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (!finePointer.matches || !hasMotion()) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--tilt-x', `${-(event.clientY - rect.top - rect.height / 2) / rect.height * 10}deg`);
      card.style.setProperty('--tilt-y', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 10}deg`);
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y');
    });
  });
  document.querySelectorAll('.magnetic').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (!finePointer.matches || !hasMotion()) return;
      const rect = button.getBoundingClientRect();
      button.style.translate = `${(event.clientX - rect.left - rect.width / 2) * .1}px ${(event.clientY - rect.top - rect.height / 2) * .15}px`;
    }, { passive: true });
    button.addEventListener('pointerleave', () => button.style.removeProperty('translate'));
  });

  // A small, optional interaction; it never changes page position or navigation.
  const sparkButton = document.getElementById('spark-button');
  const sparkStatus = document.getElementById('spark-status');
  let lastSpark = -Infinity;
  sparkButton.addEventListener('click', () => {
    sparkStatus.textContent = 'Mais uma ideia para pôr em prática!';
    if (!hasMotion() || !Element.prototype.animate || performance.now() - lastSpark < 450) return;
    lastSpark = performance.now();
    const rect = sparkButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const colors = ['#7952d9', '#d7f591', '#ff9b73', '#c9b5fa'];
    for (let i = 0; i < 22; i++) {
      const bit = document.createElement('span'); bit.className = 'confetti';
      bit.setAttribute('aria-hidden', 'true');
      const size = 5 + Math.random() * 8;
      bit.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size * .65}px;background:${colors[i % colors.length]};border-radius:${i % 3 === 0 ? '50%' : '2px'}`;
      document.body.append(bit);
      const angle = i / 22 * Math.PI * 2;
      const distance = 70 + Math.random() * 120;
      const animation = bit.animate([
        { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance + 70}px) rotate(${i * 47}deg)`, opacity: 0 }
      ], { duration: 850 + Math.random() * 350, easing: 'cubic-bezier(.1,.65,.35,1)', fill: 'forwards' });
      activeAnimations.add(animation);
      const clean = () => { activeAnimations.delete(animation); bit.remove(); };
      animation.finished.then(clean, clean);
    }
  });

  // Ambient colour and a circuit of nodes appear only behind the contact section.
  const canvas = document.getElementById('contact-canvas');
  const ctx = canvas.getContext('2d');
  const contact = document.querySelector('.contact-section');
  let width = 0, height = 0, frame = 0, lastFrame = 0, time = 0, visible = false;
  const pointer = { x: .5, y: .5 };
  const nodes = Array.from({ length: 25 }, (_, i) => ({ x: ((i * 157 + 41) % 997) / 997, y: ((i * 97 + 77) % 613) / 613 }));
  function drawContact() {
    if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const glows = [
      { x: width * (.17 + Math.sin(time * .3) * .05), y: height * .6, color: '121,82,217' },
      { x: width * .85, y: height * (.3 + Math.sin(time * .2) * .1), color: '116,78,160' },
      { x: width * .75, y: height * .9, color: '130,75,55' }
    ];
    for (const glow of glows) {
      const gradient = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, width * .47);
      gradient.addColorStop(0, `rgba(${glow.color},.22)`); gradient.addColorStop(1, `rgba(${glow.color},0)`);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    }
    const positions = nodes.map((node, i) => ({ x: node.x * width + Math.sin(time * .4 + i) * 12 + (pointer.x - .5) * 8, y: node.y * height + Math.cos(time * .3 + i) * 12 + (pointer.y - .5) * 8 }));
    for (let i = 0; i < positions.length; i++) {
      const a = positions[i];
      for (let j = i + 1; j < positions.length; j++) {
        const b = positions[j], distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance > 165) continue;
        ctx.strokeStyle = `rgba(201,181,250,${(1 - distance / 165) * .18})`;
        ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.fillStyle = i % 3 === 0 ? '#d7f59165' : '#c9b5fa40';
      ctx.beginPath(); ctx.arc(a.x, a.y, i % 3 === 0 ? 2 : 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  function animateContact(now) {
    frame = 0;
    if (!visible || !hasMotion() || document.hidden) return;
    if (now - lastFrame > 40) { time += .025; lastFrame = now; drawContact(); }
    frame = requestAnimationFrame(animateContact);
  }
  function syncContact() {
    cancelAnimationFrame(frame); frame = 0;
    if (visible && hasMotion() && !document.hidden && ctx) frame = requestAnimationFrame(animateContact);
    else drawContact();
  }
  function resizeCanvas() {
    if (!ctx) return;
    const rect = contact.getBoundingClientRect(); width = rect.width; height = rect.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawContact();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(contact);
  else addEventListener('resize', resizeCanvas);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; syncContact(); }, { rootMargin: '100px' }).observe(contact);
  } else { visible = true; }
  contact.addEventListener('pointermove', event => {
    if (!hasMotion()) return;
    const rect = contact.getBoundingClientRect(); pointer.x = (event.clientX - rect.left) / rect.width; pointer.y = (event.clientY - rect.top) / rect.height;
  }, { passive: true });
  document.addEventListener('visibilitychange', syncContact);

  function syncMotion() {
    const enabled = hasMotion();
    root.classList.toggle('motion-paused', !enabled);
    motionButton.setAttribute('aria-pressed', String(enabled));
    motionButton.textContent = enabled ? 'Pausar movimento' : 'Ativar movimento';
    motionButton.disabled = systemReduced;
    motionButton.title = systemReduced ? 'O dispositivo está configurado para reduzir o movimento.' : '';
    if (!enabled) {
      activeAnimations.forEach(animation => animation.cancel());
      dot.classList.remove('is-visible');
      document.querySelectorAll('.magnetic').forEach(button => button.style.removeProperty('translate'));
      document.querySelectorAll('[data-tilt]').forEach(card => { card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y'); });
      art.style.removeProperty('--art-turn');
    }
    updateScroll(); syncContact();
  }
  motionButton.addEventListener('click', () => {
    userMotion = !userMotion;
    try { localStorage.setItem('adjelson-effects', userMotion ? 'on' : 'off'); } catch { /* Optional persistence. */ }
    syncMotion();
  });
  mediaMotion.addEventListener('change', event => { systemReduced = event.matches; syncMotion(); });
  resizeCanvas(); syncMotion();
})();
