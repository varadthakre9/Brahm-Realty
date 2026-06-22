# Bhram Realty

A luxury real estate website **plus** an admin panel and database — all in one
folder, run by one small Node server.

- **Website** — the Bhram Realty pages (home, portfolio, detail pages).
- **Admin panel** — add/edit projects, upload images, pick which appear on the
  homepage. No coding needed.
- **Database** — projects you add are stored in SQLite and shown on the site
  automatically.

## Running it

You need [Node.js](https://nodejs.org) installed. Then, from this folder:

```bash
npm install      # first time only (already done if node_modules exists)
npm start
```

Then open:

| URL | What it is |
|---|---|
| `http://localhost:5500/` | The Bhram Realty website |
| `http://localhost:5500/admin/` | The admin panel |

Log in to the admin with the username/password in `config.js`
(default `admin` / `admin123` — change these before going live).

## How content flows

1. In the admin panel, click **New**, fill in the project details, save.
2. Upload gallery images, add highlights, and tick **Show on homepage**.
3. On the website, the **Featured Estates** section (home page) shows every
   project marked for the homepage. Each card links to its detail page at
   `/project/<id>`.

The site reads fresh data on each page load — refresh the page after making
admin changes.

## The pages

| File | What it is |
|---|---|
| `index.html` | Home page — hero, **Featured Estates** (built-in cards + admin projects), about, contact |
| `projects.html` | Portfolio — built-in property cards with filters |
| `media.html` / `careers.html` | Press / job pages |
| `project-*.html` | The 3 built-in detailed property pages |
| `project.html` | Dynamic detail page for admin-managed projects (`/project/:id`) |
| `admin/` | The admin panel (login, project editor, gallery, highlights) |

Folders: `css/` (styling), `js/` (scripts), `images/` (pictures),
`uploads/` (admin-uploaded images), `data/` (the SQLite database).

## Server files

`server.js` (the app), `db.js` (database), `config.js` (port + admin login),
`package.json`. These are not served to the public.

## Editing the built-in content

The three original Featured Estates cards and the Portfolio cards are still
plain HTML — edit them in `index.html` / `projects.html`. Admin projects appear
**alongside** the built-in featured cards.

## Putting it online

This now needs a host that runs **Node.js** (e.g. Render, Railway, Fly.io, or a
VPS) — a plain static host like Netlify Drop won't run the admin/database. Set
the `PORT`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` environment variables on the
host.
