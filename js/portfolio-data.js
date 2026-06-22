/* ============================================================================
   Bhram Realty — Portfolio page data
   ----------------------------------------------------------------------------
   Loads every project from the admin database and renders the property cards
   into #projects-grid, then starts the filters. Edit projects in the admin
   panel (/admin/) and they appear here automatically.
   ============================================================================ */

(function () {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // "Civil Lines, Nagpur" -> "civil-lines nagpur" (space-separated filter tokens)
    function slugLocation(loc) {
        return (loc || '').toLowerCase().split(',')
            .map((s) => s.trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
            .filter(Boolean).join(' ');
    }

    // "₹ 2.45 Cr" -> 245 ; "₹ 85 L" -> 85  (value in lakhs, for the price filter)
    function priceToLakhs(text) {
        const t = (text || '').toLowerCase();
        const m = t.match(/([\d.]+)/);
        if (!m) return '';
        let n = parseFloat(m[1]);
        if (/cr/.test(t)) n *= 100;
        return Math.round(n);
    }

    function tagFromCategory(cat) {
        if (/commercial/.test(cat)) return 'Commercial';
        if (/plot/.test(cat)) return 'Plots';
        const first = (cat || '').trim().split(/\s+/)[0] || '';
        return first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Featured';
    }

    // Format a price string ("₹ 85 L") into clean markup with a small
    // currency symbol, tabular figures, and an uppercase unit.
    function priceHTML(raw) {
        const s = String(raw == null ? '' : raw).trim();
        if (!s) return '';
        const m = s.match(/^\s*(₹|rs\.?|inr|\$)?\s*([\d.,]+)\s*(.*)$/i);
        if (!m) return esc(s);
        let sym = m[1] || '₹';
        if (/^(rs\.?|inr)$/i.test(sym)) sym = '₹';
        const cur = `<span class="price__cur">${esc(sym)}</span>`;
        const unit = m[3] ? `<span class="price__unit">${esc(m[3])}</span>` : '';
        return cur + esc(m[2]) + unit;
    }

    function specIcon(cat) {
        if (/commercial/.test(cat)) return 'apartment';
        if (/plot/.test(cat)) return 'straighten';
        return 'bed';
    }

    // Mirrors the homepage "Featured Estates" card (js/featured-admin.js) so both
    // pages share one card design. Adds the data-* attributes the filters need.
    function cardHTML(p) {
        const cat = (p.category || '').toLowerCase();
        const price = priceToLakhs(p.starting_price);
        const loc = slugLocation(p.location);
        const coverUrl = p.cover ? (/^https?:\/\//i.test(p.cover) ? p.cover : '/uploads/' + encodeURIComponent(p.cover)) : '';
        const media = coverUrl
            ? `<img alt="${esc(p.name)}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src="${coverUrl}"/>`
            : '<div class="w-full h-full flex items-center justify-center text-secondary text-sm" style="background:#f1ede6">No image</div>';
        const priceBlock = p.starting_price
            ? `<p class="price text-[20px] md:text-[22px]"><span class="price__from">From</span>${priceHTML(p.starting_price)}</p>`
            : '<p class="price price--muted text-[16px]">Price on request</p>';
        const spec = p.configurations
            ? `<p class="inline-flex items-center gap-1.5 text-secondary text-sm mb-6"><span class="material-symbols-outlined text-base">${specIcon(cat)}</span>${esc(p.configurations)}</p>`
            : '';
        return `
<article class="project-card group relative bg-white rounded-2xl overflow-hidden signature-shadow card-hover flex flex-col cursor-pointer" data-category="${esc(cat)}" data-location="${esc(loc)}" data-price="${price}">
<a href="/project/${p.id}" class="absolute inset-0 z-[5]" aria-label="View ${esc(p.name)} details"></a>
<div class="aspect-[4/3] overflow-hidden relative">
${media}
<span class="absolute top-4 right-4 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur text-primary font-label-md text-[10px] uppercase tracking-[0.2em] shadow-sm">${esc(tagFromCategory(cat))}</span>
</div>
<div class="p-6 md:p-7 flex flex-col flex-1">
<h3 class="font-headline-md text-on-surface text-xl md:text-[22px] leading-snug mb-2.5">${esc(p.name)}</h3>
<p class="inline-flex items-center gap-1.5 text-secondary text-sm ${spec ? 'mb-1.5' : 'mb-6'}">
<span class="material-symbols-outlined text-base">location_on</span>${esc(p.location || 'Nagpur')}
</p>
${spec}
<div class="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-t border-surface-container-high pt-5">
${priceBlock}
<a href="/project/${p.id}" class="relative z-10 shrink-0 px-5 py-2.5 border border-primary text-primary font-label-md text-[10px] uppercase tracking-[0.18em] rounded-full whitespace-nowrap hover:bg-primary hover:text-white transition-all duration-300">View Details</a>
</div>
</div>
</article>`;
    }

    async function load() {
        try {
            const res = await fetch('/api/projects', { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const list = await res.json();
            const countEl = document.getElementById('projects-count');
            const empty = document.getElementById('projects-empty');

            if (!Array.isArray(list) || !list.length) {
                grid.innerHTML = '';
                if (countEl) countEl.textContent = '0';
                if (empty) { empty.textContent = 'No projects yet — add them in the admin panel.'; empty.classList.remove('hidden'); }
                return;
            }

            grid.innerHTML = list.map(cardHTML).join('');
            if (countEl) countEl.textContent = String(list.length);
            if (window.BhramPortfolio && typeof window.BhramPortfolio.init === 'function') {
                window.BhramPortfolio.init();
            }
        } catch (err) {
            grid.innerHTML = '<p class="text-center text-secondary py-20" style="grid-column:1/-1">Unable to load projects. Make sure the server is running (npm start).</p>';
            console.debug('portfolio load failed:', err.message);
        }
    }

    load();
})();
