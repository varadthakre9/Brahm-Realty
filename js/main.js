/* ============================================================================
   Bhram Realty — Home page behavior
   ----------------------------------------------------------------------------
   - Mobile navigation drawer (slide-in from right)
   - Scroll-triggered reveals (opt-in via [data-reveal])
   - Image reveal observer (opt-in via [data-img-reveal])
   - Stat count-up animation (opt-in via [data-count])
   - Sticky header elevation on scroll
   ============================================================================ */

// ----------------------------------------------------------------------------
// Mobile Navigation Drawer
// Slide-in panel from right; backdrop tap, close button, link tap, and Esc all
// dismiss it. Body scroll is locked while open.
// ----------------------------------------------------------------------------
(function () {
    const menu = document.getElementById('mobile-menu');
    const openBtn = document.getElementById('mobile-menu-button');
    if (!menu || !openBtn) return;

    const closeBtn = document.getElementById('mobile-menu-close');
    const backdrop = menu.querySelector('[data-menu-backdrop]');
    const panel = menu.querySelector('[data-menu-panel]');
    const links = menu.querySelectorAll('[data-menu-link]');

    let isOpen = false;

    function openMenu() {
        if (isOpen) return;
        isOpen = true;
        menu.classList.remove('pointer-events-none');
        menu.setAttribute('aria-hidden', 'false');
        openBtn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(() => {
            backdrop.classList.replace('opacity-0', 'opacity-100');
            panel.classList.replace('translate-x-full', 'translate-x-0');
        });
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        if (!isOpen) return;
        isOpen = false;
        backdrop.classList.replace('opacity-100', 'opacity-0');
        panel.classList.replace('translate-x-0', 'translate-x-full');
        menu.setAttribute('aria-hidden', 'true');
        openBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        setTimeout(() => {
            if (!isOpen) menu.classList.add('pointer-events-none');
        }, 300);
    }

    openBtn.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (backdrop) backdrop.addEventListener('click', closeMenu);
    links.forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) closeMenu();
    });
})();

// ----------------------------------------------------------------------------
// Sticky header — elevation feedback once the user has scrolled past the hero,
// plus active-link highlight based on the current page.
// ----------------------------------------------------------------------------
(function () {
    const header = document.getElementById('site-header');
    if (!header) return;

    // ---- Scroll-state toggle (rAF-throttled) ------------------------------
    let ticking = false;
    function updateScrollState() {
        header.classList.toggle('is-scrolled', window.scrollY > 24);
        ticking = false;
    }
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateScrollState);
            ticking = true;
        }
    }, { passive: true });
    updateScrollState();

    // ---- Active-link highlight --------------------------------------------
    // Match the current page's filename to nav links via [data-nav]. The home
    // page intentionally has no active item (the brand emblem represents it).
    const path = window.location.pathname.toLowerCase();
    const file = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

    const navMap = {
        'projects.html': 'projects',
        'project.html': 'projects',
        'media.html': 'media',
        'careers.html': 'careers',
    };

    const activeKey = navMap[file];
    if (activeKey) {
        document
            .querySelectorAll(`.site-nav-link[data-nav="${activeKey}"]`)
            .forEach((el) => el.classList.add('is-active'));
    }
})();

// ----------------------------------------------------------------------------
// Featured Estates — mobile carousel dots
// On mobile the grid container becomes a horizontal scroll-snap carousel.
// We mirror the active card with a row of dots so the user can see how many
// cards remain. Dots are tap-targets that scroll the corresponding card into
// view. On md+ the dots are hidden via Tailwind's `md:hidden`, and this
// observer's class toggles are visually irrelevant there.
// ----------------------------------------------------------------------------
(function () {
    const carousel = document.getElementById('featured-grid');
    const dotsWrap = document.getElementById('featured-dots');
    if (!carousel || !dotsWrap) return;

    const cards = Array.from(carousel.querySelectorAll(':scope > article'));
    if (!cards.length) return;

    dotsWrap.innerHTML = '';
    const dots = cards.map((card, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'featured-dot' + (index === 0 ? ' is-active' : '');
        dot.setAttribute('aria-label', `Go to estate ${index + 1}`);
        dot.addEventListener('click', () => {
            card.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
        });
        dotsWrap.appendChild(dot);
        return dot;
    });

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                    const index = cards.indexOf(entry.target);
                    if (index === -1) return;
                    dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
                }
            });
        },
        { root: carousel, threshold: [0.6, 0.9] }
    );
    cards.forEach((card) => observer.observe(card));
})();

