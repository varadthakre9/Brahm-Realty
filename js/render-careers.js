/* ============================================================================
   render-careers.js — load open positions from /api/careers and render them
   into the careers page. Falls back silently to the static cards in the HTML
   if the API returns nothing (so the page is never blank).

   The "Apply" link is a mailto: with the role + location pre-filled in the
   subject line. Update the email address in APPLY_EMAIL if it ever changes.
   ============================================================================ */
(function () {
    const APPLY_EMAIL = 'info@brahmestate.in';

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function buildMailto(c) {
        const role = c.title || 'Open position';
        const loc = c.location || '';
        const subject = `Application: ${role}${loc ? ` (${loc})` : ''}`;
        return `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(subject)}`;
    }

    function cardHTML(c) {
        const dept = c.department
            ? `<span class="px-3 py-1 bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-[0.18em] rounded-full">${esc(c.department)}</span>`
            : '';
        const type = c.job_type
            ? `<span class="px-3 py-1 bg-surface-container text-on-surface-variant text-[10px] font-semibold uppercase tracking-[0.18em] rounded-full">${esc(c.job_type)}</span>`
            : '';
        const loc = c.location
            ? `<span class="inline-flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">place</span>${esc(c.location)}</span>`
            : '';
        const exp = c.experience
            ? `<span class="inline-flex items-center gap-1.5"><span class="material-symbols-outlined text-sm">workspace_premium</span>${esc(c.experience)}</span>`
            : '';
        const desc = c.description
            ? `<p class="text-secondary font-body-md text-sm leading-relaxed mb-5">${esc(c.description)}</p>`
            : '';

        return `
<article class="block bg-white rounded-2xl p-7 md:p-8 signature-shadow card-hover">
  <div class="flex flex-wrap items-center gap-2 mb-3">${dept}${type}</div>
  <h3 class="font-headline-md text-on-surface text-xl md:text-2xl mb-2">${esc(c.title)}</h3>
  <p class="text-secondary font-body-md text-sm flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">${loc}${exp}</p>
  ${desc}
  <a href="${esc(buildMailto(c))}" class="text-primary text-label-md uppercase tracking-[0.18em] inline-flex items-center gap-2 hover:gap-3 transition-all">Apply<span class="material-symbols-outlined text-base">arrow_forward</span></a>
</article>`;
    }

    function emptyHTML() {
        return `
<div class="md:col-span-2 bg-white rounded-2xl p-10 md:p-14 signature-shadow text-center">
  <span class="material-symbols-outlined text-primary text-5xl mb-4">work_history</span>
  <h3 class="font-headline-md text-on-surface text-xl md:text-2xl mb-3">No open positions right now</h3>
  <p class="text-secondary font-body-md max-w-md mx-auto mb-6">We're not actively hiring at the moment — but we always welcome conversations with exceptional people. Send us your résumé and we'll be in touch.</p>
  <a href="mailto:${esc(APPLY_EMAIL)}?subject=${encodeURIComponent('Hiring interest — joining Brahm Estate')}" class="text-primary text-label-md uppercase tracking-[0.18em] inline-flex items-center gap-2 hover:gap-3 transition-all">Say hello<span class="material-symbols-outlined text-base">arrow_forward</span></a>
</div>`;
    }

    async function loadCareers() {
        const grid = document.querySelector('[data-careers-grid]');
        const countEl = document.querySelector('[data-careers-count]');
        if (!grid) return;
        let list;
        try {
            const res = await fetch('/api/careers?visible=1', { cache: 'no-store' });
            if (!res.ok) return;
            list = await res.json();
        } catch (_) {
            return;
        }
        if (!Array.isArray(list)) return;

        if (list.length === 0) {
            grid.innerHTML = emptyHTML();
            if (countEl) countEl.textContent = 'No open roles right now';
            return;
        }
        grid.innerHTML = list.map(cardHTML).join('');
        if (countEl) {
            countEl.textContent = list.length === 1
                ? 'Showing 1 open role'
                : `Showing ${list.length} open roles`;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadCareers);
    } else {
        loadCareers();
    }
})();
