# Bhram Realty Website

A static luxury real estate website for Bhram Realty. Built with HTML, Tailwind CSS (via CDN), and a small amount of vanilla JavaScript for carousels and animations.

## Pages

| Path | What it is |
|---|---|
| `/` (`index.html`) | Homepage - hero, philosophy, featured estates carousel, interior mastery, testimonials, contact form |
| `/projects` (`projects.html`) | Full portfolio grid of developments |
| `/media` (`media.html`) | Press, brand films, photo gallery, awards, journal - in tabbed sections |
| `/careers` (`careers.html`) | Open job positions |

## Project structure

```
/
├── index.html
├── projects.html
├── media.html
├── careers.html
├── css/
│   └── styles.css            # Extracted homepage styles
├── js/
│   ├── main.js               # Homepage carousel + animations
│   └── tailwind-config.js    # Shared Tailwind design tokens
├── netlify.toml              # Netlify hosting config (static)
├── README.md
└── .gitignore
```

## Local preview

Open `index.html` directly in a browser, or run a static server:

```powershell
npx serve .
```

## Deploying

Push the repo to GitHub and connect it to Netlify (or any static host) - no build step is required. Netlify will publish the site directly from the repo root.

## Future plan

The site is intentionally static for now. A future iteration can add a CMS layer to make projects, hero media, job openings, and the media page editable from a dashboard. The current page structure is designed to make that upgrade straightforward.
