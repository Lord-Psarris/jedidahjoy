/*
 * Main Application Script
 * Hosted on Netlify and loaded in Webflow via a script tag.
 * External libraries: GSAP, ScrollTrigger, CustomEase, SplitText, Lenis, Hls.js, Swiper
 */

// ============================================================================
// UTILITY MODULES
// ============================================================================

const DOMUtils = {
  setText(nodes, text) {
    nodes.forEach(node => {
      node.textContent = text;
    });
  },

  setAttr(el, name, val) {
    const str = typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val);
    if (el.getAttribute(name) !== str) {
      el.setAttribute(name, str);
    }
  }
};

const GSAPHelper = {
  waitForGSAP(callback, attempts = 0) {
    if (typeof gsap !== 'undefined') {
      callback();
    } else if (attempts < 50) {
      setTimeout(() => this.waitForGSAP(callback, attempts + 1), 100);
    }
  },

  waitForGSAPAndScrollTrigger(callback, attempts = 0) {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      callback();
    } else if (attempts < 50) {
      setTimeout(() => this.waitForGSAPAndScrollTrigger(callback, attempts + 1), 100);
    }
  }
};

function ensureGlobalEase() {
  if (typeof CustomEase === 'undefined' || !CustomEase?.create) return;
  if (gsap?.parseEase && gsap.parseEase('c&c')) return;
  CustomEase.create('c&c', '0.625, 0.05, 0, 1');
}

function onDomReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

/**
 * Run fn once webfonts are loaded (or immediately if already loaded / unsupported).
 * Splitting text before fonts swap in forces a second split + full reflow, so all
 * SplitText work is gated on this.
 */
function whenFontsReady(fn) {
  if (document.fonts?.status === 'loaded') {
    fn();
  } else if (document.fonts?.ready) {
    document.fonts.ready.then(fn);
  } else {
    fn();
  }
}

/**
 * Lazily initialize elements when they approach the viewport.
 * Returns a disconnect function for teardown on page transitions.
 * Keeps SplitText / Swiper layout measurement out of the initial load
 * for everything below the fold.
 */
function observeOnce(elements, callback, rootMargin = '400px 0px') {
  const list = Array.from(elements);
  if (!list.length) return () => {};

  if (typeof IntersectionObserver === 'undefined') {
    list.forEach(callback);
    return () => {};
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      callback(entry.target);
    });
  }, { rootMargin });

  list.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

// ============================================================================
// PAGE TRANSITION (OVERLAY + FETCH SWAP)
// ============================================================================

