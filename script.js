/* SONAIR ONE — interacciones (vanilla JS, sin dependencias) */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------- Navegación ---------------- */
  const nav = $("[data-nav]");
  const toggle = $("[data-nav-toggle]");
  const navLinks = $("#nav-links");

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  }
  toggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  navLinks.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
  });
  window.addEventListener("resize", () => { if (window.innerWidth > 960) setMenu(false); });

  // Sección activa
  const linkMap = new Map($$("[data-navlink]").map((a) => [a.getAttribute("href").slice(1), a]));
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const link = linkMap.get(entry.target.id);
      if (!link) return;
      if (entry.isIntersecting) {
        linkMap.forEach((l) => l.classList.remove("is-active"));
        link.classList.add("is-active");
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  linkMap.forEach((_, id) => { const s = document.getElementById(id); if (s) sectionObserver.observe(s); });

  /* ---------------- Reveal ---------------- */
  const revealEls = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const ro = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); ro.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revealEls.forEach((el) => ro.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------------- Adaptive Silence ---------------- */
  const silence = $("#silencio");
  const modeButtons = $$("[data-mode]");
  const envButtons = $$("[data-env]");
  const readout = $("[data-readout]");
  const touch = $("[data-touch]");
  const touchHint = $("[data-touch-hint]");
  const canvas = $("[data-scope]");
  const ctx = canvas.getContext("2d");

  const ENV = {
    office: { name: "la oficina",   de: "de la oficina",   label: "Oficina",   level: 0.42, auto: "soft" },
    cowork: { name: "el coworking", de: "del coworking", label: "Coworking", level: 0.62, auto: "soft" },
    train:  { name: "el tren",      de: "del tren",      label: "Tren",      level: 0.82, auto: "strong" },
    flight: { name: "el vuelo",     de: "del vuelo",     label: "Vuelo",     level: 0.95, auto: "strong" },
  };
  // Proporción del entorno que llega al oído en cada modo (ilustrativo)
  const PASS = { strong: 0.08, soft: 0.38, transparency: 0.95 };
  const MODE_NAME = { auto: "Automático", strong: "Fuerte", soft: "Suave", transparency: "Transparencia" };

  const state = { mode: "auto", env: "cowork", prevMode: "auto" };
  let pass = PASS.soft;              // valor animado
  let envLevel = ENV.cowork.level;   // valor animado

  const effectiveMode = () => (state.mode === "auto" ? ENV[state.env].auto : state.mode);

  function renderReadout() {
    const env = ENV[state.env];
    const eff = effectiveMode();
    let html;
    switch (state.mode) {
      case "auto":
        html = `<strong>Automático</strong> · En ${env.name}, la cancelación se ajusta a <strong>${MODE_NAME[eff].toLowerCase()}</strong>. Cambia de entorno y el nivel se adapta en tiempo real.`;
        break;
      case "strong":
        html = `<strong>Fuerte</strong> · Cancelación intensa para reducir el ruido ${env.de}.`;
        break;
      case "soft":
        html = `<strong>Suave</strong> · Menos ruido ${env.de}, sin sensación de aislamiento total.`;
        break;
      default:
        html = `<strong>Transparencia</strong> · El entorno vuelve a entrar, con detección de voz. Toca el auricular de nuevo para recuperar el foco.`;
    }
    readout.innerHTML = html;
  }

  function setChecked(buttons, attr, value) {
    buttons.forEach((b) => {
      const on = b.dataset[attr] === value;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  function update() {
    setChecked(modeButtons, "mode", state.mode);
    setChecked(envButtons, "env", state.env);
    silence.dataset.activeMode = state.mode;
    silence.dataset.modeEffective = effectiveMode();
    const isT = state.mode === "transparency";
    touch.setAttribute("aria-pressed", String(isT));
    touchHint.textContent = isT
      ? `Toca de nuevo para volver a ${MODE_NAME[state.prevMode].toLowerCase()}`
      : "Toca el auricular para volver al entorno";
    renderReadout();
    if (reduceMotion.matches || !scopeVisible) snapAndDraw();
  }

  function setMode(mode) {
    if (mode !== "transparency") state.prevMode = mode;
    state.mode = mode;
    update();
  }

  modeButtons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  envButtons.forEach((b) => b.addEventListener("click", () => { state.env = b.dataset.env; update(); }));

  // Navegación con flechas en los radiogroups
  function arrowNav(buttons, onPick) {
    buttons.forEach((b, i) => b.addEventListener("keydown", (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const next = buttons[(i + dir + buttons.length) % buttons.length];
      next.focus();
      onPick(next);
    }));
  }
  arrowNav(modeButtons, (b) => setMode(b.dataset.mode));
  arrowNav(envButtons, (b) => { state.env = b.dataset.env; update(); });

  touch.addEventListener("click", () => {
    if (state.mode === "transparency") setMode(state.prevMode);
    else setMode("transparency");
  });

  // Osciloscopio
  let W = 0, H = 0, dpr = 1;
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function noise(x, t, seed) {
    return (
      Math.sin(x * 0.045 + t * 1.9 + seed) * 0.46 +
      Math.sin(x * 0.11 - t * 3.1 + seed * 2) * 0.28 +
      Math.sin(x * 0.29 + t * 5.3) * 0.16 +
      Math.sin(x * 0.63 - t * 7.7 + seed) * 0.10
    );
  }

  function draw(t) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    const mid = H / 2;
    const amp = H * 0.42;
    const isT = state.mode === "transparency";

    // Línea base
    ctx.strokeStyle = "rgba(247,247,250,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();

    // Entorno
    ctx.strokeStyle = "rgba(164,168,181,0.45)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      const y = mid + noise(x, t, 1.3) * amp * envLevel;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Lo que llega al oído
    ctx.strokeStyle = "#8B5CF6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 2) {
      let v = noise(x, t, 1.3) * envLevel * pass;
      if (isT) {
        // detección de voz: una envolvente de voz más clara sobre el entorno
        const env = Math.max(0, Math.sin(x * 0.012 - t * 0.9)) ** 2;
        v += Math.sin(x * 0.22 - t * 6) * 0.22 * env;
      }
      const y = mid + v * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function targets() {
    return { p: PASS[effectiveMode()], e: ENV[state.env].level };
  }
  function snapAndDraw() {
    const tg = targets();
    pass = tg.p; envLevel = tg.e;
    draw(0.8);
  }

  let scopeVisible = false;
  let rafId = 0;
  let last = performance.now();
  let clock = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    const tg = targets();
    const k = 1 - Math.pow(0.001, dt * 1.8); // aproximación suave (~550 ms)
    pass += (tg.p - pass) * k;
    envLevel += (tg.e - envLevel) * k;
    draw(clock);
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (rafId || reduceMotion.matches) return;
    last = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function stop() { cancelAnimationFrame(rafId); rafId = 0; }

  new IntersectionObserver((entries) => {
    scopeVisible = entries[0].isIntersecting;
    scopeVisible ? start() : stop();
  }).observe(canvas);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resizeCanvas(); if (!rafId) snapAndDraw(); }, 120);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop(); else if (scopeVisible) start();
  });

  resizeCanvas();
  update();
  snapAndDraw();

  /* ---------------- Calculadora de batería ---------------- */
  const hours = $("[data-hours]");
  const hoursOut = $("[data-hours-out]");
  const ancButtons = $$("[data-anc]");
  const result = $("[data-calc-result]");
  const figure = $("[data-battery-figure]");
  let anc = "on";
  const fmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

  function renderCalc() {
    const h = Number(hours.value);
    const total = anc === "on" ? 32 : 46;
    const days = total / h;
    hoursOut.textContent = `${h} h`;
    hours.style.setProperty("--p", `${((h - hours.min) / (hours.max - hours.min)) * 100}%`);
    figure.textContent = total;
    const n = fmt.format(Math.floor(days * 10) / 10);
    result.innerHTML = `≈ ${n} ${days >= 1 && days < 2 && n === "1" ? "jornada" : "jornadas"} de ${h} h entre cargas <span>· ${anc === "on" ? "con" : "sin"} ANC</span>`;
    ancButtons.forEach((b) => {
      const on = b.dataset.anc === anc;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }
  hours.addEventListener("input", renderCalc);
  ancButtons.forEach((b) => b.addEventListener("click", () => { anc = b.dataset.anc; renderCalc(); }));
  arrowNav(ancButtons, (b) => { anc = b.dataset.anc; renderCalc(); });
  renderCalc();

  /* ---------------- Compra ---------------- */
  const dialog = $("[data-order]");
  const status = $("[data-order-status]");
  const checkout = $("[data-checkout]");

  function openOrder() {
    status.textContent = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  $$("[data-buy]").forEach((b) => b.addEventListener("click", openOrder));
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  checkout.addEventListener("click", () => {
    status.textContent = "Página de demostración: el pago no está conectado.";
  });

  /* ---------------- Barra de compra (móvil) ---------------- */
  const buybar = $("[data-buybar]");
  const buybarLink = $("a", buybar);
  const hero = $(".hero");
  const offer = $("#comprar");
  let heroVisible = true, offerVisible = false;
  function setBuybar() {
    const show = !heroVisible && !offerVisible;
    buybar.classList.toggle("is-visible", show);
    buybar.setAttribute("aria-hidden", String(!show));
    buybarLink.tabIndex = show ? 0 : -1;
  }
  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; setBuybar(); }, { threshold: 0.05 }).observe(hero);
  new IntersectionObserver(([e]) => { offerVisible = e.isIntersecting; setBuybar(); }, { threshold: 0.1 }).observe(offer);
})();
