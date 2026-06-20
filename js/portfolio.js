/* ============================================================================
   Bhram Realty — Portfolio page filters
   ----------------------------------------------------------------------------
   Wires up the category tabs, location dropdown, and price-range dropdown so
   they live-filter the project cards.

   Card data attributes (HTML side):
     data-category="residential flats"   (space-separated tokens; multiple OK)
     data-location="nagpur dharampeth"   (space-separated tokens; multiple OK)
     data-price="245"                    (number, in LAKHS)

   Filter UI:
     .filter-chip[data-category=...]      one is .is-active at any time
     .filter-select[data-filter="location"]
     .filter-select[data-filter="price"]  values: "0-50", "50-100",
                                          "100-500", "500+"  (lakhs)
   ============================================================================ */

(function () {
    const grid = document.getElementById('projects-grid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.project-card'));
    const chips = Array.from(document.querySelectorAll('.filter-chip'));
    const selects = Array.from(document.querySelectorAll('.filter-select'));
    const empty = document.getElementById('projects-empty');
    const countEl = document.getElementById('projects-count');

    // Lakh-bound ranges. Upper bound is exclusive.
    const PRICE_RANGES = {
        '0-50':    [0, 50],
        '50-100':  [50, 100],
        '100-500': [100, 500],
        '500+':    [500, Infinity],
    };

    const state = {
        category: 'all',
        location: '',
        price: '',
    };

    function tokens(value) {
        return (value || '').toLowerCase().split(/\s+/).filter(Boolean);
    }

    function cardMatches(card) {
        // Category — match if 'all' or the card's tokens include the active one.
        if (state.category !== 'all') {
            if (!tokens(card.dataset.category).includes(state.category)) return false;
        }

        // Location — same token approach.
        if (state.location) {
            if (!tokens(card.dataset.location).includes(state.location)) return false;
        }

        // Price — numeric range.
        if (state.price) {
            const range = PRICE_RANGES[state.price];
            if (range) {
                const price = parseFloat(card.dataset.price);
                if (Number.isNaN(price)) return false;
                if (price < range[0] || price >= range[1]) return false;
            }
        }

        return true;
    }

    function apply() {
        let visible = 0;
        cards.forEach((card) => {
            const show = cardMatches(card);
            card.classList.toggle('is-hidden', !show);
            if (show) visible += 1;
        });
        if (empty) empty.classList.toggle('hidden', visible > 0);
        if (countEl) {
            countEl.textContent = String(visible);
        }
    }

    // ---- Wire up category chips -------------------------------------------
    chips.forEach((chip) => {
        chip.addEventListener('click', () => {
            chips.forEach((c) => c.classList.remove('is-active'));
            chip.classList.add('is-active');
            state.category = (chip.dataset.category || 'all').toLowerCase();
            apply();
        });
    });

    // ---- Wire up dropdowns ------------------------------------------------
    selects.forEach((sel) => {
        sel.addEventListener('change', () => {
            const key = sel.dataset.filter;
            if (!key) return;
            state[key] = sel.value.toLowerCase();
            apply();
        });
    });

    apply();
})();