const TransitionOverlay = (() => {
  const FADE_MS = 300;
  const CONTAINER_SELECTOR = '[data-barba="container"]';
  const STYLE_ID = 'transition-overlay-styles';

  let overlay = null;
  let initialized = false;
  let navigating = false;
  const prefetchCache = new Map();
  const prefetchInFlight = new Map();

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .transition-fade_component {
        transition: opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function resolveUrl(href) {
    try {
      return new URL(href, window.location.href);
    } catch {
      return null;
    }
  }

  function cacheKey(url) {
    return url.origin + url.pathname + url.search;
  }

  function getLinkFromEvent(event) {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    return target.closest('a[href]');
  }

  function isNavigableLink(link) {
    if (!link || link.dataset.transition === 'false') return null;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
    if (link.getAttribute('target') === '_blank' || link.hasAttribute('download')) return null;

    const url = resolveUrl(href);
    if (!url || url.origin !== window.location.origin) return null;

    return url;
  }

  function showOverlay() {
    overlay?.classList.remove('transition-fade_component--hidden');
  }

  function hideOverlay() {
    overlay?.classList.add('transition-fade_component--hidden');
  }

  function prefetch(url) {
    const key = cacheKey(url);
    if (prefetchCache.has(key)) return prefetchInFlight.get(key) || Promise.resolve(prefetchCache.get(key));

    if (prefetchInFlight.has(key)) return prefetchInFlight.get(key);

    const request = fetch(key, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Prefetch failed (${response.status})`);
        return response.text();
      })
      .then((html) => {
        prefetchCache.set(key, html);
        prefetchInFlight.delete(key);
        return html;
      })
      .catch(() => {
        prefetchInFlight.delete(key);
        return null;
      });

    prefetchInFlight.set(key, request);
    return request;
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function syncDocumentMeta(doc, url) {
    document.title = doc.title;

    const wfPage = doc.documentElement.getAttribute('data-wf-page');
    if (wfPage) document.documentElement.setAttribute('data-wf-page', wfPage);

    const nextCanonical = doc.querySelector('link[rel="canonical"]');
    const currentCanonical = document.querySelector('link[rel="canonical"]');
    if (nextCanonical?.href && currentCanonical) currentCanonical.href = nextCanonical.href;

    document.querySelectorAll('a[aria-current="page"], a.w--current').forEach((link) => {
      link.removeAttribute('aria-current');
      link.classList.remove('w--current');
    });

    const path = url.pathname;
    document.querySelectorAll('a[href]').forEach((link) => {
      const linkUrl = isNavigableLink(link);
      if (!linkUrl) return;
      if (linkUrl.pathname === path && !linkUrl.hash) {
        link.setAttribute('aria-current', 'page');
        link.classList.add('w--current');
      }
    });
  }

  function reinitWebflow() {
    if (!window.Webflow) return;
    if (typeof window.Webflow.destroy === 'function') window.Webflow.destroy();
    if (typeof window.Webflow.ready === 'function') window.Webflow.ready();
  }

  async function loadPage(url) {
    const key = cacheKey(url);
    const cached = prefetchCache.get(key);
    if (cached) return cached;

    const inflight = prefetchInFlight.get(key);
    if (inflight) {
      const html = await inflight;
      if (html) return html;
    }

    const response = await fetch(key, {
      credentials: 'same-origin',
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) throw new Error(`Navigation failed (${response.status})`);

    const html = await response.text();
    prefetchCache.set(key, html);
    return html;
  }

  async function swapPage(url, { push = true } = {}) {
    const currentContainer = document.querySelector(CONTAINER_SELECTOR);
    if (!currentContainer) throw new Error('Missing page container');

    showOverlay();
    const [html] = await Promise.all([loadPage(url), wait(FADE_MS)]);

    const doc = parseHtml(html);
    const nextContainer = doc.querySelector(CONTAINER_SELECTOR);
    if (!nextContainer) throw new Error('Missing container in response');

    App.teardownContainer(currentContainer);

    [...nextContainer.attributes].forEach((attr) => {
      currentContainer.setAttribute(attr.name, attr.value);
    });
    currentContainer.innerHTML = nextContainer.innerHTML;

    syncDocumentMeta(doc, url);

    if (push) {
      history.pushState({ pageTransition: true }, '', url.pathname + url.search + url.hash);
    }

    SmoothScroll.scrollToTop();
    reinitWebflow();
    App.refreshAfterSwap();

    await wait(FADE_MS);
    hideOverlay();
  }

  async function navigateTo(url, options = {}) {
    await swapPage(url, options);
  }

  function onPrefetch(event) {
    const link = getLinkFromEvent(event);
    if (!link) return;

    const url = isNavigableLink(link);
    if (!url || cacheKey(url) === cacheKey(resolveUrl(window.location.href))) return;

    prefetch(url);
  }

  async function onClick(event) {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    const link = getLinkFromEvent(event);
    if (!link) return;

    const url = isNavigableLink(link);
    if (!url) return;

    const current = resolveUrl(window.location.href);
    if (url.pathname === current.pathname && url.search === current.search && !url.hash) return;

    event.preventDefault();
    if (navigating) return;

    navigating = true;
    try {
      await navigateTo(url, { push: true });
    } catch {
      window.location.href = url.href;
    } finally {
      navigating = false;
    }
  }

  async function onPopState() {
    if (navigating) return;

    navigating = true;
    try {
      await navigateTo(resolveUrl(window.location.href), { push: false });
    } catch {
      window.location.reload();
    } finally {
      navigating = false;
    }
  }

  function bindEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('mouseover', onPrefetch, { passive: true });
    document.addEventListener('focusin', onPrefetch);
    document.addEventListener('touchstart', onPrefetch, { passive: true });
    window.addEventListener('popstate', onPopState);
  }

  function init() {
    if (initialized) return;
    overlay = document.querySelector('.transition-fade_component');
    if (!overlay) return;

    initialized = true;
    ensureStyles();
    bindEvents();

    if (!history.state?.pageTransition) {
      history.replaceState({ pageTransition: true }, '', window.location.href);
    }

    requestAnimationFrame(() => {
      hideOverlay();
    });
  }

  return { init };
})();

onDomReady(() => TransitionOverlay.init());

// ============================================================================
// SCROLL & SMOOTH SCROLL
// ============================================================================

const SmoothScroll = {
  _lenis: null,

  init() {
    if (typeof Lenis === 'undefined' || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    const root = document.documentElement;
    const parse = (val, fallback) => {
      const num = parseFloat(val);
      return Number.isFinite(num) ? num : fallback;
    };

    const lenis = new Lenis({
      duration: parse(root.dataset.lenisDuration, 1.2),
      lerp: parse(root.dataset.lenisLerp, 0.08),
      smoothWheel: root.dataset.lenisSmoothWheel !== 'false',
      smoothTouch: root.dataset.lenisSmoothTouch === 'true',
      wheelMultiplier: parse(root.dataset.lenisWheelMultiplier, 1),
      touchMultiplier: parse(root.dataset.lenisTouchMultiplier, 1.5)
    });

    this._lenis = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);
  },

  scrollToTop() {
    if (this._lenis) {
      this._lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh(true);
  }
};

const ScrollStateClass = {
  init() {
    let scrolled = false;

    const onScroll = () => {
      const isScrolled = window.scrollY > 4;
      if (isScrolled === scrolled) return;
      scrolled = isScrolled;
      document.body.classList.toggle('is-scrolled', scrolled);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
};

const HyphenReplacement = {
  init() {
    document.querySelectorAll('[data-hyphen]').forEach(el => {
      const char = el.dataset.hyphenChar || '|';
      el.innerHTML = el.innerHTML.split(char).join('&shy;');
    });
  }
};

// ============================================================================
// NAVIGATION MODULES
// ============================================================================

const NavBannerControls = {
  preInit() {
    if (sessionStorage.getItem('hide-nav-banner') === 'true') {
      document.documentElement.classList.add('hide-nav-banner');
    }
  },

  init() {
    // Close banner
    document.querySelectorAll('.nav_banner_close_wrap').forEach((button) => {
      button.addEventListener('click', () => {
        sessionStorage.setItem('hide-nav-banner', 'true');
        document.documentElement.classList.add('hide-nav-banner');
      });
    });

    // Skip to main
    document.querySelectorAll('.nav_skip_wrap').forEach((link) => {
      const target = document.querySelector('main');
      if (!target) return;
      link.addEventListener('click', () => {
        target.setAttribute('tabindex', '-1');
        target.focus();
      });
    });
  }
};

// Pre-initialize to avoid flash
NavBannerControls.preInit();

const NavHideOnScroll = {
  init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('.nav_component').forEach((component) => {
      if (component.hasAttribute('data-nav')) return;
      component.setAttribute('data-nav', '');

      let lastDirection;
      ScrollTrigger.create({
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          if (lastDirection === self.direction) return;
          lastDirection = self.direction;
          component.classList.toggle('is-hidden', self.direction === 1);
        }
      });
    });
  }
};

const NavDropdownTheme = {
  init() {
    const nav = document.querySelector('.nav_component');
    if (!nav) return;
    const navBg = nav.querySelector('.nav_bg');
    const hasStaticLock = nav.getAttribute('data-theme-lock') === 'true';

    if (hasStaticLock) {
      if (!nav.getAttribute('data-theme')) {
        nav.setAttribute('data-theme', 'dark');
      }
      return;
    }

    let previousTheme = null;
    let hoverActive = false;
    let menuActive = false;

    const applyThemeLock = () => {
      if (menuActive) {
        if (previousTheme === null) {
          previousTheme = nav.getAttribute('data-theme');
        }
        nav.setAttribute('data-theme-lock', 'true');
        nav.setAttribute('data-theme', 'dark');
        nav.style.background = 'none';
        if (navBg) navBg.style.display = 'none';
        return;
      }
      if (hoverActive) {
        if (previousTheme === null) {
          previousTheme = nav.getAttribute('data-theme');
        }
        nav.setAttribute('data-theme-lock', 'true');
        nav.setAttribute('data-theme', 'dark');
        return;
      }
      nav.style.background = '';
      if (navBg) navBg.style.display = '';
      if (previousTheme === null) {
        nav.removeAttribute('data-theme');
      } else {
        nav.setAttribute('data-theme', previousTheme);
      }
      previousTheme = null;
      nav.removeAttribute('data-theme-lock');
      window.dispatchEvent(new Event('scroll'));
    };

    document.querySelectorAll('.nav_dropdown_component').forEach((dropdown) => {
      dropdown.addEventListener('mouseenter', () => {
        hoverActive = true;
        applyThemeLock();
      });
      dropdown.addEventListener('mouseleave', () => {
        hoverActive = false;
        applyThemeLock();
      });
    });

    const openButtons = new Set();
    const updateMenuLock = () => {
      menuActive = openButtons.size > 0;
      applyThemeLock();
    };

    document.querySelectorAll('.nav_button_wrap.w-nav-button, .nav_button_wrap .w-nav-button').forEach((button) => {
      const sync = () => {
        if (button.classList.contains('w--open')) openButtons.add(button);
        else openButtons.delete(button);
        updateMenuLock();
      };

      sync();
      const observer = new MutationObserver(sync);
      observer.observe(button, { attributes: true, attributeFilter: ['class'] });
    });
  }
};

const NavDropdownOverlay = {
  init() {
    const navComponent = document.querySelector(".nav_component");
    const dropdownDark = document.querySelector(".nav_dropdown_dark");
    const dropdownItems = document.querySelectorAll("[data-nav-item][data-dropdown]");
    const overlay = document.querySelector("[data-dropdown-overlay]");
    const dropdownContents = document.querySelectorAll("[data-dropdown-content]");

    if (!overlay || !dropdownItems.length) return;

    let activeDropdown = null;
    let closeTimeout = null;
    let transitionTimeout = null;
    const CLOSE_DELAY = 150;

    function openDropdown(dropdownId) {
      clearTimeout(closeTimeout);
      clearTimeout(transitionTimeout);

      if (navComponent) {
        navComponent.style.color = "var(--swatch--dark-900)";
        navComponent.style.backgroundColor = "transparent";
      }

      overlay.classList.add("nav__dropdown-overlay--visible");

      if (dropdownDark) {
        dropdownDark.classList.add("nav_dropdown_dark--visible");
      }

      dropdownContents.forEach(function (content) {
        if (content.getAttribute("data-dropdown-content") === dropdownId) {
          content.classList.add("nav__dropdown-content--visible");
        } else {
          content.classList.remove("nav__dropdown-content--visible");
        }
      });

      activeDropdown = dropdownId;
    }

    function closeDropdown() {
      overlay.classList.remove("nav__dropdown-overlay--visible");

      if (dropdownDark) {
        dropdownDark.classList.remove("nav_dropdown_dark--visible");
      }

      activeDropdown = null;

      clearTimeout(transitionTimeout);
      transitionTimeout = setTimeout(function () {
        dropdownContents.forEach(function (content) {
          content.classList.remove("nav__dropdown-content--visible");
        });

        if (navComponent) {
          navComponent.style.color = "";
          navComponent.style.backgroundColor = "";
        }
      }, 450);
    }

    function scheduleClose() {
      closeTimeout = setTimeout(function () {
        closeDropdown();
      }, CLOSE_DELAY);
    }

    dropdownItems.forEach(function (item) {
      var dropdownId = item.getAttribute("data-dropdown");

      item.addEventListener("mouseenter", function () {
        openDropdown(dropdownId);
      });

      item.addEventListener("mouseleave", function () {
        scheduleClose();
      });
    });

    overlay.addEventListener("mouseenter", function () {
      clearTimeout(closeTimeout);
    });

    overlay.addEventListener("mouseleave", function () {
      closeDropdown();
    });

    document.querySelectorAll("[data-nav-item]:not([data-dropdown])").forEach(function (item) {
      item.addEventListener("mouseenter", function () {
        clearTimeout(closeTimeout);
        closeDropdown();
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && activeDropdown) {
        closeDropdown();
      }
    });

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        closeDropdown();
      }
    });
  }
};

const NavThemeScroll = {
  init() {
    const nav = document.querySelector(".nav_component");
    if (!nav) return;

    const themeScroll = nav.getAttribute("data-theme-scroll");
    if (themeScroll !== "true" && themeScroll !== "false") return;

    if (nav.getAttribute('data-theme-lock') === 'true') {
      if (!nav.getAttribute('data-theme')) {
        nav.setAttribute('data-theme', 'dark');
      }
      return;
    }

    const enableThemeScroll = themeScroll === "true";
    const enableBorderToggleTrue = themeScroll === "true";

    if (nav.dataset.themeScrollInit === "true") return;
    nav.dataset.themeScrollInit = "true";

    const getThreshold = () => window.innerHeight * 2; // 200vh
    const getThresholdFalse = () => window.innerHeight * 0.8; // 80vh
    const getBorderThresholdTrue = () => window.innerHeight * 2; // 200vh

    let threshold = getThreshold();
    let thresholdFalse = getThresholdFalse();
    let borderThresholdTrue = getBorderThresholdTrue();

    const setTheme = (theme) => {
      if (nav.getAttribute("data-theme") !== theme) {
        nav.setAttribute("data-theme", theme);
      }
    };

    // Only write to the DOM when the computed state actually changes.
    // Previously nav.style.border was reassigned on every scroll frame,
    // invalidating styles ~60x/s and feeding the "Style & Layout" cost.
    let lastBorderNone = null;

    const apply = () => {
      const y = window.scrollY || window.pageYOffset || 0;

      const borderNone = enableBorderToggleTrue
        ? y < borderThresholdTrue
        : y < thresholdFalse;

      if (borderNone !== lastBorderNone) {
        lastBorderNone = borderNone;
        nav.style.border = borderNone ? "none" : "";
      }

      if (nav.getAttribute('data-theme-lock') !== 'true') {
        if (enableThemeScroll) {
          setTheme(y >= threshold ? "dark" : "light");
        } else {
          setTheme(y >= thresholdFalse ? "dark" : "light");
        }
      }
    };

    // Performant scroll with rAF throttle
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        apply();
      });
    };

    // Debounced into rAF: resize can fire in bursts, and reading innerHeight
    // between other modules' DOM writes forces synchronous layout.
    let resizeTicking = false;
    const onResize = () => {
      if (resizeTicking) return;
      resizeTicking = true;
      requestAnimationFrame(() => {
        resizeTicking = false;
        threshold = getThreshold();
        thresholdFalse = getThresholdFalse();
        borderThresholdTrue = getBorderThresholdTrue();
        apply();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    // Initial state
    if (enableThemeScroll) {
      setTheme("light");
    }
    apply();
  }
};

// ============================================================================
// HERO ANIMATIONS
// ============================================================================

const HeroAnimations = {
  initHomeOverlay() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('.hero_home_overlay').forEach(overlay => {
      const trigger = overlay.closest('.hero_home_wrap') || overlay;
      gsap.set(overlay, { opacity: 0.3 });
      gsap.fromTo(
        overlay,
        { opacity: 0.4 },
        {
          opacity: 0.6,
          ease: 'none',
          scrollTrigger: {
            trigger,
            start: 'top top',
            end: 'bottom bottom',
            scrub: true
          }
        }
      );
    });
  },

  init() {
    this.initHomeOverlay();
  }
};

const HeroHomeScrollAnimation = {
  init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('.hero_home_wrap').forEach(component => {
      const target = component.querySelector('.hero_home_mask');
      const track = component.querySelector('.hero_home_track');
      const mainBottom = component.querySelector('.hero_main_bottom');
      const clip = component.querySelector('.hero_home_clip');

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.hero_home_scroll',
          start: 'top top',
          end: 'bottom bottom',
          scrub: true
        }
      });

      if (target) {
        tl.fromTo(
          target,
          { clipPath: 'inset(0% round 0rem)' },
          { clipPath: 'inset(0.5rem round 0.75rem)' }
        );
      }

      if (track) {
        tl.to(track, { yPercent: -50, ease: 'none' }, '<');
      }

      if (mainBottom && window.matchMedia('(min-width: 768px)').matches) {
        tl.to(mainBottom, { yPercent: -400, ease: 'none' }, '<');
      }

      if (clip) {
        tl.fromTo(clip, { scale: 1.2 }, { scale: 1, ease: 'none' }, '<');
      }
    });
  }
};

const PreloaderAnimation = {
  init() {
    if (typeof gsap === 'undefined') return;

    function splitText(element) {
      const text = element.textContent || '';
      const words = text.split(' ');
      element.innerHTML = '';

      words.forEach((word, wordIndex) => {
        const wordSpan = document.createElement('span');
        wordSpan.style.display = 'inline-block';
        wordSpan.style.overflow = 'hidden';
        wordSpan.style.verticalAlign = 'top';

        word.split('').forEach((char) => {
          const charSpan = document.createElement('span');
          charSpan.className = 'hero_home_title-char';
          charSpan.textContent = char;
          charSpan.style.cssText = 'display:inline-block;opacity:0;transform:translateY(100%)';
          wordSpan.appendChild(charSpan);
        });

        element.appendChild(wordSpan);
        if (wordIndex < words.length - 1) {
          element.appendChild(document.createTextNode(' '));
        }
      });
    }

    function setupPreloaderLogoPaths() {
      const paths = [];
      document.querySelectorAll('.preloader__logo-svg').forEach((svg) => {
        svg.querySelectorAll('path').forEach((path) => {
          // Wichtig: Explizit auf 0 setzen BEVOR die Animation startet
          gsap.set(path, { autoAlpha: 0 });
          paths.push(path);
        });
      });
      return paths;
    }

    const logoPaths = setupPreloaderLogoPaths();
    const heroTitle = document.querySelector('[data-split-text]');
    if (heroTitle) splitText(heroTitle);

    ensureGlobalEase();
    const loaderEase = (gsap?.parseEase && gsap.parseEase('c&c')) ? 'c&c' : 'power3.out';

    gsap.set('.nav_component', { yPercent: -100, force3D: true });
    gsap.set('.hero_home_ui', { yPercent: 100, force3D: true, opacity: 0 });
    gsap.set('.hero_home_title-char', { y: 120, opacity: 0, rotationX: -45 });

    const tl = gsap.timeline({
      defaults: {
        ease: loaderEase,
        force3D: true
      }
    });

    tl
      .to(logoPaths, {
        autoAlpha: 1,
        duration: 1,
        stagger: {
          each: 0.04,
          ease: 'power2.inOut'
        }
      })
      .to({}, { duration: 0.4 })
      .to('.preloader__logo-group--left', {
        x: '-105vw',
        opacity: 0,
        duration: 1.6,
        ease: 'power4.inOut'
      }, 'expand')
      .to('.preloader__logo-group--right', {
        x: '105vw',
        opacity: 0,
        duration: 1.6,
        ease: 'power4.inOut'
      }, 'expand')
      .to('.preloader__image-container', {
        clipPath: 'inset(0rem round 0rem)',
        width: '100vw',
        height: '100vh',
        borderRadius: 0,
        scale: 1,
        duration: 1.6,
        ease: 'power4.inOut'
      }, 'expand')
      .to('.preloader', {
        opacity: 0,
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => {
          const preloader = document.querySelector('.preloader');
          if (preloader) {
            preloader.style.display = 'none';
            preloader.remove();
          }
        }
      }, '-=0.4')
      .to('.hero_home_title-char', {
        y: 0,
        opacity: 1,
        rotationX: 0,
        duration: 0.8,
        stagger: {
          each: 0.02,
          ease: 'power3.out'
        },
        ease: 'expo.out'
      }, '-=0.8')
      .to('.nav_component', {
        yPercent: 0,
        duration: 0.6,
        ease: 'expo.out'
      }, '-=1.4')
      .to('.hero_home_ui', {
        yPercent: 0,
        opacity: 1,
        duration: 0.6,
        ease: 'expo.out'
      }, '-=1.4');
  }
};

const HeroHomeUiVisibility = {
  init() {
    const elements = Array.from(document.querySelectorAll('.hero_home_ui'));
    if (!elements.length) return;

    // Track the last applied state: writing opacity/pointerEvents on every
    // scroll frame (even unchanged) triggered constant style recalcs and the
    // forced reflow Lighthouse attributed to this module.
    let lastVisible = null;

    const apply = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      const isVisible = y <= 10;
      if (isVisible === lastVisible) return;
      lastVisible = isVisible;
      elements.forEach(el => {
        el.style.opacity = isVisible ? '1' : '0';
        el.style.pointerEvents = isVisible ? '' : 'none';
      });
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        apply();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', apply);
    apply();
  }
};

// ============================================================================
// SCROLL REVEAL ANIMATIONS
// ============================================================================

const ContentRevealScroll = {
  init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const LINE = {
      duration: 10,
      ease: 'power2.out',
      delay: 0.08,
    };

    const ctx = gsap.context(() => {
      document.querySelectorAll('[data-reveal-group]').forEach(groupEl => {
        const groupStaggerSec = (parseFloat(groupEl.getAttribute('data-stagger')) || 80) / 1000;
        const groupDistance = groupEl.getAttribute('data-distance') || '1.5em';
        const triggerStart = groupEl.getAttribute('data-start') || 'top 85%';

        const animDuration = 1.2;
        const animEase = 'power2.out';

        const hasLineAttr = (el) => el && el.hasAttribute('data-reveal-line');

        if (prefersReduced) {
          gsap.set(groupEl, { clearProps: 'all', y: 0, autoAlpha: 1 });
          groupEl.querySelectorAll('[data-reveal-line]').forEach((el) => {
            gsap.set(el, { '--reveal-line-scale': 1, '--reveal-line-a': 1 });
          });
          return;
        }

        const directChildren = Array.from(groupEl.children).filter(el => el.nodeType === 1);
        if (!directChildren.length) {
          gsap.set(groupEl, { y: groupDistance, autoAlpha: 0 });
          if (hasLineAttr(groupEl)) gsap.set(groupEl, { '--reveal-line-scale': 0, '--reveal-line-a': 0 });

          ScrollTrigger.create({
            trigger: groupEl,
            start: triggerStart,
            once: true,
            onEnter: () => {
              const tl = gsap.timeline();

              tl.to(groupEl, {
                y: 0,
                autoAlpha: 1,
                duration: animDuration,
                ease: animEase,
                onComplete: () => {
                  if (hasLineAttr(groupEl)) {
                    gsap.set(groupEl, {
                      clearProps: 'transform,opacity,visibility',
                      '--reveal-line-scale': 1,
                      '--reveal-line-a': 1,
                    });
                  } else {
                    gsap.set(groupEl, { clearProps: 'all' });
                  }
                },
              }, 0);

              if (hasLineAttr(groupEl)) {
                tl.to(
                  groupEl,
                  {
                    '--reveal-line-scale': 1,
                    '--reveal-line-a': 1,
                    duration: LINE.duration,
                    ease: LINE.ease,
                  },
                  LINE.delay
                );
              }
            },
          });
          return;
        }

        const slots = [];
        directChildren.forEach(child => {
          const nestedGroup = child.matches('[data-reveal-group-nested]')
            ? child
            : child.querySelector(':scope [data-reveal-group-nested]');

          if (nestedGroup) {
            const includeParent =
              child.getAttribute('data-ignore') === 'false' ||
              nestedGroup.getAttribute('data-ignore') === 'false';

            slots.push({ type: 'nested', parentEl: child, nestedEl: nestedGroup, includeParent });
          } else {
            slots.push({ type: 'item', el: child });
          }
        });

        slots.forEach(slot => {
          if (slot.type === 'item') {
            const isNestedSelf = slot.el.matches('[data-reveal-group-nested]');
            const d = isNestedSelf ? groupDistance : (slot.el.getAttribute('data-distance') || groupDistance);
            gsap.set(slot.el, { y: d, autoAlpha: 0 });

            if (hasLineAttr(slot.el)) gsap.set(slot.el, { '--reveal-line-scale': 0, '--reveal-line-a': 0 });
          } else {
            if (slot.includeParent) {
              gsap.set(slot.parentEl, { y: groupDistance, autoAlpha: 0 });
              if (hasLineAttr(slot.parentEl)) gsap.set(slot.parentEl, { '--reveal-line-scale': 0, '--reveal-line-a': 0 });
            }

            const nestedD = slot.nestedEl.getAttribute('data-distance') || groupDistance;
            Array.from(slot.nestedEl.children).forEach(target => {
              gsap.set(target, { y: nestedD, autoAlpha: 0 });
              if (hasLineAttr(target)) gsap.set(target, { '--reveal-line-scale': 0, '--reveal-line-a': 0 });
            });
          }
        });

        slots.forEach(slot => {
          if (slot.type === 'nested' && slot.includeParent) {
            gsap.set(slot.parentEl, { y: groupDistance });
          }
        });

        ScrollTrigger.create({
          trigger: groupEl,
          start: triggerStart,
          once: true,
          onEnter: () => {
            const tl = gsap.timeline();

            slots.forEach((slot, slotIndex) => {
              const slotTime = slotIndex * groupStaggerSec;

              if (slot.type === 'item') {
                const el = slot.el;
                const hasLine = hasLineAttr(el);

                tl.to(
                  el,
                  {
                    y: 0,
                    autoAlpha: 1,
                    duration: animDuration,
                    ease: animEase,
                    onComplete: () => {
                      if (hasLine) {
                        gsap.set(el, {
                          clearProps: 'transform,opacity,visibility',
                          '--reveal-line-scale': 1,
                          '--reveal-line-a': 1,
                        });
                      } else {
                        gsap.set(el, { clearProps: 'all' });
                      }
                    },
                  },
                  slotTime
                );

                if (hasLine) {
                  tl.to(
                    el,
                    {
                      '--reveal-line-scale': 1,
                      '--reveal-line-a': 1,
                      duration: LINE.duration,
                      ease: LINE.ease,
                    },
                    slotTime + LINE.delay
                  );
                }
              } else {
                if (slot.includeParent) {
                  const el = slot.parentEl;
                  const hasLine = hasLineAttr(el);

                  tl.to(
                    el,
                    {
                      y: 0,
                      autoAlpha: 1,
                      duration: animDuration,
                      ease: animEase,
                      onComplete: () => {
                        if (hasLine) {
                          gsap.set(el, {
                            clearProps: 'transform,opacity,visibility',
                            '--reveal-line-scale': 1,
                            '--reveal-line-a': 1,
                          });
                        } else {
                          gsap.set(el, { clearProps: 'all' });
                        }
                      },
                    },
                    slotTime
                  );

                  if (hasLine) {
                    tl.to(
                      el,
                      {
                        '--reveal-line-scale': 1,
                        '--reveal-line-a': 1,
                        duration: LINE.duration,
                        ease: LINE.ease,
                      },
                      slotTime + LINE.delay
                    );
                  }
                }

                const nestedMs = parseFloat(slot.nestedEl.getAttribute('data-stagger'));
                const nestedStaggerSec = Number.isNaN(nestedMs)
                  ? groupStaggerSec
                  : nestedMs / 1000;

                Array.from(slot.nestedEl.children).forEach((nestedChild, nestedIndex) => {
                  const childTime = slotTime + nestedIndex * nestedStaggerSec;
                  const hasLine = hasLineAttr(nestedChild);

                  tl.to(
                    nestedChild,
                    {
                      y: 0,
                      autoAlpha: 1,
                      duration: animDuration,
                      ease: animEase,
                      onComplete: () => {
                        if (hasLine) {
                          gsap.set(nestedChild, {
                            clearProps: 'transform,opacity,visibility',
                            '--reveal-line-scale': 1,
                            '--reveal-line-a': 1,
                          });
                        } else {
                          gsap.set(nestedChild, { clearProps: 'all' });
                        }
                      },
                    },
                    childTime
                  );

                  if (hasLine) {
                    tl.to(
                      nestedChild,
                      {
                        '--reveal-line-scale': 1,
                        '--reveal-line-a': 1,
                        duration: LINE.duration,
                        ease: LINE.ease,
                      },
                      childTime + LINE.delay
                    );
                  }
                });
              }
            });
          },
        });
      });
    });

    return () => ctx.revert();
  }
};

const LineRevealScroll = {
  init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const LINE = {
      duration: 2,
      ease: 'power2.out',
      delay: 0.08,
    };

    document.querySelectorAll('[data-reveal-line]').forEach((el) => {
      if (el.dataset.revealLineInitialized) return;
      if (el.closest('[data-reveal-group]')) return;
      el.dataset.revealLineInitialized = 'true';

      if (prefersReduced) {
        gsap.set(el, { '--reveal-line-scale': 1, '--reveal-line-a': 1 });
        return;
      }

      const triggerStart = el.getAttribute('data-start') || 'top 85%';

      gsap.set(el, { '--reveal-line-scale': 0, '--reveal-line-a': 0 });

      ScrollTrigger.create({
        trigger: el,
        start: triggerStart,
        once: true,
        onEnter: () => {
          gsap.to(el, {
            '--reveal-line-scale': 1,
            '--reveal-line-a': 1,
            duration: LINE.duration,
            ease: LINE.ease,
            delay: LINE.delay,
          });
        },
      });
    });
  }
};

// ============================================================================
// TEXT ANIMATIONS
// ============================================================================

/** blockquote must not get aria-label (ARIA in HTML); SplitText 3.13+ default "auto" would add it. */
function splitTextAriaForElement(el) {
  return el.matches('blockquote, .slider_blockquote') ? 'none' : 'auto';
}

const SplitTextWordAnimation = (() => {
  let ctx = null;
  let disconnects = [];
  let generation = 0; // invalidates pending fonts.ready callbacks after destroy()

  const destroy = () => {
    generation += 1;
    disconnects.forEach((fn) => fn());
    disconnects = [];
    ctx?.revert();
    ctx = null;
    document.querySelectorAll('[data-anim-word]').forEach((el) => {
      delete el.dataset.animWordInitialized;
    });
    document.querySelectorAll('[data-anim-line]').forEach((el) => {
      delete el.dataset.animLineInitialized;
    });
  };

  const init = () => {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || typeof SplitText === 'undefined') return;

    destroy();
    gsap.registerPlugin(ScrollTrigger, SplitText);

    ctx = gsap.context(() => {
      function setup(el, mode) {
        const duration = parseFloat(el.dataset.animDuration) || 0.6;
        const stagger = parseFloat(el.dataset.animStagger) || 0.03;
        const delay = parseFloat(el.dataset.animDelay) || 0;

        if (mode === 'word') {
          const split = new SplitText(el, {
            type: 'chars',
            charsClass: 'anim-word-char',
            aria: splitTextAriaForElement(el),
          });
          gsap.set(split.chars, { y: '0.6em', opacity: 0, willChange: 'transform,opacity' });
          gsap.to(split.chars, {
            y: '0em',
            opacity: 1,
            duration,
            ease: 'power3.out',
            delay,
            stagger,
            scrollTrigger: {
              trigger: el,
              start: 'top 20%'
            }
          });
          return;
        }

        const split = new SplitText(el, {
          type: 'lines',
          linesClass: 'anim-line',
          aria: splitTextAriaForElement(el),
        });
        gsap.set(split.lines, { y: '0.6em', opacity: 0, willChange: 'transform,opacity' });
        gsap.to(split.lines, {
          y: '0em',
          opacity: 1,
          duration,
          ease: 'power3.out',
          delay,
          stagger,
          scrollTrigger: {
            trigger: el,
            start: 'top 20%'
          }
        });
      }

      // Lazy + font-gated: SplitText measures line boxes for every target,
      // which was the single largest "Style & Layout" contributor at load.
      // Each element is now split only when it approaches the viewport
      // (400px lookahead, well before its ScrollTrigger start), and never
      // before webfonts are ready (splitting on fallback fonts forces a
      // second split + reflow once the real font swaps in).
      const localGen = generation;

      const wordEls = Array.from(document.querySelectorAll('[data-anim-word]'));
      const lineEls = Array.from(document.querySelectorAll('[data-anim-line]'));

      whenFontsReady(() => {
        if (localGen !== generation || !ctx) return;

        disconnects.push(observeOnce(wordEls, (el) => {
          if (el.dataset.animWordInitialized || el.dataset.animLineInitialized) return;
          el.dataset.animWordInitialized = 'true';
          ctx.add(() => setup(el, 'word'));
        }));

        disconnects.push(observeOnce(lineEls, (el) => {
          if (el.dataset.animLineInitialized || el.dataset.animWordInitialized) return;
          el.dataset.animLineInitialized = 'true';
          ctx.add(() => setup(el, 'line'));
        }));
      });
    });
  };

  return { init, refresh: init, destroy };
})();

const SplitTextProgressAnimation = (() => {
  let ctx = null;
  let disconnect = null;
  let generation = 0;

  const destroy = () => {
    generation += 1;
    disconnect?.();
    disconnect = null;
    ctx?.revert();
    ctx = null;
    document.querySelectorAll('[data-anim-progress]').forEach((el) => {
      delete el.dataset.animProgressInitialized;
    });
  };

  const init = () => {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || typeof SplitText === 'undefined') return;

    destroy();
    gsap.registerPlugin(ScrollTrigger, SplitText);

    const setup = (component) => {
      if (component.dataset.animProgressInitialized) return;
      component.dataset.animProgressInitialized = 'true';

      const scrub = parseFloat(component.dataset.animScrub) || 1.5;
      const stagger = parseFloat(component.dataset.animStagger) || 0.6;

      const split = SplitText.create(component, {
        type: 'words',
        wordsClass: 'word',
        aria: splitTextAriaForElement(component),
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: component,
          start: 'clamp(top 85%)',
          end: 'clamp(bottom center)',
          scrub
        }
      });

      tl.fromTo(
        split.words,
        { '--sticky-teaser-progress': '0%' },
        { '--sticky-teaser-progress': '100%', stagger, ease: 'none' }
      );
    };

    ctx = gsap.context(() => {
      // Lazy + font-gated for the same reasons as SplitTextWordAnimation.
      // 400px lookahead initializes the scrubbed timeline before its
      // 'clamp(top 85%)' start is reached, so behavior is unchanged.
      const localGen = generation;
      const components = Array.from(document.querySelectorAll('[data-anim-progress]'));

      whenFontsReady(() => {
        if (localGen !== generation || !ctx) return;
        disconnect = observeOnce(components, (component) => {
          ctx.add(() => setup(component));
        });
      });
    });
  };

  return { init, refresh: init, destroy };
})();

// ============================================================================
// FORM SPAM GUARD
// ============================================================================

const FormSpamGuard = (() => {
  const MIN_SECONDS = 3;
  const CLIENT_PREFIX = 'browser-';
  let submitBound = false;

  function initForm(form) {
    if (!(form instanceof HTMLFormElement) || form.dataset.spamGuardInit === 'true') return;

    const loadedAt = Date.now();
    form.dataset.spamGuardInit = 'true';
    form.dataset.spamGuardLoadedAt = String(loadedAt);

    form.querySelectorAll('input[name="client"]').forEach((field) => {
      field.value = CLIENT_PREFIX + loadedAt;
    });
  }

  function initForms(root = document) {
    root.querySelectorAll('form').forEach(initForm);
  }

  function isBotSubmission(form) {
    const data = new FormData(form);
    const trapped = form.querySelector('input[name="fax"]') && (data.get('fax') || '').trim() !== '';

    const loadedAt = parseInt(form.dataset.spamGuardLoadedAt || '0', 10);
    const tooFast = loadedAt > 0 && (Date.now() - loadedAt) / 1000 < MIN_SECONDS;

    const clientField = form.querySelector('input[name="client"]');
    const client = (data.get('client') || '').trim();
    const invalidClient = clientField && (
      !client.startsWith(CLIENT_PREFIX) || client !== CLIENT_PREFIX + loadedAt
    );

    return trapped || tooFast || invalidClient;
  }

  function showFakeSuccess(form) {
    const wrapper = form.closest('.w-form');
    const done = wrapper?.querySelector('.w-form-done');
    const fail = wrapper?.querySelector('.w-form-fail');

    form.style.display = 'none';
    if (fail) fail.style.display = 'none';
    if (done) done.style.display = 'block';
  }

  function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.spamGuard === 'true') return;
    form.dataset.spamGuard = 'true';

    if (!isBotSubmission(form)) {
      delete form.dataset.spamGuard;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    showFakeSuccess(form);
    delete form.dataset.spamGuard;
  }

  function bindSubmit() {
    if (submitBound) return;
    submitBound = true;
    document.addEventListener('submit', onSubmit, true);
  }

  function refresh(root = document) {
    initForms(root);
  }

  function init() {
    bindSubmit();
    refresh();
  }

  return { init, refresh };
})();

// ============================================================================
// INTERACTIVE ELEMENTS
// ============================================================================

const AnimatedIconButton = (() => {
  const SELECTOR = '[data-anm-icon-button]';
  const DEFAULTS = { duration: 0.5, ease: 'power3.inOut', delay: 0 };
  const state = new Map();
  let ctx = null;
  let pollTimer = 0;

  const queries = {
    desktop: '(min-width: 992px)',
    tablet: '(min-width: 768px) and (max-width: 991px)',
    landscape: '(orientation: landscape) and (max-width: 767px)',
    mobile: '(max-width: 479px)'
  };

  const shouldDisable = (el) => 
    el.dataset.anmDisable?.split(',').some(v => 
      queries[v.trim()]?.match && matchMedia(queries[v.trim()]).matches
    );

  const setup = (el, bgs) => {
    if (state.has(el) || shouldDisable(el) || typeof gsap === 'undefined') return;

    const icon = el.querySelector('[data-anm-icon-button-icon]');
    const bg = el.querySelector('[data-anm-icon-button-bg]');
    if (!icon) return;

    const cfg = {
      duration: parseFloat(el.dataset.anmDuration) || DEFAULTS.duration,
      ease: el.dataset.anmEase || DEFAULTS.ease,
      delay: parseFloat(el.dataset.anmDelay) || DEFAULTS.delay,
      targetColor: el.dataset.anmColor
    };

    const tl = gsap.timeline({ 
      defaults: { ease: cfg.ease, duration: cfg.duration, delay: cfg.delay },
      paused: true 
    });

    if (cfg.targetColor) tl.to(el, { color: cfg.targetColor }, 0);
    if (bg) {
      bgs.push(bg);
      tl.to(bg, { scaleX: 10, scaleY: 5 }, 0);
    }

    const play = () => {
      tl.play();
      el.dispatchEvent(new CustomEvent('anm-icon-button-enter', { detail: { element: el } }));
    };

    const reverse = () => {
      tl.reverse();
      el.dispatchEvent(new CustomEvent('anm-icon-button-leave', { detail: { element: el } }));
    };

    const onClick = (e) => {
      const isSubmitInForm = (
        (el instanceof HTMLButtonElement || el instanceof HTMLInputElement) &&
        el.type === 'submit' &&
        el.form
      );
      const isLink = el.closest('a[href]') || (el instanceof HTMLAnchorElement && el.href);
      if (!isSubmitInForm && !isLink) e.preventDefault();
    };

    ['mouseenter', 'focus'].forEach(e => el.addEventListener(e, play));
    ['mouseleave', 'blur'].forEach(e => el.addEventListener(e, reverse));
    el.addEventListener('click', onClick);

    state.set(el, { tl, play, reverse, bg, icon, onClick });
  };

  const removeListeners = () => {
    state.forEach((s, el) => {
      ['mouseenter', 'focus'].forEach(e => el.removeEventListener(e, s.play));
      ['mouseleave', 'blur'].forEach(e => el.removeEventListener(e, s.reverse));
      if (s.onClick) el.removeEventListener('click', s.onClick);
    });
  };

  const destroy = () => {
    clearTimeout(pollTimer);
    pollTimer = 0;
    removeListeners();
    ctx?.revert();
    ctx = null;
    state.clear();
  };

  const init = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const elements = document.querySelectorAll(SELECTOR);
    if (!elements.length) {
      pollTimer = setTimeout(init, 500);
      return;
    }

    destroy();

    ctx = gsap.context(() => {
      const bgs = [];
      elements.forEach((el) => setup(el, bgs));
      if (bgs.length) gsap.set(bgs, { scale: 1 });
    });
  };

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => 
      state.forEach(s => s.tl?.pause().progress(0)), 250
    );
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) state.forEach(s => s.tl?.pause());
  });

  addEventListener('beforeunload', destroy);

  return { init, refresh: init, pause: () => state.forEach(s => s.tl?.pause()), resume: () => {}, destroy };
})();

const ModalSystem = {
  init() {
    const modalSystem = ((window.lumos ??= {}).modal ??= {
      list: {},
      open(id) { this.list[id]?.open?.(); },
      closeAll() { Object.values(this.list).forEach((m) => m.close?.()); },
    });

    function createModals() {
      document.querySelectorAll(".modal_dialog").forEach(function (modal) {
        if (modal.dataset.scriptInitialized) return;
        modal.dataset.scriptInitialized = "true";

        const modalId = modal.getAttribute("data-modal-target");
        const variant = modal.getAttribute("data-wf--modal--variant");
        let lastFocusedElement;

        if (typeof gsap !== "undefined") {
          gsap.context(() => {
            const q = (sel) => modal.querySelector(sel);

            ensureGlobalEase();
            const modalEase = (gsap?.parseEase && gsap.parseEase('c&c')) ? 'c&c' : 'power3.out';

            let tl = gsap.timeline({ paused: true, onReverseComplete: resetModal });

            const closeBtn = q(".modal_close");
            if (closeBtn) {
              gsap.set(closeBtn, {
                scale: 0,
                opacity: 0,
                transformOrigin: "50% 50%",
              });
            }

            if (variant === "side-panel") {
              tl.fromTo(
                q(".modal_backdrop"),
                { opacity: 0 },
                { opacity: 1, duration: 0.3, ease: modalEase }
              );
              tl.from(
                q(".modal_content"),
                { xPercent: 100, duration: 0.3, ease: modalEase },
                "<"
              );
            } else if (variant === "full-screen") {
              tl.fromTo(
                q(".modal_backdrop"),
                { opacity: 0 },
                { opacity: 1, duration: 0.3, ease: modalEase }
              );
              tl.from(
                q(".modal_content"),
                { opacity: 0, duration: 0.2, ease: modalEase },
                "<"
              );
              tl.from(
                q(".modal_slot"),
                { opacity: 1, yPercent: 100, duration: 1, ease: modalEase },
                "<0.1"
              );
            } else {
              tl.fromTo(
                q(".modal_backdrop"),
                { opacity: 0 },
                { opacity: 1, duration: 0.3, ease: modalEase }
              );
              tl.from(
                q(".modal_content"),
                { opacity: 0, y: "6rem", duration: 0.3, ease: modalEase },
                "<"
              );
            }

            if (closeBtn) {
              tl.to(
                closeBtn,
                {
                  scale: 1,
                  opacity: 1,
                  duration: 0.22,
                  ease: modalEase,
                  clearProps: "transform",
                },
                ">+0.12"
              );
            }

            modal.tl = tl;
          }, modal);
        }

        function resetModal() {
          typeof lenis !== "undefined" && lenis.start ? lenis.start() : (document.body.style.overflow = "");
          modal.close();
          try {
            const url = new URL(window.location.href);
            if (url.searchParams.get("modal-id") === modalId) {
              url.searchParams.delete("modal-id");
              history.replaceState({}, "", url);
            }
          } catch (_) {}
          if (lastFocusedElement) lastFocusedElement.focus();
          window.dispatchEvent(new CustomEvent("modal-close", { detail: { modal } }));
        }

        function openModal(trigger) {
          typeof lenis !== "undefined" && lenis.stop ? lenis.stop() : (document.body.style.overflow = "hidden");
          lastFocusedElement = document.activeElement;
          modal.showModal();
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("modal-id", modalId);
            history.pushState({ modalId }, "", url);
          } catch (_) {}
          if (typeof gsap !== "undefined" && modal.tl) modal.tl.play(0);
          modal.querySelectorAll("[data-modal-scroll]").forEach((el) => (el.scrollTop = 0));
          window.dispatchEvent(new CustomEvent("modal-open", { detail: { modal } }));
        }

        function closeModal() {
          if (typeof gsap !== "undefined" && modal.tl) {
            modal.tl.reverse();
          } else {
            resetModal();
          }
        }

        if (new URLSearchParams(location.search).get("modal-id") === modalId) {
          openModal();
          history.replaceState(
            {},
            "",
            ((u) => (u.searchParams.delete("modal-id"), u))(new URL(location.href))
          );
        }

        modal.addEventListener("cancel", (e) => (e.preventDefault(), closeModal()));
        modal.addEventListener("click", (e) => e.target.closest("[data-modal-close]") && closeModal());

        document.addEventListener("click", (e) => {
          const trigger = e.target.closest(`[data-modal-trigger='${modalId}'], a[href='#${modalId}']`);
          if (!trigger) return;
          if (trigger.tagName === "A") e.preventDefault();
          openModal(trigger);
        });

        modalSystem.list[modalId] = { open: openModal, close: closeModal };
      });
    }

    createModals();
  }
};

// ============================================================================
// FOOTER
// ============================================================================

const FooterParallax = {
  init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('[data-footer-parallax]').forEach(el => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el,
          start: 'clamp(top bottom)',
          end: 'clamp(top top)',
          scrub: true
        }
      });

      const inner = el.querySelector('[data-footer-parallax-inner]');
      const dark = el.querySelector('[data-footer-parallax-dark]');

      if (inner) {
        tl.from(inner, {
          yPercent: -25,
          ease: 'linear'
        });
      }

      if (dark) {
        tl.from(dark, {
          opacity: 0.5,
          ease: 'linear'
        }, '<');
      }
    });
  }
};

// ============================================================================
// IMPRESSION SCROLL
// ============================================================================

const ImpressionScroll = {
  init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('.impression_wrap').forEach((component) => {
      if (component.dataset.scriptInitialized) return;
      component.dataset.scriptInitialized = 'true';

      const id = component.getAttribute('data-impression-id');
      if (!id) return;

      const wrap = document.querySelector(
        `.impression_scroll_wrap[data-impression-id="${CSS.escape(id)}"]`
      );
      if (!wrap) return;

      const img = wrap.querySelector('img');
      const video = wrap.querySelector('video');

      if (video) video.preload = 'none';
      let videoLoaded = false;

      function loadVideoSources() {
        if (!video || videoLoaded) return;

        const sources = video.querySelectorAll('source[data-src]');
        if (sources.length) {
          sources.forEach((s) => {
            s.src = s.getAttribute('data-src');
            s.removeAttribute('data-src');
          });
          video.load();
        } else if (video.getAttribute('data-src') && !video.getAttribute('src')) {
          video.src = video.getAttribute('data-src');
          video.removeAttribute('data-src');
          video.load();
        }

        videoLoaded = true;
      }

      if (prefersReduced) {
        gsap.set(wrap, { autoAlpha: 1 });
        if (video) {
          loadVideoSources();
          video.play?.().catch(() => {});
        }
        return;
      }

      gsap.set(wrap, { autoAlpha: 0 });

      ScrollTrigger.create({
        trigger: component,
        start: 'top 120%',
        end: 'bottom -20%',
        onEnter: () => {
          if (video) loadVideoSources();
          gsap.to(wrap, { autoAlpha: 1, duration: 0.2, overwrite: 'auto' });
          if (video) video.play?.().catch(() => {});
        },
        onEnterBack: () => {
          if (video) loadVideoSources();
          gsap.to(wrap, { autoAlpha: 1, duration: 0.2, overwrite: 'auto' });
          if (video) video.play?.().catch(() => {});
        },
        onLeave: () => {
          if (video) video.pause?.();
          gsap.to(wrap, { autoAlpha: 0, duration: 0.2, overwrite: 'auto' });
        },
        onLeaveBack: () => {
          if (video) video.pause?.();
          gsap.to(wrap, { autoAlpha: 0, duration: 0.2, overwrite: 'auto' });
        },
      });

      const target = img || video;
      if (!target) return;

      gsap.fromTo(
        target,
        { scale: 1.1 },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: component,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      );
    });
  },
};

// ============================================================================
// VIDEO MODULES
// ============================================================================

const BackgroundVideo = {
  init() {
    document.querySelectorAll('video[data-video-src]').forEach(video => {
      if (video.dataset.videoStatus === 'loaded') return;

      const src = video.dataset.videoSrc;
      if (!src) return;

      video.src = src;
      video.dataset.videoStatus = 'loaded';

      video.load();
      video.muted = true;
      video.playsInline = true;

      video.play().catch(() => {
        const tryPlay = () => video.play().catch(() => {});
        document.addEventListener('click', tryPlay, { once: true });
      });
    });
  }
};

const BunnyLightboxModule = {
  init() {
    initBunnyLightboxPlayer();
  }
};

function initBunnyLightboxPlayer() {
  var player = document.querySelector('[data-bunny-lightbox-init]');
  if (!player) return;

  var wrapper = player.closest('[data-bunny-lightbox-status]');
  if (!wrapper) return;

  var video = player.querySelector('video');
  if (!video) return;

  try { video.pause(); } catch(_) {}
  try { video.removeAttribute('src'); video.load(); } catch(_) {}

  function setAttr(el, name, val) {
    var str = (typeof val === 'boolean') ? (val ? 'true' : 'false') : String(val);
    if (el.getAttribute(name) !== str) el.setAttribute(name, str);
  }
  function setStatus(s) { setAttr(player, 'data-player-status', s); }
  function setMutedState(v) { video.muted = !!v; setAttr(player, 'data-player-muted', video.muted); }
  function setFsAttr(v) { setAttr(player, 'data-player-fullscreen', !!v); }
  function setActivated(v) { setAttr(player, 'data-player-activated', !!v); }
  if (!player.hasAttribute('data-player-activated')) setActivated(false);

  var timeline = player.querySelector('[data-player-timeline]');
  var progressBar = player.querySelector('[data-player-progress]');
  var bufferedBar = player.querySelector('[data-player-buffered]');
  var handle = player.querySelector('[data-player-timeline-handle]');
  var timeDurationEls = player.querySelectorAll('[data-player-time-duration]');
  var timeProgressEls = player.querySelectorAll('[data-player-time-progress]');
  var playerPlaceholderImg = player.querySelector('[data-bunny-lightbox-placeholder]');

  var updateSize = player.getAttribute('data-player-update-size');
  var autoplay = player.getAttribute('data-player-autoplay') === 'true';
  var initialMuted = player.getAttribute('data-player-muted') === 'true';

  var pendingPlay = false;

  video.loop = false;
  setMutedState(initialMuted);

  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.playsInline = true;
  if (typeof video.disableRemotePlayback !== 'undefined') video.disableRemotePlayback = true;
  if (autoplay) video.autoplay = false;

  var isSafariNative = !!video.canPlayType('application/vnd.apple.mpegurl');
  var canUseHlsJs = !!(window.Hls && Hls.isSupported()) && !isSafariNative;

  var isAttached = false;
  var currentSrc = '';
  var lastPauseBy = '';
  var rafId;
  var autoStartOnReady = false;
  var scrollLockY = 0;
  var scrollLockStyles = null;

  function setupLightboxClamp(player, wrapper, video, updateSize) {
    var calcBox = wrapper.querySelector('[data-bunny-lightbox-calc-height]');
    if (!calcBox) return;

    function getRatio() {
      if (updateSize === 'cover') return null;

      if (updateSize === 'true') {
        if (video.videoWidth && video.videoHeight) return video.videoWidth / video.videoHeight;
        var before = player.querySelector('[data-player-before]');
        if (before && before.style && before.style.paddingTop) {
          var pct = parseFloat(before.style.paddingTop);
          if (pct > 0) return 100 / pct;
        }
        var r = player.getBoundingClientRect();
        if (r.height > 0) return r.width / r.height;
        return 16/9;
      }

      var beforeFalse = player.querySelector('[data-player-before]');
      if (beforeFalse && beforeFalse.style && beforeFalse.style.paddingTop) {
        var pad = parseFloat(beforeFalse.style.paddingTop);
        if (pad > 0) return 100 / pad;
      }
      var rb = player.getBoundingClientRect();
      if (rb.height > 0) return rb.width / rb.height;
      return 16/9;
    }

    function applyClamp() {
      if (updateSize === 'cover') {
        calcBox.style.maxWidth = '';
        calcBox.style.maxHeight = '';
        return;
      }

      var parent = wrapper;
      var cs = getComputedStyle(parent);
      var pt = parseFloat(cs.paddingTop) || 0;
      var pb = parseFloat(cs.paddingBottom) || 0;
      var pl = parseFloat(cs.paddingLeft) || 0;
      var pr = parseFloat(cs.paddingRight) || 0;

      var cw = (parent.clientWidth - pl - pr);
      var ch = (parent.clientHeight - pt - pb);
      if (cw <= 0 || ch <= 0) return;

      var ratio = getRatio();
      if (!ratio) {
        calcBox.style.maxWidth = '';
        calcBox.style.maxHeight = '';
        return;
      }

      var hIfFullWidth = cw / ratio;

      if (hIfFullWidth <= ch) {
        calcBox.style.maxWidth = '100%';
        calcBox.style.maxHeight = (hIfFullWidth / ch * 100) + '%';
      } else {
        calcBox.style.maxHeight = '100%';
        calcBox.style.maxWidth = ((ch * ratio) / cw * 100) + '%';
      }
    }

    var rafPending = false;
    function debouncedApply() {
      if (rafPending) return;
      if (wrapper.getAttribute('data-bunny-lightbox-status') !== 'active') return;
      rafPending = true;
      requestAnimationFrame(function(){
        rafPending = false;
        applyClamp();
      });
    }

    var ro = new ResizeObserver(debouncedApply);
    ro.observe(wrapper);

    window.addEventListener('resize', debouncedApply);
    window.addEventListener('orientationchange', debouncedApply);

    if (updateSize === 'true') {
      video.addEventListener('loadedmetadata', debouncedApply);
      video.addEventListener('loadeddata', debouncedApply);
      video.addEventListener('playing', debouncedApply);
    }

    player._applyClamp = debouncedApply;
    debouncedApply();
  }

  setupLightboxClamp(player, wrapper, video, updateSize);

  function withAttach(src, onReady) {
    if (isSafariNative) {
      video.preload = 'auto';
      video.src = src;
      video.addEventListener('loadedmetadata', onReady, { once: true });
      return;
    }
    if (canUseHlsJs) {
      var hls = new Hls({ maxBufferLength: 10 });
      player._hls = hls;
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, function(){ hls.loadSource(src); });
      hls.on(Hls.Events.MANIFEST_PARSED, function(){ onReady(); });
      hls.on(Hls.Events.LEVEL_LOADED, function(e, data){
        if (data && data.details && isFinite(data.details.totalduration) && timeDurationEls.length) {
          setText(timeDurationEls, formatTime(data.details.totalduration));
        }
      });
      return;
    }
    video.preload = 'auto';
    video.src = src;
    video.addEventListener('loadedmetadata', onReady, { once: true });
  }

  function attachMediaFor(src) {
    if (currentSrc === src && isAttached) return;
    if (player._hls) { try { player._hls.destroy(); } catch(_) {} player._hls = null; }
    if (timeDurationEls.length) setText(timeDurationEls, '00:00');

    currentSrc = src;
    isAttached = true;

    withAttach(src, function onReady(){
      readyIfIdle(player, pendingPlay);
      updateBeforeRatioIOSSafe();
      if (typeof player._applyClamp === 'function') player._applyClamp();
      if (timeDurationEls.length && video.duration) setText(timeDurationEls, formatTime(video.duration));

      if (autoStartOnReady && wrapper.getAttribute('data-bunny-lightbox-status') === 'active') {
        setStatus('loading');
        safePlay(video);
        autoStartOnReady = false;
      }
    });
  }

  function ensureOpenUI(isActive) {
    var state = isActive ? 'active' : 'not-active';
    if (wrapper.getAttribute('data-bunny-lightbox-status') !== state) {
      wrapper.setAttribute('data-bunny-lightbox-status', state);
    }
    if (isActive && typeof player._applyClamp === 'function') player._applyClamp();
  }

  function lockPageScroll() {
    if (scrollLockStyles) return;
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    scrollLockStyles = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top,
      bodyWidth: document.body.style.width
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollLockY}px`;
    document.body.style.width = '100%';
  }

  function unlockPageScroll() {
    if (!scrollLockStyles) return;
    document.documentElement.style.overflow = scrollLockStyles.htmlOverflow;
    document.body.style.overflow = scrollLockStyles.bodyOverflow;
    document.body.style.position = scrollLockStyles.bodyPosition;
    document.body.style.top = scrollLockStyles.bodyTop;
    document.body.style.width = scrollLockStyles.bodyWidth;
    window.scrollTo(0, scrollLockY);
    scrollLockStyles = null;
  }

  function isSameSrc(next){ return currentSrc && currentSrc === next; }
  function planOnOpen(next) {
    var same = isSameSrc(next);
    if (!same) {
      try { if (!video.paused && !video.ended) video.pause(); } catch(_) {}
      if (player._hls) { try { player._hls.destroy(); } catch(_) {} player._hls = null; }
      isAttached = false; currentSrc = '';
      if (timeDurationEls.length) setText(timeDurationEls, '00:00');
      setActivated(false);
      setStatus('idle');

      attachMediaFor(next);
      autoStartOnReady = !!autoplay;
      pendingPlay = !!autoplay;
      return;
    }
    autoStartOnReady = !!autoplay;
    if (autoplay) {
      setStatus('loading');
      safePlay(video);
    } else {
      try { if (!video.paused && !video.ended) video.pause(); } catch(_) {}
      setActivated(false);
      setStatus('paused');
    }
  }

  function openLightbox(src, placeholderUrl) {
    if (!src) return;

    function activate() {
      ensureOpenUI(true);
      lockPageScroll();
      planOnOpen(src);
    }

    if (playerPlaceholderImg && placeholderUrl) {
      var needsSwap = playerPlaceholderImg.getAttribute('src') !== placeholderUrl;
      if (needsSwap || !playerPlaceholderImg.complete || !playerPlaceholderImg.naturalWidth) {
        playerPlaceholderImg.onload = function(){ playerPlaceholderImg.onload = null; activate(); };
        playerPlaceholderImg.onerror = function(){ playerPlaceholderImg.onerror = null; activate(); };
        if (needsSwap) playerPlaceholderImg.setAttribute('src', placeholderUrl);
        else playerPlaceholderImg.dispatchEvent(new Event('load'));
      } else {
        activate();
      }
    } else {
      activate();
    }
  }

  function togglePlay() {
    if (video.paused || video.ended) {
      pendingPlay = true;
      lastPauseBy = '';
      setStatus('loading');
      safePlay(video);
    } else {
      lastPauseBy = 'manual';
      video.pause();
    }
  }
  function toggleMute() { setMutedState(!video.muted); }

  player.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-player-control]');
    if (!btn || !player.contains(btn)) return;
    var type = btn.getAttribute('data-player-control');
    if (type === 'play' || type === 'pause' || type === 'playpause') togglePlay();
    else if (type === 'mute') toggleMute();
    else if (type === 'fullscreen') toggleFullscreen();
  });

  function isFsActive() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function enterFullscreen() {
    if (player.requestFullscreen) return player.requestFullscreen();
    if (video.requestFullscreen) return video.requestFullscreen();
    if (video.webkitSupportsFullscreen && typeof video.webkitEnterFullscreen === 'function') return video.webkitEnterFullscreen();
  }
  function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (video.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === 'function') return video.webkitExitFullscreen();
  }
  function toggleFullscreen() { if (isFsActive() || video.webkitDisplayingFullscreen) exitFullscreen(); else enterFullscreen(); }
  document.addEventListener('fullscreenchange', function() { setFsAttr(isFsActive()); });
  document.addEventListener('webkitfullscreenchange', function() { setFsAttr(isFsActive()); });
  video.addEventListener('webkitbeginfullscreen', function() { setFsAttr(true); });
  video.addEventListener('webkitendfullscreen', function() { setFsAttr(false); });

  function updateTimeTexts() {
    if (timeDurationEls.length) setText(timeDurationEls, formatTime(video.duration));
    if (timeProgressEls.length) setText(timeProgressEls, formatTime(video.currentTime));
  }
  video.addEventListener('timeupdate', updateTimeTexts);
  video.addEventListener('loadedmetadata', function(){ updateTimeTexts(); updateBeforeRatioIOSSafe(); });
  video.addEventListener('loadeddata', function(){ updateBeforeRatioIOSSafe(); });
  video.addEventListener('playing', function(){ updateBeforeRatioIOSSafe(); });
  video.addEventListener('durationchange', updateTimeTexts);

  function updateProgressVisuals() {
    if (!video.duration) return;
    var playedPct = (video.currentTime / video.duration) * 100;
    if (progressBar) progressBar.style.transform = 'translateX(' + (-100 + playedPct) + '%)';
    if (handle) handle.style.left = pctClamp(playedPct) + '%';
  }
  function pctClamp(p) { return p < 0 ? 0 : p > 100 ? 100 : p; }
  function loop() {
    updateProgressVisuals();
    if (!video.paused && !video.ended) rafId = requestAnimationFrame(loop);
  }

  function updateBufferedBar() {
    if (!bufferedBar || !video.duration || !video.buffered.length) return;
    var end = video.buffered.end(video.buffered.length - 1);
    var buffPct = (end / video.duration) * 100;
    bufferedBar.style.transform = 'translateX(' + (-100 + buffPct) + '%)';
  }
  video.addEventListener('progress', updateBufferedBar);
  video.addEventListener('loadedmetadata', updateBufferedBar);
  video.addEventListener('durationchange', updateBufferedBar);

  video.addEventListener('play', function() { setActivated(true); cancelAnimationFrame(rafId); loop(); setStatus('playing'); });
  video.addEventListener('playing', function() { pendingPlay = false; setStatus('playing'); });
  video.addEventListener('pause', function() { pendingPlay = false; cancelAnimationFrame(rafId); updateProgressVisuals(); setStatus('paused'); });
  video.addEventListener('waiting', function() { setStatus('loading'); });
  video.addEventListener('canplay', function() { readyIfIdle(player, pendingPlay); });

  video.addEventListener('ended', function () {
    pendingPlay = false;
    cancelAnimationFrame(rafId);
    updateProgressVisuals();
    setActivated(false);
    video.currentTime = 0;

    if (document.fullscreenElement || document.webkitFullscreenElement || video.webkitDisplayingFullscreen) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (video.webkitExitFullscreen) video.webkitExitFullscreen();
    }

    closeLightbox();
  });

  if (timeline) {
    var dragging = false, wasPlaying = false, targetTime = 0, lastSeekTs = 0, seekThrottle = 180, rect = null;
    window.addEventListener('resize', function() { if (!dragging) rect = null; });
    function getFractionFromX(x) {
      if (!rect) rect = timeline.getBoundingClientRect();
      var f = (x - rect.left) / rect.width; if (f < 0) f = 0; if (f > 1) f = 1; return f;
    }
    function previewAtFraction(f) {
      if (!video.duration) return;
      var pct = f * 100;
      if (progressBar) progressBar.style.transform = 'translateX(' + (-100 + pct) + '%)';
      if (handle) handle.style.left = pct + '%';
      if (timeProgressEls.length) setText(timeProgressEls, formatTime(f * video.duration));
    }
    function maybeSeek(now) {
      if (!video.duration) return;
      if ((now - lastSeekTs) < seekThrottle) return;
      lastSeekTs = now; video.currentTime = targetTime;
    }
    function onPointerDown(e) {
      if (!video.duration) return;
      dragging = true; wasPlaying = !video.paused && !video.ended; if (wasPlaying) video.pause();
      player.setAttribute('data-timeline-drag', 'true'); rect = timeline.getBoundingClientRect();
      var f = getFractionFromX(e.clientX); targetTime = f * video.duration; previewAtFraction(f); maybeSeek(performance.now());
      timeline.setPointerCapture && timeline.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var f = getFractionFromX(e.clientX); targetTime = f * video.duration; previewAtFraction(f); maybeSeek(performance.now()); e.preventDefault();
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false; player.setAttribute('data-timeline-drag', 'false'); rect = null; video.currentTime = targetTime;
      if (wasPlaying) safePlay(video); else { updateProgressVisuals(); updateTimeTexts(); }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }
    timeline.addEventListener('pointerdown', onPointerDown, { passive: false });
    if (handle) handle.addEventListener('pointerdown', onPointerDown, { passive: false });
  }

  var hoverTimer;
  var hoverHideDelay = 3000;
  function setHover(state) {
    if (player.getAttribute('data-player-hover') !== state) {
      player.setAttribute('data-player-hover', state);
    }
  }
  function scheduleHide() { clearTimeout(hoverTimer); hoverTimer = setTimeout(function() { setHover('idle'); }, hoverHideDelay); }
  function wakeControls() { setHover('active'); scheduleHide(); }
  player.addEventListener('pointerdown', wakeControls);
  document.addEventListener('fullscreenchange', wakeControls);
  document.addEventListener('webkitfullscreenchange', wakeControls);
  var trackingMove = false;
  function onPointerMoveGlobal(e) {
    var r = player.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) wakeControls();
  }
  player.addEventListener('pointerenter', function() {
    wakeControls();
    if (!trackingMove) { trackingMove = true; window.addEventListener('pointermove', onPointerMoveGlobal, { passive: true }); }
  });
  player.addEventListener('pointerleave', function() {
    setHover('idle'); clearTimeout(hoverTimer);
    if (trackingMove) { trackingMove = false; window.removeEventListener('pointermove', onPointerMoveGlobal); }
  });

  function closeLightbox() {
    ensureOpenUI(false);
    unlockPageScroll();

    var hasPlayed = false;
    try {
      if (video.played && video.played.length) {
        for (var i = 0; i < video.played.length; i++) {
          if (video.played.end(i) > 0) { hasPlayed = true; break; }
        }
      } else {
        hasPlayed = video.currentTime > 0;
      }
    } catch (_) {}

    try { if (!video.paused && !video.ended) video.pause(); } catch (_) {}

    setActivated(false);
    setStatus(hasPlayed ? 'paused' : 'idle');
  }

  document.addEventListener('click', function(e) {
    var openBtn = e.target.closest('[data-bunny-lightbox-control="open"]');
    if (openBtn) {
      var src = openBtn.getAttribute('data-bunny-lightbox-src') || '';
      if (!src) return;
      var imgEl = openBtn.querySelector('[data-bunny-lightbox-placeholder]');
      var placeholderUrl = imgEl ? imgEl.getAttribute('src') : '';
      openLightbox(src, placeholderUrl);
      return;
    }
    var closeBtn = e.target.closest('[data-bunny-lightbox-control="close"]');
    if (closeBtn) {
      var closeInWrapper = closeBtn.closest('[data-bunny-lightbox-status]');
      if (closeInWrapper === wrapper) closeLightbox();
      return;
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLightbox();
  });

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '00:00';
    var s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h > 0 ? (h + ':' + pad2(m) + ':' + pad2(r)) : (pad2(m) + ':' + pad2(r));
  }
  function setText(nodes, text) { nodes.forEach(function(n){ n.textContent = text; }); }

  function safePlay(video) {
    var p = video.play();
    if (p && typeof p.then === 'function') p.catch(function(){});
  }

  function readyIfIdle(player, pendingPlay) {
    if (!pendingPlay &&
        player.getAttribute('data-player-activated') !== 'true' &&
        player.getAttribute('data-player-status') === 'idle') {
      player.setAttribute('data-player-status', 'ready');
    }
  }

  function updateBeforeRatioIOSSafe() {
    if (updateSize !== 'true') return;
    var before = player.querySelector('[data-player-before]');
    if (!before) return;

    function apply(w, h) {
      if (!w || !h) return;
      before.style.paddingTop = (h / w * 100) + '%';
      if (typeof player._applyClamp === 'function') player._applyClamp();
    }

    if (video.videoWidth && video.videoHeight) { apply(video.videoWidth, video.videoHeight); return; }

    if (player._hls && player._hls.levels && player._hls.levels.length) {
      var lvls = player._hls.levels;
      var best = lvls.reduce(function(a, b) { return ((b.width||0) > (a.width||0)) ? b : a; }, lvls[0]);
      if (best && best.width && best.height) { apply(best.width, best.height); return; }
    }

    requestAnimationFrame(function () {
      if (video.videoWidth && video.videoHeight) { apply(video.videoWidth, video.videoHeight); return; }

      var master = (typeof currentSrc === 'string' && currentSrc) ? currentSrc : '';
      if (!master || master.indexOf('blob:') === 0) {
        var attrSrc = player.getAttribute('data-bunny-lightbox-src') || player.getAttribute('data-player-src') || '';
        if (attrSrc && attrSrc.indexOf('blob:') !== 0) master = attrSrc;
      }
      if (!master || !/^https?:/i.test(master)) return;

      fetch(master, { credentials: 'omit', cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(); return r.text(); })
        .then(function (txt) {
          var lines = txt.split(/\r?\n/);
          var bestW = 0, bestH = 0, last = null;
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
              last = line;
            } else if (last && line && line[0] !== '#') {
              var m = /RESOLUTION=(\d+)x(\d+)/.exec(last);
              if (m) {
                var W = parseInt(m[1], 10), H = parseInt(m[2], 10);
                if (W > bestW) { bestW = W; bestH = H; }
              }
              last = null;
            }
          }
          if (bestW && bestH) apply(bestW, bestH);
        })
        .catch(function () {});
    });
  }
}

