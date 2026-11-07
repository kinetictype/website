/* Variable proximity: letters near the pointer grow bolder (font-variation-settings), easing back as it moves away.
   Plain-JavaScript port of the VariableProximity component from React Bits (reactbits.dev, MIT licence) for this static site.
   Applies to every element with a data-variable-proximity attribute. Settings follow the component's usage example. */
(() => {
  const GAUSSIAN_EDGE = Math.exp(-2);
  const WAVE_PERIOD = 3.2;
  const WAVE_PEAK = 0.7;

  const parseSettings = settings =>
    new Map(
      settings
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
          const [name, value] = part.split(/\s+/);
          return [name.replace(/['"]/g, ''), parseFloat(value)];
        })
    );

  const strengthAt = (distance, radius, falloff) => {
    if (distance >= radius) return 0;
    const norm = 1 - distance / radius;
    switch (falloff) {
      case 'exponential':
        return norm * norm;
      case 'gaussian':
        return (Math.exp(-2 * (distance / radius) ** 2) - GAUSSIAN_EDGE) / (1 - GAUSSIAN_EDGE);
      case 'linear':
      default:
        return norm;
    }
  };

  function variableProximity(root, options = {}) {
    const {
      fromFontVariationSettings = "'wght' 400, 'opsz' 9",
      toFontVariationSettings = "'wght' 1000, 'opsz' 40",
      radius = 100,
      falloff = 'linear',
      smoothing = 0.2,
      fromColor,
      toColor,
      scale = 1,
      lift = 0,
      idleWave = false
    } = options;

    // Build the letters from the element's text; lines the author broke on purpose (<br>) are kept.
    const label = root.textContent.replace(/\s+/g, ' ').trim();
    const authorBreaks = [];
    {
      let count = 0;
      root.childNodes.forEach(node => {
        if (node.nodeType === 3) count += node.textContent.trim().split(/\s+/).filter(Boolean).length;
        else if (node.nodeName === 'BR') authorBreaks.push({ at: count, className: node.className });
        else count += node.textContent.trim().split(/\s+/).filter(Boolean).length;
      });
    }
    root.classList.add('variable-proximity');
    root.setAttribute('aria-label', label);
    root.textContent = '';
    const letters = [];
    const words = [];
    label.split(' ').forEach((word, wordIndex, all) => {
      const brk = authorBreaks.find(b => b.at === wordIndex && wordIndex > 0);
      if (brk) {
        const br = document.createElement('br');
        if (brk.className) br.className = brk.className;
        br.dataset.author = '';
        root.appendChild(br);
      }
      const w = document.createElement('span');
      w.dataset.word = '';
      w.style.display = 'inline-block';
      w.style.whiteSpace = 'nowrap';
      w.setAttribute('aria-hidden', 'true');
      [...word].forEach(ch => {
        const l = document.createElement('span');
        l.textContent = ch;
        l.style.display = 'inline-block';
        l.style.fontVariationSettings = fromFontVariationSettings;
        l.style.transformOrigin = '50% 80%';
        if (fromColor) l.style.color = fromColor;
        w.appendChild(l);
        letters.push(l);
      });
      if (wordIndex < all.length - 1) {
        const sp = document.createElement('span');
        sp.style.display = 'inline-block';
        sp.innerHTML = '&nbsp;';
        w.appendChild(sp);
      }
      root.appendChild(w);
      words.push(w);
    });

    // Lock the line breaks measured at rest, so letters getting bolder never make words jump to another line.
    let lastWidth = -1;
    let lineFrame = 0;
    const measureLines = () => {
      lineFrame = 0;
      root.querySelectorAll('br[data-auto]').forEach(br => br.remove());
      const saved = letters.map(l => l.style.fontVariationSettings);
      root.style.whiteSpace = 'normal';
      letters.forEach(l => (l.style.fontVariationSettings = fromFontVariationSettings));
      const starts = [];
      let lastTop = null;
      words.forEach((word, index) => {
        const top = word.getBoundingClientRect().top;
        if (lastTop !== null && top > lastTop + 2) starts.push(index);
        lastTop = top;
      });
      letters.forEach((l, i) => (l.style.fontVariationSettings = saved[i]));
      starts.forEach(index => {
        const prev = words[index].previousSibling;
        if (prev && prev.nodeName === 'BR' && getComputedStyle(prev).display !== 'none') return;
        const br = document.createElement('br');
        br.dataset.auto = '';
        root.insertBefore(br, words[index]);
      });
      root.style.whiteSpace = 'nowrap';
      relayout();
    };
    const queueLines = entries => {
      const width = entries?.[0]?.contentRect.width;
      if (width !== undefined) {
        if (Math.abs(width - lastWidth) < 1) return;
        lastWidth = width;
      }
      if (!lineFrame) lineFrame = requestAnimationFrame(measureLines);
    };

    const axes = (() => {
      const fromSettings = parseSettings(fromFontVariationSettings);
      const toSettings = parseSettings(toFontVariationSettings);
      return Array.from(fromSettings.entries()).map(([axis, fromValue]) => ({
        axis,
        fromValue,
        toValue: toSettings.get(axis) ?? fromValue
      }));
    })();

    const pointer = { x: 0, y: 0, active: false };
    const levels = [];
    const targets = [];
    const written = [];
    const painted = [];
    const moved = [];
    const anchors = [];
    const tinted = Boolean(fromColor || toColor);
    const restColor = fromColor || 'currentColor';
    const nearColor = toColor || 'currentColor';
    const growth = (Number(scale) || 1) - 1;
    const rise = Number(lift) || 0;
    const transformed = growth !== 0 || rise !== 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const waving = idleWave && !reduced;
    let frame = 0;
    let lastTime = 0;
    let dirty = true;
    let layoutDirty = true;
    let nearAny = false;
    let lastNear = -Infinity;
    let waveMix = 0;
    let span = 1;
    let visible = true;

    const settingsAt = level =>
      axes.map(({ axis, fromValue, toValue }) => `'${axis}' ${fromValue + (toValue - fromValue) * level}`).join(', ');

    const measureAnchors = () => {
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      letters.forEach((letter, index) => {
        const rect = letter.getBoundingClientRect();
        anchors[index] = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        left = Math.min(left, rect.left);
        top = Math.min(top, rect.top);
        right = Math.max(right, rect.right);
      });
      anchors.forEach(anchor => {
        anchor.x -= left;
        anchor.y -= top;
      });
      span = Math.max(220, (right - left) * 0.85);
    };

    const measure = () => {
      targets.length = letters.length;
      targets.fill(0);
      nearAny = false;
      if (!pointer.active) return;
      const area = root.getBoundingClientRect();
      const dx = Math.max(area.left - pointer.x, 0, pointer.x - area.right);
      const dy = Math.max(area.top - pointer.y, 0, pointer.y - area.bottom);
      if (dx * dx + dy * dy >= radius * radius) return;
      letters.forEach((letter, index) => {
        const rect = letter.getBoundingClientRect();
        const distance = Math.hypot(pointer.x - (rect.left + rect.width / 2), pointer.y - (rect.top + rect.height / 2));
        targets[index] = strengthAt(distance, radius, falloff);
        if (targets[index] > 0) nearAny = true;
      });
    };

    const waveAt = (index, time) => {
      const anchor = anchors[index];
      if (!anchor) return 0;
      const phase = ((anchor.x + anchor.y * 0.6) / span - time / WAVE_PERIOD) * Math.PI * 2;
      return WAVE_PEAK * ((1 + Math.cos(phase)) / 2) ** 2.2;
    };

    const tick = now => {
      frame = 0;
      const delta = lastTime ? Math.min(now - lastTime, 64) : 16;
      lastTime = now;
      if (dirty) {
        measure();
        dirty = false;
      }
      if (waving && layoutDirty) {
        measureAnchors();
        layoutDirty = false;
      }
      if (nearAny) lastNear = now;
      const idle = waving && visible && !nearAny && now - lastNear > 500;
      const goal = idle ? 1 : 0;
      waveMix += (goal - waveMix) * (1 - Math.exp(-delta / 600));
      if (Math.abs(goal - waveMix) < 0.002) waveMix = goal;
      const ease = smoothing > 0 ? 1 - Math.exp(-delta / (smoothing * 400)) : 1;
      const time = now / 1000;
      let settling = false;
      letters.forEach((letter, index) => {
        let target = targets[index] ?? 0;
        if (waveMix > 0) target = Math.max(target, waveMix * waveAt(index, time));
        const current = levels[index] ?? 0;
        let next = current + (target - current) * ease;
        if (Math.abs(target - next) < 0.002) next = target;
        else settling = true;
        levels[index] = next;
        const settings = next === 0 ? fromFontVariationSettings : settingsAt(next);
        if (written[index] !== settings) {
          written[index] = settings;
          letter.style.fontVariationSettings = settings;
        }
        if (tinted) {
          const paint = next === 0 ? fromColor || '' : `color-mix(in oklab, ${restColor} ${((1 - next) * 100).toFixed(1)}%, ${nearColor})`;
          if (painted[index] !== paint) {
            painted[index] = paint;
            letter.style.color = paint;
          }
        }
        if (transformed) {
          const shift = next === 0 ? '' : `translateY(${(-rise * next).toFixed(3)}em) scale(${(1 + growth * next).toFixed(3)})`;
          if (moved[index] !== shift) {
            moved[index] = shift;
            letter.style.transform = shift;
          }
        }
      });
      if (settling || waveMix > 0 || (waving && visible && !nearAny)) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    };

    const schedule = () => {
      dirty = true;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    function relayout() {
      layoutDirty = true;
      schedule();
    }
    const handleMove = (x, y) => {
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
      schedule();
    };
    const handleLeave = () => {
      pointer.active = false;
      schedule();
    };

    window.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) handleMove(t.clientX, t.clientY); }, { passive: true });
    window.addEventListener('touchend', handleLeave);
    window.addEventListener('touchcancel', handleLeave);
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', relayout);
    document.documentElement.addEventListener('mouseleave', handleLeave);
    if (waving && 'IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        schedule();
      }).observe(root);
    }

    measureLines();
    if (root.parentElement && typeof ResizeObserver !== 'undefined') new ResizeObserver(queueLines).observe(root.parentElement);
    document.fonts?.ready.then(() => queueLines());
    schedule();
  }

  document.querySelectorAll('[data-variable-proximity]').forEach(el => variableProximity(el));
})();
