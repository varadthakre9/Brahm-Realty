/* Shared helpers for the public site. */
window.Site = (function () {
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function getJSON(url) {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    function imgUrl(filename) {
        if (!filename) return '';
        // Cloud-hosted images are stored as full URLs; legacy images are local filenames.
        return /^https?:\/\//i.test(filename) ? filename : '/uploads/' + encodeURIComponent(filename);
    }

    // Build a project card (used on home + projects pages).
    function cardHTML(p) {
        const cover = p.cover ? `<img src="${imgUrl(p.cover)}" alt="${esc(p.name)}" loading="lazy"/>`
            : '<div class="ph">No image yet</div>';
        const tag = p.configurations ? `<span class="tag">${esc(p.configurations)}</span>` : '';
        const meta = [];
        if (p.carpet_area) meta.push(`<span><span class="mi">straighten</span> ${esc(p.carpet_area)}</span>`);
        if (p.possession_date) meta.push(`<span><span class="mi">event</span> ${esc(p.possession_date)}</span>`);
        const price = p.starting_price
            ? `<div class="price"><small>Starting</small><b>${esc(p.starting_price)}</b></div>`
            : '<div class="price"><small>Price</small><b>On request</b></div>';
        return `
<a class="card" href="/project/${p.id}">
  <div class="media">${cover}${tag}</div>
  <div class="body">
    ${p.location ? `<p class="loc"><span class="mi">location_on</span>${esc(p.location)}</p>` : ''}
    <h3>${esc(p.name)}</h3>
    ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
    <div class="foot">
      ${price}
      <span class="arrow mi">arrow_forward</span>
    </div>
  </div>
</a>`;
    }

    function setYear() {
        document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
    }

    return { esc, getJSON, imgUrl, cardHTML, setYear };
})();