// ============================================================================
// COLLECTION MODULES
// ============================================================================

const RandomCollection = {
  init() {
    const collectionList = document.querySelector('.random_collection');
    if (!collectionList) return;

    const items = Array.from(collectionList.children);
    if (items.length === 0) return;

    const randomIndex = Math.floor(Math.random() * items.length);

    items.forEach((item, index) => {
      if (index !== randomIndex) {
        item.remove();
      }
    });

    collectionList.classList.add('loaded');
  }
};

// ============================================================================
// SLIDER UTILITIES
// ============================================================================

const SliderUtils = {
  flattenDisplayContents(slot) {
    if (!slot) return;
    let child = slot.firstElementChild;
    while (child && child.classList.contains('u-display-contents')) {
      while (child.firstChild) {
        slot.insertBefore(child.firstChild, child);
      }
      slot.removeChild(child);
      child = slot.firstElementChild;
    }
  },

  removeCMSList(slot) {
    const dynList = Array.from(slot.children).find((child) => child.classList.contains('w-dyn-list'));
    if (!dynList) return;
    const nestedItems = dynList?.querySelector('.w-dyn-items')?.children;
    if (!nestedItems) return;
    const staticWrapper = [...slot.children];
    [...nestedItems].forEach((el) => {
      const c = [...el.children].find((child) => !child.classList.contains('w-condition-invisible'));
      if (c) slot.appendChild(c);
    });
    staticWrapper.forEach((el) => el.remove());
  },

  formatSlideCount(value) {
    return value < 10 ? `0${value}` : String(value);
  },

  initSlideCounter(component, totalSlides) {
    const counterRoot = component.querySelector('.slide-counter') || component;
    const totalElement = counterRoot.querySelector('[data-slide-count="total"]');
    const stepElement = counterRoot.querySelector('[data-slide-count="step"]');
    const stepsParent = stepElement?.parentElement;

    if (!totalElement && !stepElement) return null;

    if (totalElement) {
      totalElement.textContent = this.formatSlideCount(totalSlides);
    }

    const allSteps = [];
    if (stepsParent && stepElement) {
      stepsParent.innerHTML = '';
      for (let i = 0; i < totalSlides; i++) {
        const stepClone = stepElement.cloneNode(true);
        stepClone.textContent = this.formatSlideCount(i + 1);
        stepsParent.appendChild(stepClone);
        allSteps.push(stepClone);
      }
    }

    return {
      update(index, animate = true) {
        if (allSteps.length === 0) return;
        const translate = `${-100 * index}%`;

        if (animate && typeof gsap !== 'undefined') {
          gsap.to(allSteps, {
            y: translate,
            ease: 'power3',
            duration: 0.45,
          });
        } else if (typeof gsap !== 'undefined') {
          gsap.set(allSteps, { y: translate });
        } else {
          allSteps.forEach((el) => {
            el.style.transform = `translateY(${translate})`;
          });
        }
      },
    };
  },
};

