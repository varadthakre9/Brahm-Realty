# Continuing work on Brahm Estate from a new machine

This guide is everything you need to pick up the project — both **local development**
and **pushing updates to the live EC2 site** — on a fresh computer.

If you only ever follow one section, follow [Quick start](#quick-start). The rest is
reference for when something goes wrong.

---

## Quick start (TL;DR)

```powershell
# 1. Install prerequisites (one-time on the new machine)
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Microsoft.OpenSSH.Beta

# 2. Tell git who you are (one-time)
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"

# 3. Clone the project anywhere you like
cd $HOME\Documents
git clone https://github.com/varadthakre9/Brahm-Realty.git
cd Brahm-Realty

# 4. Install dependencies
npm install

# 5. Create the .env file (see "Recreating the .env file" below)
notepad .env

# 6. Run the site locally
npm start
# -> open http://localhost:5500
```

That's it for local dev. To **deploy changes to the live EC2 site**, see
[Deploying changes to production](#deploying-changes-to-production).

---

## What you need to bring with you

These four things give you full control of the project. Keep them in a password
manager (1Password / Bitwarden / Apple Keychain):

| What | Where to get it | Used for |
|---|---|---|
| **GitHub login** (`varadthakre9`) | github.com | `git clone`, `git push` |
| **AWS login** (account `048844500973`, user `Shreyas1999`) | aws.amazon.com | Control the EC2 server |
| **Cloudinary login** | cloudinary.com | Image / video storage |
| **Turso login** | turso.tech | Cloud database |

Everything else is recoverable from those four accounts.

---

## Step 1 — Install the tools

You need three things:

1. **Git** — to clone / pull / push the code.
2. **Node.js (LTS)** — to run the site locally.
3. **OpenSSH** — to connect to the EC2 server. Already built into Windows 10/11.

The fastest way on Windows:

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Microsoft.OpenSSH.Beta
```

Or download manually:
- Git: <https://git-scm.com>
- Node.js (LTS): <https://nodejs.org>

Then identify yourself to git (one-time):

```powershell
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

---

## Step 2 — Clone the repo

```powershell
cd $HOME\Documents
git clone https://github.com/varadthakre9/Brahm-Realty.git
cd Brahm-Realty
npm install
```

`npm install` reads `package.json` and downloads every Node dependency
into `node_modules/`. Takes 30–60 seconds.

---

## Step 3 — Recreate the `.env` file

The `.env` file holds your secrets (Cloudinary credentials, Turso token,
admin password). It is **intentionally not in git** — secrets must never be
committed.

You have two ways to recreate it:

### Option A — Copy from your old machine (fastest)

Locate `.env` in the project root on your old machine, copy its contents,
and paste into a new `.env` on the new machine.

### Option B — Recreate from scratch using your dashboards

Use this template — fill in each value by logging into the relevant service:

```bash
# Admin login for /admin/ — pick any strong password and remember it.
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ReplaceMeWithAStrongPassword

# Cloudinary — log in at https://cloudinary.com -> Dashboard.
# Copy the line shown as "API Environment Variable".
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>

# Turso — log in at https://turso.tech, pick your database, copy its URL.
TURSO_DATABASE_URL=libsql://<your-db>.turso.io
# Generate a fresh token with:  turso db tokens create <your-db>
TURSO_AUTH_TOKEN=<paste token here>

# Optional upload limits (defaults: 8 MB images, 25 MB videos).
MAX_IMAGE_MB=8
MAX_VIDEO_MB=25
```

To create the file on Windows:

```powershell
notepad .env
```

Notepad opens (with a "create file?" prompt) → paste the content → **File →
Save** → close.

> **Verify it worked:** run `npm start`. The console should print
> `Server running on http://localhost:5500`, `Cloudinary configured`,
> and `Turso database connected`. If any of those are missing, the
> corresponding env var is wrong.

---

## Step 4 — Transfer the EC2 SSH key (`.pem` file)

This step is **only needed if you also want to deploy updates to the live
site** from the new machine. For local dev only, skip it.

The key file (`brahm-estate-key2.pem`) was downloaded once when you first
launched the EC2 instance. AWS does **not** let you re-download it, so you
must physically copy it from your old machine.

### Transferring the key

On the **old machine**, the file lives at (approximately):

```
C:\Users\<your-user>\Downloads\brahm-estate-key2.pem
```

Move it to the new machine via:
- Google Drive / OneDrive private folder (then download on the new PC), or
- USB stick, or
- Encrypted personal email to yourself.

On the new machine, save it somewhere safe — `~/.ssh/` is the convention:

```powershell
# Create the .ssh folder if it doesn't exist
mkdir -Force "$HOME\.ssh"

# Move the .pem file there (adjust the source path to wherever you saved it)
Move-Item "$HOME\Downloads\brahm-estate-key2.pem" "$HOME\.ssh\brahm-estate-key2.pem"
```

Then lock down the permissions — without this, `ssh` refuses to use the key:

```powershell
icacls "$HOME\.ssh\brahm-estate-key2.pem" /inheritance:r
icacls "$HOME\.ssh\brahm-estate-key2.pem" /grant:r "${env:USERNAME}:(R)"
```

### Test the SSH connection

```powershell
ssh -i "$HOME\.ssh\brahm-estate-key2.pem" ubuntu@<YOUR_ELASTIC_IP>
```

(Replace `<YOUR_ELASTIC_IP>` with your live server's IP — find it in the
AWS Console → EC2 → Instances → the `brahm-estate` row → "Public IPv4
address". Or, if you've allocated an Elastic IP, EC2 → Elastic IPs.)

If it prints `ubuntu@ip-...:~$`, you're in. Type `exit` to leave.

> **Lost the `.pem` file?** See [Recovery scenarios](#recovery-scenarios) at
> the bottom of this doc.

---

## Daily workflow

### Pulling latest code (start of each work session)

```powershell
cd $HOME\Documents\Brahm-Realty
git pull origin main
```

If any new dependencies were added since you last pulled:

```powershell
npm install
```

### Running the site locally

```powershell
npm start
```

Then open <http://localhost:5500> in your browser. `Ctrl+C` in the terminal
stops the server.

### Committing and pushing your changes

```powershell
git add .
git commit -m "describe what you changed in one sentence"
git push origin main
```

---

## Deploying changes to production

After `git push`, your changes are on GitHub but **not yet live**. To deploy
them to the EC2 server:

```powershell
ssh -i "$HOME\.ssh\brahm-estate-key2.pem" ubuntu@<YOUR_ELASTIC_IP>
```

Then on the server:

```bash
cd /opt/brahm-estate && git pull && npm install --omit=dev && pm2 restart brahm-estate
```

That's it — changes are live on <https://brahmestate.in> within ~10 seconds.

### Useful PM2 commands on the server

| Command | What it does |
|---|---|
| `pm2 status` | Show running apps and their state |
| `pm2 logs brahm-estate` | Tail live logs (`Ctrl+C` to exit) |
| `pm2 logs brahm-estate --lines 50` | Last 50 log lines and then tail |
| `pm2 restart brahm-estate` | Restart after editing `.env` or pulling code |
| `pm2 stop brahm-estate` | Take the site offline (server still runs) |
| `pm2 start brahm-estate` | Bring it back online |
| `pm2 monit` | Live CPU / memory dashboard |

---

## Editing environment variables on the server

When you need to change `.env` on the live server (e.g. rotate the admin
password, swap a Cloudinary account):

```bash
sudo nano /opt/brahm-estate/.env
# edit the values
# Ctrl+O, Enter   (save)
# Ctrl+X          (exit)
pm2 restart brahm-estate
```

---

## Recovery scenarios

### Lost the `.pem` SSH key

You cannot recover the old key, but you can attach a new one using AWS's
browser-based "EC2 Instance Connect":

1. On the new machine, generate a fresh key pair:

   ```powershell
   ssh-keygen -t rsa -b 4096 -f "$HOME\.ssh\brahm-estate-new" -N '""'
   ```

   This creates two files: `brahm-estate-new` (private — keep safe) and
   `brahm-estate-new.pub` (public — paste into the server).

2. Open the public key in Notepad and copy its full contents:

   ```powershell
   notepad "$HOME\.ssh\brahm-estate-new.pub"
   ```

   It looks like `ssh-rsa AAAAB3NzaC1yc2EAAAA... you@your-pc`.

3. In the AWS Console → EC2 → Instances → tick your `brahm-estate` instance
   → click the **Connect** button at the top → **EC2 Instance Connect** tab
   → click **Connect**. A browser terminal opens, logged in as `ubuntu`.

4. In that browser terminal, append the public key to the server's
   `authorized_keys`:

   ```bash
   echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
   ```

5. Close the browser terminal and test from your local PowerShell:

   ```powershell
   icacls "$HOME\.ssh\brahm-estate-new" /inheritance:r
   icacls "$HOME\.ssh\brahm-estate-new" /grant:r "${env:USERNAME}:(R)"
   ssh -i "$HOME\.ssh\brahm-estate-new" ubuntu@<YOUR_ELASTIC_IP>
   ```

### Lost Cloudinary credentials

Log into <https://cloudinary.com> → Dashboard. The **"API Environment
Variable"** at the top is literally the value to put into `.env`
(`CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name>`).

### Lost Turso credentials

Install the Turso CLI (<https://docs.turso.tech/cli/installation>) and run:

```bash
turso auth login
turso db list                                      # find your database name
turso db show <db-name>                            # shows the libsql:// URL
turso db tokens create <db-name>                   # generate a fresh auth token
```

Paste the URL into `TURSO_DATABASE_URL` and the token into `TURSO_AUTH_TOKEN`.

### Lost the admin panel password

SSH into the server and edit `.env`:

```bash
sudo nano /opt/brahm-estate/.env
# change ADMIN_PASSWORD=... to whatever you want
# Ctrl+O, Enter, Ctrl+X
pm2 restart brahm-estate
```

The new password is in effect immediately.

### Server is unreachable / site is down

1. **Is the EC2 instance running?** AWS Console → EC2 → Instances →
   `brahm-estate` should show "Instance state: Running" and "Status check:
   2/2 checks passed". If it's stopped, click **Instance state → Start
   instance**.
2. **Did the IP change?** If you have NOT allocated an Elastic IP, the
   public IP changes every time you Stop/Start. Re-check the current IP in
   the EC2 console and update your DNS records (and use the new IP for SSH).
3. **Is the app running on the server?** SSH in and run `pm2 status`. If
   `brahm-estate` shows `stopped` or `errored`, run `pm2 restart
   brahm-estate` and then `pm2 logs brahm-estate --lines 50` to see the
   error.
4. **Is nginx running?** `sudo systemctl status nginx`. If not, `sudo
   systemctl restart nginx`.
5. **Re-run the setup script** as a nuclear option — it's idempotent and
   safe to re-run:

   ```bash
   bash /opt/brahm-estate/deploy/setup-ec2.sh
   ```

---

## Optional: one-command deploy from your PC

If you find yourself deploying often, create a `deploy.ps1` file at the
project root with this content:

```powershell
# deploy.ps1 — push to GitHub and refresh the live EC2 site in one go.
$EC2_IP  = "<YOUR_ELASTIC_IP>"
$KEY     = "$HOME\.ssh\brahm-estate-key2.pem"

git push origin main
ssh -i $KEY ubuntu@$EC2_IP "cd /opt/brahm-estate && git pull && npm install --omit=dev && pm2 restart brahm-estate"
```

Then any time you want to ship: `.\deploy.ps1`.

(Add `deploy.ps1` to `.gitignore` if you don't want to commit your local
path / IP.)

---

## Related docs

- [`DEPLOY-EC2.md`](DEPLOY-EC2.md) — initial EC2 server provisioning (only
  needed when launching a fresh server).
- [`setup-ec2.sh`](setup-ec2.sh) — the one-shot setup script the deploy
  doc invokes.
