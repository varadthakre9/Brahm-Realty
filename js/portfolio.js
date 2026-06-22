/* ============================================================================
   Bhram Realty — Portfolio page filters
   ----------------------------------------------------------------------------
   The property cards are loaded from the admin database by js/portfolio-data.js
   and rendered into #projects-grid. After they're rendered, that script calls
   BhramPortfolio.init() to wire up the category tabs + location/price dropdowns
   so they live-filter the cards on the page.
   ============================================================================ */

window.BhramPortfolio = (function () {
    // Lakh-bound ranges. Upper bound is exclusive.
    const PRICE_RANGES = {
        '0-50':    [0, 50],
        '50-100':  [50, 100],
        '100-500': [100, 500],
        '500+':    [500, Infinity],
    };

    function tokens(value) {
        return (value || '').toLowerCase().split(/\s+/).filter(Boolean);
    }

    let wired = false;

    function init() {
        const grid = document.getElementById('projects-grid');
        if (!grid) return;

        const empty = document.getElementById('projects-empty');
        const countEl = document.getElementById('projects-count');
        const chips = Array.from(document.querySelectorAll('.filter-chip'));
        const selects = Array.from(document.querySelectorAll('.filter-select'));
        const state = { category: 'all', location: '', price: '' };

        function cardMatches(card) {
            if (state.category !== 'all' && !tokens(card.dataset.category).includes(state.category)) return false;
            if (state.location && !tokens(card.dataset.location).includes(state.location)) return false;
            if (state.price) {
                const range = PRICE_RANGES[state.price];
                if (range) {
                    const price = parseFloat(card.dataset.price);
                    if (Number.isNaN(price) || price < range[0] || price >= range[1]) return false;
                }
            }
            return true;
        }

        function apply() {
            const cards = Array.from(grid.querySelectorAll('.project-card'));
            let visible = 0;
            cards.forEach((card) => {
                const show = cardMatches(card);
                card.classList.toggle('is-hidden', !show);
                if (show) visible += 1;
            });
            if (empty) empty.classList.toggle('hidden', visible > 0);
            if (countEl) countEl.textContent = String(visible);
        }

        // Wire the controls only once (they're static in the page).
        if (!wired) {
            chips.forEach((chip) => {
                chip.addEventListener('click', () => {
                    chips.forEach((c) => c.classList.remove('is-active'));
                    chip.classList.add('is-active');
                    state.category = (chip.dataset.category || 'all').toLowerCase();
                    apply();
                });
            });
            selects.forEach((sel) => {
                sel.addEventListener('change', () => {
                    if (!sel.dataset.filter) return;
                    state[sel.dataset.filter] = sel.value.toLowerCase();
                    apply();
                });
            });
            wired = true;
        }

        apply();
    }

    return { init };
})();
