(async function () {
    Site.setYear();
    const root = document.getElementById('detail');
    const esc = Site.esc;

    // Format a price string ("₹ 85 L", "₹ 3.10 Cr") into clean markup:
    // a small currency symbol + tabular figures + an uppercase unit.
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

    // id comes from the pretty URL /project/:id or ?id=
    const m = location.pathname.match(/\/project\/(\d+)/);
    const id = m ? m[1] : new URLSearchParams(location.search).get('id');
    if (!id) { root.innerHTML = notFound('No project specified.'); return; }

    // Turn an admin-pasted map value (full <iframe> or a plain URL) into a safe src.
    function mapSrc(value) {
        if (!value) return '';
        const v = String(value).trim();
        const match = v.match(/src\s*=\s*["']([^"']+)["']/i);
        const url = match ? match[1] : v;
        return /^https?:\/\//i.test(url) ? url : '';
    }

    function notFound(msg) {
        return `
        <div class="py-28 text-center">
          <p class="eyebrow text-primary mb-3">Brahm Estate</p>
          <h1 class="font-headline-md text-[30px] md:text-[40px] text-on-surface mb-4">${esc(msg)}</h1>
          <a href="/projects.html" class="inline-flex items-center gap-2 text-primary font-label-md text-label-md uppercase tracking-widest hover:gap-3 transition-all">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span> Back to Portfolio
          </a>
        </div>`;
    }

    let p;
    try {
        p = await Site.getJSON('/api/projects/' + id);
    } catch (err) {
        root.innerHTML = notFound('Project not found.');
        return;
    }

    document.title = p.name + ' | Brahm Estate';

    /* ---------- Gallery / hero ---------- */
    const images = p.images || [];

    const thumbs = images.length > 1
        ? `<div class="mt-3 flex gap-3 overflow-x-auto hide-scrollbar pb-1">
            ${images.map((im, i) => `
              <img src="${Site.imgUrl(im.filename)}" data-full="${Site.imgUrl(im.filename)}"
                   class="detail-thumb h-16 w-24 md:h-[72px] md:w-28 object-cover rounded-lg cursor-pointer shrink-0 transition duration-200
                          ${i === 0 ? 'ring-2 ring-primary opacity-100' : 'ring-1 ring-outline-variant/60 opacity-70 hover:opacity-100'}"
                   alt="${esc(p.name)} photo ${i + 1}">`).join('')}
           </div>`
        : '';

    const eyebrow = p.category ? esc(p.category) : 'Curated Address';

    const locationLine = p.location ? `
        <p class="flex items-center gap-1.5 text-secondary text-body-md mt-3">
          <span class="material-symbols-outlined text-[19px] text-primary">location_on</span>${esc(p.location)}
        </p>` : '';

    const priceTop = p.starting_price ? `
        <div class="shrink-0 md:text-right">
          <p class="eyebrow text-secondary mb-1.5">Starting From</p>
          <p class="price text-[32px] md:text-[42px]">${priceHTML(p.starting_price)}</p>
        </div>` : '';

    /* ---------- Hero image with the category, name & location overlaid ---------- */
    const overlayPrice = p.starting_price ? `
        <div class="shrink-0 md:text-right">
          <p class="font-label-md text-[10px] uppercase tracking-[0.22em] text-white/70 mb-1">Starting From</p>
          <p class="price text-[26px] md:text-[34px]" style="color:#fff">${priceHTML(p.starting_price)}</p>
        </div>` : '';

    const heroOverlay = `
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6">
          <div class="min-w-0">
            <span class="inline-block px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white font-label-md text-[10px] uppercase tracking-[0.2em] mb-3">${eyebrow}</span>
            <h1 class="font-headline-md text-white text-[30px] md:text-[52px] leading-[1.05] drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]">${esc(p.name)}</h1>
            ${p.location ? `<p class="flex items-center gap-1.5 text-white/90 text-body-md mt-2.5">
              <span class="material-symbols-outlined text-[19px] text-primary-fixed-dim">location_on</span>${esc(p.location)}
            </p>` : ''}
          </div>
          ${overlayPrice}
        </div>`;

    const hero = images.length
        ? `<div class="relative rounded-2xl overflow-hidden bg-surface-container-high aspect-[16/10] md:aspect-[16/9] shadow-[0_36px_70px_-34px_rgba(0,0,0,0.4)]">
             <img id="main-img" src="${Site.imgUrl(images[0].filename)}" alt="${esc(p.name)}" class="w-full h-full object-cover"/>
             <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none"></div>
             <div class="absolute inset-x-0 bottom-0 p-6 md:p-10">${heroOverlay}</div>
           </div>`
        : `<div class="rounded-2xl overflow-hidden bg-surface-container-high aspect-[16/10] md:aspect-[16/9] shadow-[0_36px_70px_-34px_rgba(0,0,0,0.4)] flex flex-col items-center justify-center text-secondary gap-2">
             <span class="material-symbols-outlined text-[40px] text-tertiary-container">image</span>
             <span class="text-sm">No images uploaded yet</span>
           </div>`;

    // Fallback text title block — only when there's no image to overlay onto.
    const titleBlock = !images.length ? `
      <header class="mt-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-8 border-b border-outline-variant/50">
        <div class="min-w-0">
          <p class="eyebrow text-primary mb-2.5">${eyebrow}</p>
          <h1 class="font-headline-md text-[34px] md:text-[54px] leading-[1.04] text-on-surface">${esc(p.name)}</h1>
          ${locationLine}
        </div>
        ${priceTop}
      </header>` : '';

    /* ---------- Aside facts card ---------- */
    const factRows = [
        ['king_bed', 'Configurations', p.configurations],
        ['straighten', 'Carpet Area', p.carpet_area],
        ['event_available', 'Possession', p.possession_date],
        ['verified', 'RERA Number', p.rera_number],
        ['payments', 'Starting Price', p.starting_price],
    ].filter((f) => f[2]);

    const factsCard = `
      <div class="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-6 md:p-7 shadow-[0_24px_55px_-32px_rgba(0,0,0,0.35)]">
        <p class="eyebrow text-primary mb-1.5">Overview</p>
        <h2 class="font-headline-md text-[24px] text-on-surface leading-tight mb-4">Key Details</h2>
        ${factRows.length ? `<dl class="divide-y divide-outline-variant/45">
          ${factRows.map((f) => `
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 py-3.5">
              <dt class="flex items-center gap-2 text-secondary text-[13px] shrink-0">
                <span class="material-symbols-outlined text-[19px] text-primary">${f[0]}</span>${esc(f[1])}
              </dt>
              <dd class="text-on-surface font-semibold text-[14px] sm:text-right min-w-0 break-words pl-7 sm:pl-0">${f[1] === 'Starting Price' ? `<span class="price text-[16px]">${priceHTML(f[2])}</span>` : esc(f[2])}</dd>
            </div>`).join('')}
        </dl>` : '<p class="text-secondary text-sm py-2">Details coming soon.</p>'}
        <a href="/#contact" class="btn-shine mt-6 w-full inline-flex items-center justify-center gap-2 bg-on-surface text-white rounded-full py-3.5 font-label-md text-label-md uppercase tracking-widest hover:bg-primary transition-colors">
          <span>Request a Visit</span>
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        </a>
        <a href="tel:+919900000000" class="mt-3 w-full inline-flex items-center justify-center gap-2 border border-outline-variant text-on-surface rounded-full py-3 text-sm font-medium hover:border-primary hover:text-primary transition-colors">
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">call</span>
          <span>Speak to Concierge</span>
        </a>
      </div>`;

    /* ---------- Left column sections ---------- */
    function sectionHead(kicker, title) {
        return `
          <p class="eyebrow text-primary mb-2">${esc(kicker)}</p>
          <h2 class="font-headline-md text-[26px] md:text-[34px] text-on-surface leading-[1.15] mb-5">${esc(title)}</h2>`;
    }

    const aboutHTML = p.about ? `
      <section>
        ${sectionHead('The Residence', 'About the Project')}
        <p class="text-secondary text-body-lg leading-[1.85] whitespace-pre-line max-w-2xl">${esc(p.about)}</p>
      </section>` : '';

    const highlightsHTML = (p.highlights && p.highlights.length) ? `
      <section>
        ${sectionHead('Why It Stands Apart', 'Project Highlights')}
        <ul class="grid sm:grid-cols-2 gap-3 md:gap-4">
          ${p.highlights.map((h) => `
            <li class="flex gap-3 items-start rounded-xl border border-outline-variant/50 bg-surface-container-lowest px-4 py-3.5">
              <span class="material-symbols-outlined text-primary text-[20px] leading-none mt-0.5" style="font-variation-settings:'FILL' 1">check_circle</span>
              <span class="text-on-surface text-[14px] leading-relaxed">${esc(h.text)}</span>
            </li>`).join('')}
        </ul>
      </section>` : '';

    const src = mapSrc(p.map_embed);
    const locationHTML = (p.location_title || p.location_description || src) ? `
      <section>
        ${sectionHead('Connectivity', p.location_title || 'Location')}
        ${p.location_description ? `<p class="text-secondary text-body-lg leading-[1.85] mb-6 max-w-2xl">${esc(p.location_description)}</p>` : ''}
        ${src ? `<div class="rounded-2xl overflow-hidden border border-outline-variant/60 shadow-[0_24px_55px_-34px_rgba(0,0,0,0.35)]">
                  <iframe class="w-full h-[320px] md:h-[420px] block" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
                    src="${esc(src)}" allowfullscreen></iframe>
                 </div>` : ''}
      </section>` : '';

    const leftColumn = (aboutHTML || highlightsHTML || locationHTML)
        ? `<div class="lg:col-span-2 min-w-0 space-y-12 md:space-y-16">${aboutHTML}${highlightsHTML}${locationHTML}</div>`
        : `<div class="lg:col-span-2 min-w-0"><p class="text-secondary">More information about this property is coming soon.</p></div>`;

    /* ---------- Assemble ---------- */
    root.innerHTML = `
      <!-- Breadcrumb -->
      <nav class="pt-6 md:pt-9 flex items-center flex-wrap gap-x-2 gap-y-1 font-label-md text-[11px] uppercase tracking-[0.2em] text-secondary" aria-label="Breadcrumb">
        <a href="/" class="hover:text-primary transition-colors">Home</a><span class="text-outline-variant">/</span>
        <a href="/projects.html" class="hover:text-primary transition-colors">Portfolio</a><span class="text-outline-variant">/</span>
        <span class="text-on-surface normal-case tracking-normal font-body-md text-[12px]">${esc(p.name)}</span>
      </nav>

      <!-- Hero image with title overlaid -->
      <div class="mt-5 md:mt-7">
        ${hero}
        ${thumbs}
      </div>

      ${titleBlock}

      <!-- Content + sticky aside -->
      <div class="mt-12 md:mt-16 grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14 pb-20 md:pb-28">
        ${leftColumn}
        <aside class="lg:col-span-1 min-w-0 order-first lg:order-none">
          <div class="lg:sticky lg:top-28">${factsCard}</div>
        </aside>
      </div>
    `;

    /* ---------- Thumbnail switching ---------- */
    const main = document.getElementById('main-img');
    root.querySelectorAll('.detail-thumb').forEach((t) => {
        t.addEventListener('click', () => {
            if (main) main.src = t.dataset.full;
            root.querySelectorAll('.detail-thumb').forEach((x) => {
                x.classList.remove('ring-2', 'ring-primary', 'opacity-100');
                x.classList.add('ring-1', 'ring-outline-variant/60', 'opacity-70');
            });
            t.classList.remove('ring-1', 'ring-outline-variant/60', 'opacity-70');
            t.classList.add('ring-2', 'ring-primary', 'opacity-100');
        });
    });
})();
