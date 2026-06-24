# Deploying Brahm Estate to AWS EC2

A walkthrough for getting the site running on an EC2 instance with nginx +
PM2. Takes ~15 minutes end to end. **No prior AWS or Linux experience needed.**

The app stores everything in **Cloudinary** (images) and **Turso** (database),
so the EC2 instance is stateless — nothing to back up locally.

---

## Phase 1 — Launch an EC2 instance (AWS Console, ~5 min)

1. Sign in to the [AWS Console](https://console.aws.amazon.com/ec2/) and
   open the **EC2** dashboard. Pick a region close to your users (e.g.
   **ap-south-1 / Mumbai**).
2. Click **Launch instance**.
3. Fill in the wizard:
   - **Name**: `brahm-estate`
   - **AMI**: `Ubuntu Server 22.04 LTS` (or 24.04 LTS) — *Free tier eligible*
   - **Instance type**: `t2.micro` (free tier) or `t3.small` (~$15/mo, smoother)
   - **Key pair**: click **Create new key pair**, name it
     `brahm-estate-key`, type **RSA**, format **`.pem`** → **Download**.
     **Save the .pem file somewhere safe — you only get it once.**
   - **Network settings → Edit**:
     - Auto-assign public IP: **Enable**
     - Allow **SSH (22)** from **My IP**
     - Allow **HTTP (80)** from **Anywhere**
     - Allow **HTTPS (443)** from **Anywhere**
   - **Storage**: 8 GiB is fine (default).
4. Click **Launch instance**. Wait ~30 seconds for state to become
   **Running** and note the **Public IPv4 address**.

---

## Phase 2 — Connect to the instance (SSH, ~2 min)

### On Windows (PowerShell)

```powershell
# Restrict the key file's permissions (only need to do this once)
icacls "C:\path\to\brahm-estate-key.pem" /inheritance:r
icacls "C:\path\to\brahm-estate-key.pem" /grant:r "$($env:USERNAME):(R)"

# Connect
ssh -i "C:\path\to\brahm-estate-key.pem" ubuntu@<your-ec2-public-ip>
```

When asked "Are you sure you want to continue connecting (yes/no)?" type
`yes` and press Enter.

### On macOS / Linux

```bash
chmod 400 ~/Downloads/brahm-estate-key.pem
ssh -i ~/Downloads/brahm-estate-key.pem ubuntu@<your-ec2-public-ip>
```

You should now be at a prompt like `ubuntu@ip-172-31-...:~$`.

---

## Phase 3 — Run the setup script (1 command, ~5 min)

Paste this **single command** on the EC2 server:

```bash
curl -fsSL https://raw.githubusercontent.com/varadthakre9/Brahm-Realty/main/deploy/setup-ec2.sh | bash
```

What it does (all idempotent — safe to re-run):

- Installs Node.js 20, git, nginx, PM2, and ufw
- Clones the repo to `/opt/brahm-estate`
- Runs `npm ci --omit=dev`
- Creates a blank `.env` (you'll fill it in next)
- Sets up nginx to forward port 80 → the Node app on port 5500
- Opens firewall ports 22, 80, 443
- Starts the app under PM2 with auto-restart on crash and on reboot

When it finishes you'll see a banner with the public URL and the next steps.

---

## Phase 4 — Fill in your environment variables (~2 min)

```bash
nano /opt/brahm-estate/.env
```

Paste your real values (the same ones used on Render):

```env
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
TURSO_DATABASE_URL=libsql://<your-db>.turso.io
TURSO_AUTH_TOKEN=<your-token>
ADMIN_USERNAME=<pick-a-username>
ADMIN_PASSWORD=<pick-a-strong-password>
```

Save and exit nano: **Ctrl+O**, **Enter**, then **Ctrl+X**.

Then restart the app so the new values are picked up:

```bash
pm2 restart brahm-estate
```

---

## Phase 5 — Verify it's live (~1 min)

Open `http://<your-ec2-public-ip>/` in your browser. You should see the
Brahm Estate homepage. The admin panel is at
`http://<your-ec2-public-ip>/admin/`.

If something looks wrong, check the live logs:

```bash
pm2 logs brahm-estate
```

---

## Day-to-day operations

| What you want to do | Command |
|---|---|
| See if the app is running | `pm2 status` |
| Tail live logs | `pm2 logs brahm-estate` |
| Restart the app | `pm2 restart brahm-estate` |
| Stop the app | `pm2 stop brahm-estate` |
| Pull latest code + redeploy | `bash /opt/brahm-estate/deploy/setup-ec2.sh` |
| Edit env vars | `nano /opt/brahm-estate/.env` then `pm2 restart brahm-estate` |
| Reload nginx config | `sudo systemctl reload nginx` |

The deploy script (`setup-ec2.sh`) is the one you re-run every time you push
new code to GitHub and want EC2 to pick it up. It will `git pull`,
`npm install`, restart PM2, and reload nginx — all in one go.

---

## (Optional) Custom domain + HTTPS

Not configured by default. When you're ready to point a domain like
`brahmestate.in` at the server:

1. In your DNS provider, add an **A record** for `brahmestate.in` pointing
   to your EC2 public IP. (Tip: assign an **Elastic IP** to the instance
   so it survives reboots.)
2. Update `server_name _;` in `/etc/nginx/sites-available/brahm-estate` to
   `server_name brahmestate.in www.brahmestate.in;`
3. Install certbot for a free Let's Encrypt SSL cert:

   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d brahmestate.in -d www.brahmestate.in
   ```

   Follow the prompts; certbot auto-renews every 60 days.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser shows **"This site can't be reached"** | Confirm Security Group allows port 80 from Anywhere; confirm the instance is **Running**; check the public IP hasn't changed (assign an Elastic IP if needed). |
| Browser shows **502 Bad Gateway** | The Node app isn't running. Run `pm2 status` and `pm2 logs brahm-estate` to see the error — usually a bad value in `.env`. |
| Admin login rejects you | `ADMIN_USERNAME` / `ADMIN_PASSWORD` not set or `pm2 restart` not run after editing `.env`. |
| **`Address already in use :::5500`** | Another instance of the app is running. `pm2 delete all` then re-run the setup script. |
| Out of memory after a few days | Bump instance size to `t3.small` or add a 2 GB swap file: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' \| sudo tee -a /etc/fstab`. |
