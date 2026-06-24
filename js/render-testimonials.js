/* ============================================================================
   render-testimonials.js — pull visible testimonials from /api/testimonials and
   swap them into #testimonial-grid. Falls back to the hard-coded static cards
   if the API returns nothing (or fails), so the homepage always has content.
   ============================================================================ */
(function () {
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function imgUrl(filename) {
        if (!filename) return '';
        return /^https?:\/\//i.test(filename) ? filename : '/uploads/' + encodeURIComponent(filename);
    }
    function initials(name) {
        return String(name || '')
            .split(/\s+/).filter(Boolean).slice(0, 2)
            .map((s) => s[0].toUpperCase()).join('') || '?';
    }

    function cardHTML(t, delay) {
        const photo = t.photo
            ? `<img alt="${esc(t.name)}" class="w-full h-full object-cover" src="${esc(imgUrl(t.photo))}"/>`
            : `<div class="w-full h-full flex items-center justify-center bg-primary-container/40 text-primary-dark font-semibold text-sm">${esc(initials(t.name))}</div>`;
        const role = t.role
            ? `<p class="eyebrow text-secondary mt-1 truncate">${esc(t.role)}</p>`
            : '';
        return `
<figure class="card-hover group relative bg-white px-7 py-9 md:px-8 md:py-10 rounded-2xl signature-shadow ring-1 ring-outline-variant/30 flex flex-col overflow-hidden flex-none w-[85vw] sm:w-[62vw] md:w-auto snap-center md:snap-align-none" data-reveal data-reveal-delay="${delay}">
  <span aria-hidden="true" class="select-none pointer-events-none absolute -top-2 right-4 leading-none text-primary opacity-[0.09]" style="font-family:'Cormorant Garamond',Georgia,serif;font-size:9rem;font-weight:600;font-style:italic;">&ldquo;</span>
  <div class="flex items-center gap-0.5 mb-5 text-primary-container relative" aria-label="Rated 5 out of 5 stars">
    <span class="material-symbols-outlined text-base" style="font-variation-settings:'FILL' 1;">star</span>
    <span class="material-symbols-outlined text-base" style="font-variation-settings:'FILL' 1;">star</span>
    <span class="material-symbols-outlined text-base" style="font-variation-settings:'FILL' 1;">star</span>
    <span class="material-symbols-outlined text-base" style="font-variation-settings:'FILL' 1;">star</span>
    <span class="material-symbols-outlined text-base" style="font-variation-settings:'FILL' 1;">star</span>
  </div>
  <blockquote class="font-headline-md italic text-on-surface text-lg md:text-xl leading-[1.55] tracking-[-0.005em] mb-6 flex-1">${esc(t.content)}</blockquote>
  <figcaption class="flex items-center gap-3.5 pt-6 border-t border-outline-variant/40">
    <div class="relative w-11 h-11 rounded-full overflow-hidden flex-none ring-1 ring-primary-container/50 ring-offset-2 ring-offset-white">${photo}</div>
    <div class="min-w-0">
      <p class="font-label-md text-label-md text-on-surface uppercase tracking-[0.18em] truncate">${esc(t.name)}</p>
      ${role}
    </div>
  </figcaption>
</figure>`;
    }

    async function loadTestimonials() {
        const grid = document.getElementById('testimonial-grid');
        if (!grid) return;
        let list;
        try {
            const res = await fetch('/api/testimonials?visible=1', { cache: 'no-store' });
            if (!res.ok) return;
            list = await res.json();
        } catch (_) {
            return;
        }
        if (!Array.isArray(list) || !list.length) return; // keep the static defaults

        grid.innerHTML = list.map((t, i) => cardHTML(t, 300 + i * 50)).join('');

        // Re-run the mobile carousel dot setup against the fresh DOM.
        if (typeof window.setupTestimonialDots === 'function') {
            window.setupTestimonialDots();
        }

        // The reveal observer was already initialised on the original DOM.
        // New figures need to be revealed manually.
        grid.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadTestimonials);
    } else {
        loadTestimonials();
    }
})();
