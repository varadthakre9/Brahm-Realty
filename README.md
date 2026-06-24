# Brahm Estate

A luxury real estate website **plus** an admin panel and database — all in one
folder, run by one small Node server.

- **Website** — the Brahm Estate pages (home, portfolio, detail pages).
- **Admin panel** — add/edit projects, upload images, pick which appear on the
  homepage. No coding needed.
- **Database** — projects you add are stored in a cloud SQLite database
  ([Turso](https://turso.tech)) and shown on the site automatically.
- **Images** — gallery photos are uploaded to [Cloudinary](https://cloudinary.com)
  and served from there.

## Running it locally

You need [Node.js](https://nodejs.org) (v20+) installed. Then, from this folder:

```bash
npm install      # first time only
copy .env.example .env   # then fill in your values
npm start
```

Then open:

| URL | What it is |
|---|---|
| `http://localhost:5500/` | The Brahm Estate website |
| `http://localhost:5500/admin/` | The admin panel |

Log in to the admin with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set in
`.env`. Cloudinary and Turso credentials also live in `.env` — see
`.env.example` for the full list. If the cloud variables are left blank, the
server falls back to a local SQLite file and local image uploads.

## How content flows

1. In the admin panel, click **New**, fill in the project details, save.
2. Upload gallery images, add highlights, and tick **Show on homepage**.
3. On the website, the **Featured Estates** section (home page) shows every
   project marked for the homepage, and the **Portfolio** page lists them all.
   Each card links to its detail page at `/project/<id>`.

The site reads fresh data on each page load — refresh the page after making
admin changes.

## The pages

| File | What it is |
|---|---|
| `index.html` | Home page — hero, **Featured Estates** (admin projects), about, contact |
| `projects.html` | Portfolio — admin projects with filters |
| `media.html` / `careers.html` | Press / job pages |
| `project.html` | Dynamic detail page for admin-managed projects (`/project/:id`) |
| `admin/` | The admin panel (login, project editor, gallery, highlights) |

Folders: `css/` (styling), `js/` (scripts), `images/` (static pictures),
`uploads/` (local image fallback), `data/` (local SQLite fallback).

## Server files

`server.js` (the app), `db.js` (database), `cloudinary.js` (image uploads),
`config.js` (port + defaults), `package.json`. These are not served to the
public.

## Putting it online

This site is hosted on [Render](https://render.com) using the included
`render.yaml` blueprint. On the host, set these environment variables:

- `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- `CLOUDINARY_URL` (and optional `CLOUDINARY_FOLDER`)
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`

Pushing to the `main` branch triggers a new deploy automatically.