// ============================================================================
// SLIDER COMPONENT MODULE (data-slider="component")
// ============================================================================

const SliderComponentModule = {
  init() {
    if (typeof Swiper === 'undefined') return;

    // The Swiper constructor measures slide/container geometry, so building
    // every carousel up front forces layout during load. Claim components
    // now, construct each Swiper only when it nears the viewport.
    const pending = [];
    document.querySelectorAll("[data-slider='component']:not([data-slider='component'] [data-slider='component'])").forEach((component) => {
      if (component.dataset.scriptInitialized) return;
      component.dataset.scriptInitialized = 'true';
      pending.push(component);
    });
    if (!pending.length) return;

    observeOnce(pending, (component) => this.initComponent(component));
  },

  initComponent(component) {
    {
      const swiperElement = component.querySelector('.slider_element');
      const swiperWrapper = component.querySelector('.slider_list');
      if (!swiperElement || !swiperWrapper) return;

      SliderUtils.flattenDisplayContents(swiperWrapper);
      SliderUtils.removeCMSList(swiperWrapper);
      [...swiperWrapper.children].forEach((el) => el.classList.add('swiper-slide'));

      const totalSlides = swiperWrapper.children.length;
      const slideCounter = SliderUtils.initSlideCounter(component, totalSlides);

      const followFinger = swiperElement.getAttribute('data-follow-finger') === 'true';
      const freeMode = swiperElement.getAttribute('data-free-mode') === 'true';
      const mousewheel = swiperElement.getAttribute('data-mousewheel') === 'true';
      const loop = swiperElement.getAttribute('data-loop') === 'true';
      const slideToClickedSlide = swiperElement.getAttribute('data-slide-to-clicked') === 'true';
      const speed = +swiperElement.getAttribute('data-speed') || 600;

      function updateActiveSlideTheme(swiperInstance) {
        component.querySelectorAll('.card_primary_element').forEach((el) => {
          el.classList.remove('u-theme-brand');
        });

        const activeSlide = swiperInstance.slides[swiperInstance.activeIndex];
        if (!activeSlide) return;

        const cardPrimary = activeSlide.querySelector('.card_primary_element');
        if (cardPrimary) cardPrimary.classList.add('u-theme-brand');
      }

      new Swiper(swiperElement, {
        slidesPerView: 'auto',
        followFinger,
        loop,
        loopAdditionalSlides: 10,
        freeMode,
        slideToClickedSlide,
        centeredSlides: false,
        autoHeight: false,
        speed,
        mousewheel: {
          enabled: mousewheel,
          forceToAxis: true,
        },
        keyboard: {
          enabled: true,
          onlyInViewport: true,
        },
        navigation: {
          nextEl: component.querySelector("[data-slider='next'] button"),
          prevEl: component.querySelector("[data-slider='previous'] button"),
        },
        pagination: {
          el: component.querySelector('.slider_bullet_list'),
          bulletActiveClass: 'is-active',
          bulletClass: 'slider_bullet_item',
          bulletElement: 'button',
          clickable: true,
        },
        slideActiveClass: 'is-active',
        slideDuplicateActiveClass: 'is-active',
        on: {
          init() {
            updateActiveSlideTheme(this);
            slideCounter?.update(loop ? this.realIndex : this.activeIndex, false);
          },
          slideChangeTransitionStart() {
            updateActiveSlideTheme(this);
            slideCounter?.update(loop ? this.realIndex : this.activeIndex, true);
          },
        },
      });
    }
  },
};

