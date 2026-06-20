/* ============================================================================
   Bhram Realty — Tailwind design-system config (DESIGN_SYSTEM_25)
   ----------------------------------------------------------------------------
   Loaded immediately after the Tailwind Play CDN. The CDN script exposes
   `window.tailwind`; assigning `tailwind.config` here re-processes the page
   with our custom tokens (colors, fonts, spacing, radii).

   This file is shared between index.html and projects.html so the brand
   tokens stay in one place.
   ============================================================================ */

tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'surface': '#faf9f6',
                'surface-container-highest': '#e3e2de',
                'background': '#faf9f6',
                'tertiary-container': '#b2b3ae',
                'tertiary': '#5d5f5a',
                'on-primary': '#ffffff',
                'surface-container': '#efede9',
                'secondary': '#5f5e5a',
                'on-surface': '#1b1c1b',
                'inverse-surface': '#30302f',
                'on-secondary-fixed': '#1b1c1b',
                'surface-variant': '#e3e2de',
                'on-secondary-fixed-variant': '#474744',
                'on-background': '#1b1c1b',
                'on-secondary-container': '#656460',
                'on-primary-container': '#554300',
                'tertiary-fixed': '#e2e2dd',
                'primary-fixed-dim': '#e9c349',
                'tertiary-fixed-dim': '#c6c6c2',
                'on-error-container': '#93000a',
                'surface-bright': '#faf9f6',
                'on-tertiary': '#ffffff',
                'surface-container-lowest': '#ffffff',
                'secondary-container': '#e4e2de',
                'on-primary-fixed': '#241a00',
                'on-surface-variant': '#4d463d',
                'secondary-fixed': '#e4e2de',
                'secondary-fixed-dim': '#c8c6c2',
                'error-container': '#ffdad6',
                'on-error': '#ffffff',
                'inverse-primary': '#e9c349',
                'outline': '#7f7669',
                'primary-container': '#d4af37',
                'on-secondary': '#ffffff',
                'surface-tint': '#735c00',
                'primary-fixed': '#ffe088',
                'on-tertiary-container': '#434541',
                'on-tertiary-fixed-variant': '#454743',
                'surface-container-high': '#e9e8e4',
                'on-primary-fixed-variant': '#574500',
                'inverse-on-surface': '#f2f0ed',
                'error': '#ba1a1a',
                'surface-dim': '#dbdad7',
                'surface-container-low': '#f5f3f0',
                'primary': '#735c00',
                'outline-variant': '#d0c5b5',
                'on-tertiary-fixed': '#1a1c1b',
            },
            borderRadius: {
                DEFAULT: '0.25rem',
                lg: '0.5rem',
                xl: '0.75rem',
                '2xl': '1rem',
                full: '9999px',
            },
            spacing: {
                'unit': '8px',
                'margin-mobile': '20px',
                'gutter': '24px',
                'container-max': '1440px',
                'margin-desktop': '80px',
            },
            fontFamily: {
                'display-lg': ['"Cormorant Garamond"', 'Georgia', 'serif'],
                'display-lg-mobile': ['"Cormorant Garamond"', 'Georgia', 'serif'],
                'headline-lg': ['"Cormorant Garamond"', 'Georgia', 'serif'],
                'headline-lg-mobile': ['"Cormorant Garamond"', 'Georgia', 'serif'],
                'headline-md': ['"Cormorant Garamond"', 'Georgia', 'serif'],
                'body-lg': ['Manrope', 'system-ui', 'sans-serif'],
                'body-md': ['Manrope', 'system-ui', 'sans-serif'],
                'label-md': ['Manrope', 'system-ui', 'sans-serif'],
                'label-sm': ['Manrope', 'system-ui', 'sans-serif'],
            },
            fontSize: {
                'display-lg': ['72px', { lineHeight: '76px', letterSpacing: '-0.028em', fontWeight: '500' }],
                'display-lg-mobile': ['44px', { lineHeight: '48px', letterSpacing: '-0.022em', fontWeight: '500' }],
                'headline-lg': ['52px', { lineHeight: '58px', letterSpacing: '-0.022em', fontWeight: '500' }],
                'headline-lg-mobile': ['34px', { lineHeight: '40px', letterSpacing: '-0.018em', fontWeight: '500' }],
                'headline-md': ['28px', { lineHeight: '34px', letterSpacing: '-0.014em', fontWeight: '500' }],
                'body-lg': ['17px', { lineHeight: '28px', letterSpacing: '0.003em', fontWeight: '400' }],
                'body-md': ['15px', { lineHeight: '25px', letterSpacing: '0.003em', fontWeight: '400' }],
                'label-md': ['12px', { lineHeight: '18px', letterSpacing: '0.22em', fontWeight: '600' }],
                'label-sm': ['11px', { lineHeight: '16px', letterSpacing: '0.2em', fontWeight: '600' }],
            },
        },
    },
};
