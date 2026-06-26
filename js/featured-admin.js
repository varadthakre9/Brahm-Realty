/* ============================================================================
   Bhram Realty — Featured Estates (homepage)
   ----------------------------------------------------------------------------
   Renders the homepage "Featured Estates" cards from the admin database.

   - Shows the projects you marked "Show on homepage" in the admin panel.
   - If none are marked, it falls back to the 3 most-recently-added projects
     so the section is never empty.
   - Each card links to that project's detail page (/project/:id).

   All URLs are same-origin (the site and admin/API are one server).
   ============================================================================ */

(function () {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function tagFromCategory(cat) {
        cat = (cat || '').toLowerCase();
        if (/commercial/.test(cat)) return 'Commercial';
        if (/plot/.test(cat)) return 'Plots';
        const first = cat.trim().split(/\s+/)[0] || '';
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

    function cardHTML(p) {
        const img = p.cover ? (/^https?:\/\//i.test(p.cover) ? p.cover : '/uploads/' + encodeURIComponent(p.cover)) : '';
        const media = img
            ? `<img alt="${esc(p.name)}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src="${img}"/>`
            : '<div class="w-full h-full flex items-center justify-center text-secondary text-sm" style="background:#f1ede6">No image</div>';
        const price = p.starting_price
            ? `<p class="price text-[20px] md:text-[22px]"><span class="price__from">From</span>${priceHTML(p.starting_price)}</p>`
            : '<p class="price price--muted text-[16px]">Price on request</p>';
        return `
<article class="group relative bg-white rounded-2xl overflow-hidden signature-shadow card-hover flex flex-col flex-none w-[85vw] sm:w-[62vw] md:w-auto snap-start md:snap-align-none cursor-pointer">
<a href="/project/${p.id}" class="absolute inset-0 z-[5]" aria-label="View ${esc(p.name)} details"></a>
<div class="aspect-[4/3] overflow-hidden relative">
${media}
<span class="absolute top-4 right-4 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur text-primary font-label-md text-[10px] uppercase tracking-[0.2em] shadow-sm">${esc(tagFromCategory(p.category))}</span>
</div>
<div class="p-6 md:p-7 flex flex-col flex-1">
<h3 class="font-headline-md text-on-surface text-xl md:text-[22px] leading-snug mb-2.5">${esc(p.name)}</h3>
<p class="inline-flex items-center gap-1.5 text-secondary text-sm mb-6">
<span class="material-symbols-outlined text-base">location_on</span>${esc(p.location || 'Nagpur')}
</p>
<div class="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-t border-surface-container-high pt-5">
${price}
<a href="/project/${p.id}" class="relative z-10 shrink-0 px-5 py-2.5 border border-primary text-primary font-label-md text-[10px] uppercase tracking-[0.18em] rounded-full whitespace-nowrap hover:bg-primary hover:text-white transition-all duration-300">View Details</a>
</div>
</div>
</article>`;
    }

    async function getJSON(url) {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    // Primary source: live Node/Express API (used when a backend is running —
    // local dev, Render, AWS, etc.).
    async function fetchFromAPI() {
        let list = await getJSON('/api/projects?homepage=1');
        if (!Array.isArray(list) || !list.length) {
            const all = await getJSON('/api/projects');
            list = Array.isArray(all) ? all.slice(0, 3) : [];
        }
        return list;
    }

    // Fallback source: static JSON committed alongside the site. This is what
    // makes the homepage work on a purely static host (e.g. GitHub Pages) where
    // there is no /api endpoint to call. The file may be empty ([]); in that
    // case we fall through to the designed empty state below.
    async function fetchFromStatic() {
        const all = await getJSON('data/projects.json');
        if (!Array.isArray(all)) return [];
        const homepage = all.filter((p) => p && (p.on_homepage || p.show_on_homepage));
        return (homepage.length ? homepage : all).slice(0, 3);
    }

    async function load() {
        let list = [];
        try {
            list = await fetchFromAPI();
        } catch (apiErr) {
            try {
                list = await fetchFromStatic();
            } catch (staticErr) {
                console.debug('Featured: API and static fallback both failed.',
                    apiErr && apiErr.message, staticErr && staticErr.message);
            }
        }

        if (!Array.isArray(list) || !list.length) {
            // Designed empty state — never expose a "server is down" technical
            // message to visitors. Keeps the section looking intentional even
            // before any projects are wired up.
            grid.innerHTML = `
<div class="col-span-full md:col-span-2 lg:col-span-3 flex flex-col items-center text-center py-12 md:py-14 px-6">
<span class="material-symbols-outlined text-primary text-4xl mb-4 opacity-60" aria-hidden="true">apartment</span>
<p class="font-body-md text-body-md text-secondary leading-relaxed mb-6 max-w-md">Our curated estates are being prepared. In the meantime, explore the full portfolio of residences and commercial spaces.</p>
<a href="projects.html" class="inline-flex items-center gap-2 px-6 py-3 border border-primary text-primary font-label-md text-[11px] uppercase tracking-[0.2em] rounded-full hover:bg-primary hover:text-white transition-all duration-300">View Portfolio
<span class="material-symbols-outlined text-base" aria-hidden="true">arrow_forward</span>
</a>
</div>`;
            return;
        }

        grid.innerHTML = list.map(cardHTML).join('');
        if (window.BhramFeatured && typeof window.BhramFeatured.initDots === 'function') {
            window.BhramFeatured.initDots();
        }
    }

    load();
})();