// ============================================================================
// SLIDER TESTIMONIAL MODULE (.slider_component)
// ============================================================================

const SliderTestimonialModule = {
  init() {
    if (typeof Swiper === 'undefined' || typeof gsap === 'undefined' || typeof SplitText === 'undefined') return;

    gsap.registerPlugin(SplitText);

    // Claim components synchronously (so any duplicate init script skips them),
    // but defer the expensive work: SplitText.create() on every quote plus the
    // Swiper constructor both measure layout, and running them eagerly at
    // DOMContentLoaded produced a ~300ms forced-reflow block. Each slider now
    // initializes when it comes within 400px of the viewport, after fonts load.
    const pending = [];
    document.querySelectorAll('.slider_component').forEach((component) => {
      if (component.hasAttribute('data-slider')) return;
      component.setAttribute('data-slider', '');
      pending.push(component);
    });
    if (!pending.length) return;

    whenFontsReady(() => {
      observeOnce(pending, (component) => this.initComponent(component));
    });
  },

  initComponent(component) {
    {
      const sliderElement = component.querySelector('.slider_wrap');
      if (!sliderElement) return;

      const images = component.querySelectorAll('.slider_image');
      const quotes = component.querySelectorAll('.slider_testi_blockquote');
      const totalSlides = quotes.length || images.length;
      const slideCounter = SliderUtils.initSlideCounter(component, totalSlides);

      SplitText.create(quotes, {
        type: 'lines',
        linesClass: 'line',
        aria: 'none',
      });

      function makeActive(slide, index) {
        images.forEach((el, i) => {
          el.classList.toggle('is-active', i === index);
        });

        gsap.context(() => {
          const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

          tl.fromTo(
            slide.querySelectorAll('.line'),
            { y: '0.6em', opacity: 0 },
            {
              y: '0em',
              opacity: 1,
              stagger: 0.08,
              duration: 0.6,
            }
          );

          tl.fromTo(
            slide.querySelector('.slider_name'),
            { y: '0.5rem', opacity: 0 },
            { y: '0rem', opacity: 1, duration: 0.4 },
            '<40%'
          );

          tl.fromTo(
            slide.querySelector('.slider_role'),
            { y: '0.5rem', opacity: 0 },
            { y: '0rem', opacity: 1, duration: 0.4 },
            '<10%'
          );
        }, slide);
      }

      const swiper = new Swiper(sliderElement, {
        slidesPerView: 1,
        effect: 'fade',
        fadeEffect: { crossFade: true },
        speed: 0,
        loop: true,
        allowTouchMove: true,
        followFinger: false,
        keyboard: {
          enabled: true,
          onlyInViewport: true,
        },
        navigation: {
          nextEl: component.querySelector("[data-slider='next'] button"),
          prevEl: component.querySelector("[data-slider='previous'] button"),
        },
        pagination: {
          el: component.querySelector('.slider_bullet_wrap'),
          bulletActiveClass: 'is-active',
          bulletClass: 'slider_bullet_item',
          bulletElement: 'button',
          clickable: true,
        },
        slideActiveClass: 'is-active',
        slideDuplicateActiveClass: 'is-active',
      });

      swiper.on('slideChange', () => {
        makeActive(swiper.slides[swiper.activeIndex], swiper.realIndex);
        slideCounter?.update(swiper.realIndex, true);
      });

      makeActive(swiper.slides[swiper.activeIndex], swiper.realIndex);
      slideCounter?.update(swiper.realIndex, false);
    }
  },
};

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

