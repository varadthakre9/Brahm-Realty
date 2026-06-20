# Bhram Realty — Deployment & Admin Setup

This document is your one-time checklist to take the site live and unlock the password-protected `/admin/`.

After this is done, every change you make in `/admin/` saves a project file to GitHub, which triggers a fresh build on Netlify, and the site updates 30–60 seconds later. No code edits required.

---

## What's already in place

You don't have to touch any of these — they're already configured in this repo:

| File | Purpose |
|---|---|
| `package.json` | Declares Eleventy as the build tool |
| `.eleventy.js` | Build config — turns `projects/*.md` files into HTML pages |
| `_includes/layouts/project.njk` | Shared template for every project page |
| `projects/celestial-residences.md` | Project data (frontmatter only) |
| `projects/elite-business-square.md` | Project data |
| `projects/golden-meadows.md` | Project data |
| `admin/index.html` | Loads the Decap CMS admin UI |
| `admin/config.yml` | Defines the form fields the admin sees |
| `netlify.toml` | Tells Netlify how to build and deploy |

---

## Step 1 — Install Node.js (one-time, ~3 min)

So you can preview the site locally before pushing.

1. Download from https://nodejs.org (LTS version, currently 20.x).
2. Run the installer with default options.
3. Open a fresh PowerShell window and verify:
   ```powershell
   node --version
   npm --version
   ```

> **Skip if** you only want to edit content via `/admin/` and don't care about local preview. Netlify has Node built-in for the actual deploys.

---

## Step 2 — Install dependencies (one-time, ~2 min)

In the project folder:

```powershell
cd "C:\Users\shreyath\OneDrive - AMDOCS\Documents\real estate"
npm install
```

This downloads Eleventy into a `node_modules/` folder (already in `.gitignore`).

---

## Step 3 — Try a local build (optional but recommended)

```powershell
npm run serve
```

You'll see something like `Server at http://localhost:8080/`. Open it. You should see the homepage — and `/project-celestial-residences.html` should look identical to before.

Press `Ctrl+C` to stop the server.

---

## Step 4 — Push to GitHub (one-time, ~5 min)

1. Sign in / sign up at https://github.com (free).
2. Create a new repository — call it `bhram-realty` — set to **Private** if you want.
3. Don't tick "Initialize with README" (we already have files).
4. Back in PowerShell:
   ```powershell
   cd "C:\Users\shreyath\OneDrive - AMDOCS\Documents\real estate"
   git init
   git add .
   git commit -m "Initial commit: dynamic Bhram Realty site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/bhram-realty.git
   git push -u origin main
   ```

> Replace `YOUR-USERNAME` with your actual GitHub username.

---

## Step 5 — Connect to Netlify (one-time, ~5 min)

1. Sign in / sign up at https://app.netlify.com (free — sign in with GitHub is easiest).
2. Click **Add new site** → **Import an existing project** → **GitHub**.
3. Authorise Netlify to read your repos, then pick `bhram-realty`.
4. Netlify auto-detects the `netlify.toml` settings — leave defaults and click **Deploy**.
5. Within ~60 seconds you'll get a URL like `https://stately-bombolone-abcd12.netlify.app`. The site is live.

> **To use a custom domain** (e.g. `bhramrealty.com`): in Netlify go to **Domain management** → **Add a domain**. Netlify guides you through the DNS steps.

---

## Step 6 — Enable Netlify Identity (one-time, ~2 min)

This is what gives you the password login.

1. In your Netlify site dashboard → **Integrations** tab → search for **Identity** → **Enable**.
2. Once enabled, click into **Identity** in the side nav.
3. Set **Registration preferences** to **Invite only** (so random people can't sign up).
4. Scroll to **Services** → click **Enable Git Gateway**. (This lets the admin save changes to GitHub on your behalf.)
5. Scroll to **Identity → Invite users** → enter your email → **Send**. You'll get an email with a link to set your password.

After clicking the email link and choosing a password, you can log in to your admin at:

```
https://your-netlify-url.netlify.app/admin/
```

---

## Step 7 — Set up Cloudinary (one-time, ~5 min)

You picked Cloudinary for image hosting. Free tier gives 25 GB storage / 25 GB monthly bandwidth — more than enough.

1. Sign up at https://cloudinary.com (free).
2. From the dashboard, copy two values from the top:
   - **Cloud Name** (e.g. `dxyz1234abc`)
   - **API Key** (a 15-digit number — this is the *public* key, not the Secret)
3. Open `admin/config.yml` in this repo and find the bottom section:
   ```yaml
   media_library:
     name: cloudinary
     config:
       cloud_name: YOUR_CLOUDINARY_CLOUD_NAME
       api_key: YOUR_CLOUDINARY_API_KEY
   ```
   Replace both placeholders with your real values.
4. Save, then commit and push:
   ```powershell
   git add admin/config.yml
   git commit -m "Configure Cloudinary credentials"
   git push
   ```
   Netlify rebuilds automatically.

> **Why this is safe to commit:** The Cloudinary "API Key" is *public* — Cloudinary expects it in client-side code. The *API Secret* is the one you should never commit — and we never use it.

---

## Step 8 — You're done. Start editing.

1. Go to `https://your-site.netlify.app/admin/`
2. Log in with the email + password from step 6.
3. Click **Projects** → **+ New Project**.
4. Fill in the form (every field in this repo is exposed here — including the repeating Highlights and Gallery lists).
5. Click **Publish** in the top-right.
6. ~45 seconds later, the new project page is live at `/project-<your-slug>.html`.

To **edit** an existing project: click it in the list, change fields, click **Publish**.

To **delete** a project: open it, click the menu, **Delete entry**.

---

## What's NOT auto-dynamic yet (Phase 1 scope)

You picked "projects only" for this phase. That means:

| Section | State |
|---|---|
| `/project-*.html` pages | ✅ Fully dynamic via `/admin/` |
| `projects.html` (Portfolio listing) | ❌ Still hand-coded — adding a new project does NOT auto-add a card here |
| `index.html` (homepage — Featured Estates, Philosophy, Testimonials) | ❌ Still hand-coded |
| `media.html`, `careers.html` | ❌ Still hand-coded |

When you're ready, ask for **Phase 2** and I'll wire the listing page + homepage Featured Estates to read from the same `projects/*.md` files (so a new project auto-appears everywhere).

---

## Common pitfalls

**"My logo / images don't load locally."**
Local preview uses `/admin/`-style absolute paths. `npm run serve` should handle this fine via `_site/`. If you open files directly with `file://`, paths will break — always go through `npm run serve` for local previewing.

**"My changes via /admin/ don't appear."**
Wait 60 seconds. Check the **Deploys** tab in Netlify — every save kicks off a new build. If a build fails, click into it for the error log.

**"I can't log in to /admin/."**
Make sure you accepted the invite email from step 6. If not, re-invite yourself from Netlify → Identity → Users.

**"The Cloudinary popup asks me to log in."**
The first time you upload an image, Cloudinary asks the *editor* (you) to log in once. After that it remembers.
