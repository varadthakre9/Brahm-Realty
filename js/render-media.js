/* ============================================================================
   render-media.js — populate the Media page (video testimonials, brand films
   and the photo gallery) from /api/media. Falls back silently to the static
   placeholders already in the HTML if the API returns nothing.

   Also wires a lightweight lightbox: clicking a video card opens the embedded
   video in an overlay; clicking a gallery photo opens it full-screen.
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

    // Convert YouTube / Vimeo viewer URLs into embed URLs. Anything else is
    // returned unchanged (assumes the user already pasted an embed URL).
    function toEmbedUrl(url) {
        if (!url) return '';
        const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
        if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
        const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
        return url;
    }

    // -------- Lightbox -------------------------------------------------------
    let lightbox;
    function ensureLightbox() {
        if (lightbox) return lightbox;
        lightbox = document.createElement('div');
        lightbox.className = 'media-lightbox';
        lightbox.innerHTML = `
            <button type="button" class="media-lightbox-close" aria-label="Close">
                <span class="material-symbols-outlined">close</span>
            </button>
            <div class="media-lightbox-inner"></div>`;
        document.body.appendChild(lightbox);

        const close = () => {
            lightbox.classList.remove('is-open');
            lightbox.querySelector('.media-lightbox-inner').innerHTML = '';
            document.body.style.overflow = '';
        };
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target.closest('.media-lightbox-close')) close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lightbox.classList.contains('is-open')) close();
        });
        return lightbox;
    }

    function openVideo(url) {
        const lb = ensureLightbox();
        const inner = lb.querySelector('.media-lightbox-inner');
        const embed = toEmbedUrl(url);
        inner.innerHTML = `
            <div class="media-lightbox-frame">
                <iframe src="${esc(embed)}" frameborder="0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowfullscreen></iframe>
            </div>`;
        lb.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function openImage(src, alt) {
        const lb = ensureLightbox();
        const inner = lb.querySelector('.media-lightbox-inner');
        inner.innerHTML = `<img src="${esc(src)}" alt="${esc(alt || '')}"/>`;
        lb.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    // -------- Card templates -------------------------------------------------
    const FALLBACK_THUMB = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';

    function videoCardHTML(item, ratio) {
        const thumb = item.thumbnail ? imgUrl(item.thumbnail) : FALLBACK_THUMB;
        const subtitle = item.subtitle ? esc(item.subtitle) : (ratio === 'video' ? 'Video' : 'Testimonial');
        const title = item.title || 'Untitled';
        const aspect = ratio === 'video' ? 'aspect-video' : 'aspect-[4/3]';
        return `
<article class="group flex flex-col bg-surface-container-lowest rounded-2xl overflow-hidden signature-shadow card-hover cursor-pointer" data-video-url="${esc(item.video_url || '')}">
  <div class="relative ${aspect} overflow-hidden bg-on-surface">
    <img alt="${esc(title)}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="${esc(thumb)}"/>
    <span class="absolute inset-0 bg-black/20 group-hover:bg-black/5 transition-colors"></span>
    <span class="absolute inset-0 flex items-center justify-center">
      <span class="material-symbols-outlined text-white text-6xl drop-shadow-lg transition-transform duration-300 group-hover:scale-110" style="font-variation-settings:'FILL' 1;">play_circle</span>
    </span>
  </div>
  <div class="flex flex-col gap-2.5 p-6">
    <p class="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">${subtitle}</p>
    <h3 class="font-headline-md text-xl leading-snug text-on-surface">${esc(title)}</h3>
  </div>
</article>`;
    }

    function photoCellHTML(item) {
        const src = item.thumbnail ? imgUrl(item.thumbnail) : FALLBACK_THUMB;
        const alt = item.title || 'Gallery image';
        return `
<div class="group aspect-square overflow-hidden rounded-xl signature-shadow cursor-pointer" data-photo-src="${esc(src)}" data-photo-alt="${esc(alt)}">
  <img alt="${esc(alt)}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src="${esc(src)}"/>
</div>`;
    }

    function wireVideoCards(section) {
        section.querySelectorAll('[data-video-url]').forEach((card) => {
            const url = card.dataset.videoUrl;
            if (!url) return;
            card.addEventListener('click', () => openVideo(url));
        });
    }
    function wirePhotoCards(section) {
        section.querySelectorAll('[data-photo-src]').forEach((cell) => {
            cell.addEventListener('click', () => openImage(cell.dataset.photoSrc, cell.dataset.photoAlt));
        });
    }

    // -------- Section renderers (only replace when API has data) ------------
    function renderInto(section, items, makeCardHTML, wireFn) {
        if (!section || !items.length) return false;
        const grid = section.querySelector('.grid');
        if (!grid) return false;
        grid.innerHTML = items.map(makeCardHTML).join('');
        wireFn(grid);
        return true;
    }

    async function loadMedia() {
        let items;
        try {
            const res = await fetch('/api/media?visible=1', { cache: 'no-store' });
            if (!res.ok) return;
            items = await res.json();
        } catch (_) {
            return;
        }
        if (!Array.isArray(items)) return;

        const videoTests = items.filter((x) => x.kind === 'video_testimonial');
        const films = items.filter((x) => x.kind === 'brand_film');
        const photos = items.filter((x) => x.kind === 'gallery_photo');

        renderInto(document.getElementById('testimonials'), videoTests, (it) => videoCardHTML(it, '4/3'), wireVideoCards);
        renderInto(document.getElementById('videos'), films, (it) => videoCardHTML(it, 'video'), wireVideoCards);
        renderInto(document.getElementById('gallery'), photos, photoCellHTML, wirePhotoCards);

        // Also let users click the existing static cards (before any DB
        // content was added) — but only if they have a video URL we can use.
        // (The static placeholders don't, so this is a no-op for them.)
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadMedia);
    } else {
        loadMedia();
    }
})();
