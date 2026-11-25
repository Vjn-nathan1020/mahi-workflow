# MAHI – Personal Workflow AI Assistant

**Owner:** VJ.Nathan · IGO Group of Companies · Digital Marketing
*One Vision. One Workflow. One Digital Companion.*

A real, independent website built with React + Vite + Tailwind CSS. It opens directly at its own address (for example **https://mahiworkflow.com**). **No Claude, GitHub or Vercel login is ever needed to use it.**

| Mode | Login? | Where work is saved | Setup |
|---|---|---|---|
| **LOCAL (default)** | **None** – MAHI opens straight away | Automatically in your browser on that device | Nothing – deploy as is |
| CLOUD (optional, later) | Your own email + password | Private Supabase database, synced on every device | Add 2 environment variables (see the end of this file) |

---

## What you get

- The full MAHI dashboard and digital corkboard, with all 21 pages: My Day, the Kanban workflow board, the motion workflow chart, festival campaigns, all 7 sets, brands, poster / AI video / VJ trackers, the publishing calendar, annual workflow, focus timer, achievements, notes, notifications, 11 reports with 18 charts, and settings.
- The MAHI animated character with every expression, activity, task reaction, milestone celebration and deadline alert.
- **Automatic saving** on every change, which survives refresh, closing the browser and restarting the computer.
- **Excel export / import** (the 25-sheet workbook with formulas and dropdowns), plus **backup / restore** (JSON) and a weekly backup reminder from MAHI.
- A responsive layout for desktop, tablet and phone. It can be installed to a phone's home screen.
- HTTPS and strict security headers (`vercel.json`).

> **Know this about LOCAL mode:** each browser on each device keeps its own copy. Your laptop and phone are separate, and private/incognito windows start empty. Clearing browser data ("cookies and site data") erases it.
> **Move work between devices** with *Excel Import and Export → Download backup*, then *Restore backup* on the other device. Download a backup regularly; MAHI reminds you every 7 days.

---

## Deploy in about 15 minutes (free)

You need free **GitHub** and **Vercel** accounts *only to publish* the site. Visitors, including you, never log in to either.

### Step 1 – Upload the code to GitHub
1. Unzip `MAHI_Website_Source_Code.zip`. You get a folder `mahi-website`.
2. Go to **https://github.com** → sign up or sign in → **+ → New repository** → name `mahi-workflow` → **Private** → **Create repository**.
3. On the new repository page click **"uploading an existing file"**.
4. Open the `mahi-website` folder, select **everything inside it** (Ctrl + A) and drag it into the GitHub page.
   - Windows hides some files: in File Explorer choose **View → Show → Hidden items** first, so `.github`, `.gitignore` and `.env.example` are included.
5. Click **Commit changes**.

*(With Git installed you can do this instead:* `git init && git add . && git commit -m "MAHI" && git branch -M main && git remote add origin https://github.com/<you>/mahi-workflow.git && git push -u origin main`*)*

### Step 2 – Publish on Vercel
1. Go to **https://vercel.com** → **Sign Up → Continue with GitHub**.
2. **Add New… → Project** → find `mahi-workflow` → **Import**.
3. Leave everything as it is (Framework: Vite, build `npm run build`, output `dist`). **No environment variables are needed.**
4. Click **Deploy**. About a minute later you get your live address, for example **https://mahi-workflow.vercel.app**.
5. Open it: MAHI greets you immediately, with no login. Bookmark it.

**Automatic deployment:** every change you push to GitHub `main` goes live automatically.

### Step 3 – Use your own domain (mahiworkflow.com)
1. Buy the domain if you don't own it yet (Vercel **Domains → Buy**, or GoDaddy, Namecheap, Hostinger, BigRock…).
2. In Vercel open **Project → Settings → Domains → Add** → enter `mahiworkflow.com` → **Add**. Also add `www.mahiworkflow.com` and choose **Redirect to mahiworkflow.com**.
3. At your domain registrar open **DNS settings** and add what Vercel shows. Usually:

| Type | Name / Host | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

   Remove any older `A` or `CNAME` records for `@` and `www` (such as a "parked" page). If you bought the domain on Vercel, this is done for you.
4. Wait until Vercel shows **Valid Configuration**. This usually takes minutes, but DNS can take up to 48 h. Vercel then turns on **HTTPS automatically** and renews the certificate for you.
5. Open **https://mahiworkflow.com**.

> **Important:** browser storage belongs to each web address. Work saved at `mahi-workflow.vercel.app` does **not** appear automatically at `mahiworkflow.com`. Once your domain works, use only the domain. If you already started on the vercel.app address, use **Download backup** there and **Restore backup** on the domain.

---

## Bringing over your existing MAHI work
From the claude.ai version or the offline HTML file:
1. In the old MAHI go to **Excel Import and Export → Download backup** (or **Export to Excel**).
2. On your new website go to **Excel Import and Export → Restore backup** (or **Import**), check the preview and confirm.

---

## Daily safety checklist (LOCAL mode)
- Use the same browser on the same device for your daily work.
- When MAHI reminds you, or every Friday, click **Download backup** and keep the file in Google Drive or OneDrive.
- Don't use private/incognito windows for MAHI.
- New computer or phone? Open your site there → **Restore backup**.

---

## Optional later: CLOUD mode (login + sync on all devices)

This turns on a secure email/password login and a private database, so your work appears automatically on every device.
1. Create a free project at **https://supabase.com**. In **SQL Editor** run all of [`supabase/schema.sql`](supabase/schema.sql); it creates the tables and the security rules (each user sees only their own data).
2. **Authentication → Sign In / Providers:** turn **off** "Allow new users to sign up". Then **Authentication → Users → Add user** with your email and a strong password (tick *Auto Confirm User*).
3. **Authentication → URL Configuration:** Site URL `https://mahiworkflow.com`, and Redirect URL `https://mahiworkflow.com/**`.
4. In Vercel **Project → Settings → Environment Variables**, add:
   - `VITE_STORAGE_MODE` = `cloud`
   - `VITE_SUPABASE_URL` = your Project URL (Supabase → Project Settings → API)
   - `VITE_SUPABASE_ANON_KEY` = your **anon public** key. ⚠️ Never the `service_role` key.
5. **Deployments → Redeploy.** The site now shows a sign-in page. After you sign in, your browser data is uploaded to your account automatically.

Security in CLOUD mode: Supabase Auth with hashed passwords; Row Level Security forced on every table; signed-out visitors get no access; no secret keys anywhere in the website code; HTTPS with HSTS and a strict Content-Security-Policy. Saved reports are also stored permanently (Reports → "Save report to cloud").

---

## For developers

```bash
npm install
npm run dev            # http://localhost:5173 (LOCAL mode unless .env.local has Supabase values)
npm run build          # production build → dist/
node scripts/serve-dist.mjs   # serve dist/ with the same security headers as Vercel
npm run test:sync      # 8 automated cloud-sync / privacy checks
```

```
mahi-website/
├─ index.html, package.json, vite.config.js, tailwind.config.js, postcss.config.js, vercel.json
├─ .env.example                  optional settings (all optional)
├─ public/                       icon + web-app manifest
├─ src/main.jsx, src/App.jsx     React entry + mode switch (LOCAL / CLOUD)
├─ src/components/               MahiApp (mounts MAHI), Login, ResetPassword, Splash, MahiFace
├─ src/lib/                      supabase.js (mode + client), supabaseAdapter.js (cloud storage)
├─ src/legacy/                   MAHI engine: data, workbook (Excel), store (auto-save), sync, charts, mahi (character), ui, pages, app.css
├─ supabase/schema.sql           CLOUD mode database + security rules
├─ scripts/                      serve-dist.mjs, test-sync.mjs
└─ .github/workflows/ci.yml      build + test check on every push
```
