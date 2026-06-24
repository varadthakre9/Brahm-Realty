/* ============================================================================
   render-hero.js — swap the homepage hero background in place using whatever
   the admin has uploaded (an image OR a looping video). Falls back silently
   to the hard-coded hero image if nothing is configured or the API fails.
   ============================================================================ */
(function () {
    function imgUrl(filename) {
        if (!filename) return '';
        return /^https?:\/\//i.test(filename) ? filename : '/uploads/' + encodeURIComponent(filename);
    }

    async function loadHero() {
        const hero = document.getElementById('hero');
        if (!hero) return;
        const bgLayer = hero.firstElementChild;
        if (!bgLayer) return;

        let settings;
        try {
            const res = await fetch('/api/site-settings?keys=hero_media_url,hero_media_type', { cache: 'no-store' });
            if (!res.ok) return;
            settings = await res.json();
        } catch (_) {
            return;
        }

        const url = settings.hero_media_url;
        const type = settings.hero_media_type;
        if (!url) return;

        const resolved = imgUrl(url);

        if (type === 'video') {
            const wrap = document.createElement('div');
            wrap.className = 'absolute inset-0';
            wrap.innerHTML = `
                <video autoplay muted loop playsinline preload="auto"
                       class="absolute inset-0 w-full h-full object-cover"
                       poster="${bgLayer.style.backgroundImage ? extractUrl(bgLayer.style.backgroundImage) : ''}">
                    <source src="${resolved}"/>
                </video>
                <div class="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65"></div>`;
            bgLayer.replaceWith(wrap);

            // iOS Safari sometimes needs a manual nudge after the element is attached.
            const vid = wrap.querySelector('video');
            if (vid) {
                const playAttempt = () => vid.play().catch(() => {});
                if (vid.readyState >= 2) playAttempt();
                else vid.addEventListener('loadeddata', playAttempt, { once: true });
            }
        } else {
            // Treat anything non-video as an image swap.
            bgLayer.style.backgroundImage = `url('${resolved.replace(/'/g, "\\'")}')`;
        }
    }

    function extractUrl(bgImage) {
        const m = /url\(\s*(['"]?)(.*?)\1\s*\)/.exec(bgImage || '');
        return m ? m[2] : '';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadHero);
    } else {
        loadHero();
    }
})();