// ----------------------------------------------------------------------------
// Client Echoes — mobile carousel dots
// Mirrors the Featured Estates carousel: each testimonial card snaps to the
// center of the viewport on mobile, and the dots reflect / control which card
// is in view. On md+ the container becomes a grid and the dots are hidden.
// ----------------------------------------------------------------------------
(function () {
    const carousel = document.getElementById('testimonial-grid');
    const dotsWrap = document.getElementById('testimonial-dots');
    if (!carousel || !dotsWrap) return;

    const cards = Array.from(carousel.querySelectorAll(':scope > figure'));
    if (!cards.length) return;

    dotsWrap.innerHTML = '';
    const dots = cards.map((card, index) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'featured-dot' + (index === 0 ? ' is-active' : '');
        dot.setAttribute('aria-label', `Go to testimonial ${index + 1}`);
        dot.addEventListener('click', () => {
            card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        });
        dotsWrap.appendChild(dot);
        return dot;
    });

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                    const index = cards.indexOf(entry.target);
                    if (index === -1) return;
                    dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
                }
            });
        },
        { root: carousel, threshold: [0.6, 0.9] }
    );
    cards.forEach((card) => observer.observe(card));
})();

// ----------------------------------------------------------------------------
// Scroll-triggered reveals + image reveals + stat count-ups
// ----------------------------------------------------------------------------
(function () {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasObserver = 'IntersectionObserver' in window;

    // ---- Reveal observer (text/blocks) -----------------------------------
    const reveals = document.querySelectorAll('[data-reveal]');

    if (reveals.length && hasObserver && !prefersReducedMotion) {
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
        );
        reveals.forEach((el) => revealObserver.observe(el));
    } else {
        reveals.forEach((el) => el.classList.add('is-visible'));
    }

    // ---- Image reveal observer (slight zoom + fade) ----------------------
    const imgReveals = document.querySelectorAll('[data-img-reveal]');

    if (imgReveals.length && hasObserver && !prefersReducedMotion) {
        const imgObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        imgObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
        );
        imgReveals.forEach((el) => imgObserver.observe(el));
    } else {
        imgReveals.forEach((el) => el.classList.add('is-visible'));
    }

    // ---- Stat count-up animation -----------------------------------------
    // Elements with `data-count="N"` count from 0 → N over ~1.6s when in view.
    // Optional `data-count-suffix` (e.g. "+", "K", "M") is appended at the end.
    const counters = document.querySelectorAll('[data-count]');

    function animateCounter(el) {
        const target = parseFloat(el.getAttribute('data-count'));
        const suffix = el.getAttribute('data-count-suffix') || '';
        if (Number.isNaN(target)) return;

        if (prefersReducedMotion) {
            el.textContent = target + suffix;
            return;
        }

        const duration = 1600;
        const startTime = performance.now();
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);

        function tick(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const value = Math.round(target * easeOut(progress));
            el.textContent = value + suffix;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    if (counters.length && hasObserver) {
        const counterObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        animateCounter(entry.target);
                        counterObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.4 }
        );
        counters.forEach((el) => counterObserver.observe(el));
    } else {
        counters.forEach((el) => {
            const target = parseFloat(el.getAttribute('data-count'));
            const suffix = el.getAttribute('data-count-suffix') || '';
            if (!Number.isNaN(target)) el.textContent = target + suffix;
        });
    }
})();