function runWhenIdle(fn) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 200);
  }
}

/** Run each batch in consecutive animation frames (keeps work out of one long task). */
function runAcrossFrames(batches) {
  if (!batches.length) return;
  let i = 0;
  const step = () => {
    batches[i]();
    i += 1;
    if (i < batches.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const App = {
  _contentRevealTeardown: null,

  teardownContainer(container) {
    if (!container) return;

    this._contentRevealTeardown?.();
    this._contentRevealTeardown = null;

    SplitTextWordAnimation.destroy?.();
    SplitTextProgressAnimation.destroy?.();
    AnimatedIconButton.destroy?.();

    if (window.lumos?.modal) window.lumos.modal.list = {};

    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.getAll().slice().forEach((st) => {
        const trigger = st.trigger;
        if (trigger instanceof Element && container.contains(trigger)) st.kill();
      });
    }

    container.querySelectorAll('*').forEach((el) => {
      Object.keys(el.dataset).forEach((key) => {
        if (/Initialized$/i.test(key) || key === 'scriptInitialized') {
          delete el.dataset[key];
        }
      });
    });

    container.querySelectorAll('.slider_component[data-slider=""]').forEach((el) => {
      el.removeAttribute('data-slider');
    });

    container.querySelectorAll('form[data-spam-guard-init]').forEach((form) => {
      delete form.dataset.spamGuardInit;
      delete form.dataset.spamGuardLoadedAt;
      delete form.dataset.spamGuard;
    });
  },

  refreshAfterSwap() {
    GSAPHelper.waitForGSAP(() => {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.clearScrollMemory?.();

      runAcrossFrames([
        () => {
          HeroAnimations.init();
        },
        () => {
          HeroHomeScrollAnimation.init();
        },
        () => {
          App._contentRevealTeardown = ContentRevealScroll.init() || null;
          LineRevealScroll.init();
          FooterParallax.init();
          ImpressionScroll.init();
        },
        () => {
          SplitTextWordAnimation.init();
          SplitTextProgressAnimation.init();
          AnimatedIconButton.init();
          SliderTestimonialModule.init();
        },
      ]);
    });

    setTimeout(() => {
      runAcrossFrames([
        () => {
          HyphenReplacement.init();
          HeroHomeUiVisibility.init();
        },
        () => {
          ModalSystem.init();
          BackgroundVideo.init();
          FormSpamGuard.refresh();
        },
      ]);
    }, 0);

    runWhenIdle(() => {
      RandomCollection.init();
      SliderComponentModule.init();
      BunnyLightboxModule.init();
    });

    GSAPHelper.waitForGSAPAndScrollTrigger(() => {
      requestAnimationFrame(() => ScrollTrigger.refresh(true));
    });
  },

  init() {
    // Core scroll functionality
    SmoothScroll.init();

    this.refresh();
  },
  refresh() {
    // GSAP modules: one batch per frame (Hero + Nav no longer share one long synchronous tick)
    GSAPHelper.waitForGSAP(() => {
      runAcrossFrames([
        () => {
          HeroAnimations.init();
          // PreloaderAnimation.init();
        },
        () => {
          HeroHomeScrollAnimation.init();
        },
        () => {
          NavThemeScroll.init();
          NavHideOnScroll.init();
          NavDropdownTheme.init();
          NavDropdownOverlay.init();
        },
        () => {
          App._contentRevealTeardown?.();
          App._contentRevealTeardown = ContentRevealScroll.init() || null;
          LineRevealScroll.init();
          FooterParallax.init();
          ImpressionScroll.init();
        },
        () => {
          SplitTextWordAnimation.init();
          SplitTextProgressAnimation.init();
          AnimatedIconButton.init();
          SliderTestimonialModule.init();
        },
      ]);
    });

    // Non-GSAP: defer to next macrotask so the first GSAP rAF is not merged into the same frame
    setTimeout(() => {
      runAcrossFrames([
        () => {
          NavBannerControls.init();
          ScrollStateClass.init();
        },
        () => {
          HyphenReplacement.init();
          HeroHomeUiVisibility.init();
        },
        () => {
          ModalSystem.init();
          BackgroundVideo.init();
          FormSpamGuard.refresh();
        },
      ]);
    }, 0);

    runWhenIdle(() => {
      RandomCollection.init();
      SliderComponentModule.init();
      BunnyLightboxModule.init();
    });
  }
};

function startWithWebflow(callback) {
  if (window.Webflow && typeof window.Webflow.push === 'function') {
    window.Webflow.push(callback);
    return;
  }
  onDomReady(callback);
}

const AppBootstrap = (() => {
  let initialized = false;
  return {
    start() {
      if (initialized) return;
      initialized = true;
      App.init();
    },
    refresh() {
      App.refresh();
    }
  };
})();

startWithWebflow(() => {
  FormSpamGuard.init();
  AppBootstrap.start();
});

// Initialize NavThemeScroll early
document.addEventListener("DOMContentLoaded", () => {
  NavThemeScroll.init();
});

// ============================================================================
// PUBLIC API
// ============================================================================

window.Anm = window.Anm || {};
window.Anm.IconButton = AnimatedIconButton;
window.App = App;
window.AppBootstrap = AppBootstrap;
console.log("inna")
