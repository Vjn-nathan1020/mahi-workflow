# MAHI – Supabase setup (about 15 minutes)

You only ever share two **public** values with Claude: the **Project URL** and the **Publishable key**
(or the legacy **anon public** key). Never share the **secret / service_role key**, the **database password**
or your **login password** – not in chat, not in a file, not in a screenshot.

## 0. Before anything: save your current work
1. Open MAHI in the browser you normally use: https://mahi-workflow.nathan1020v.workers.dev
2. **Excel Import and Export ▸ Download backup**. Keep the `MAHI_backup_YYYY-MM-DD.json` file somewhere safe
   (for example OneDrive). This is the only copy of your browser data until the cloud is switched on.

## 1. Create the project
1. Go to https://supabase.com ▸ **Sign in** (GitHub or e-mail) ▸ **New project**.
2. Organisation: your own. Name: `mahi-workflow`. Region: **South Asia (Mumbai)**.
3. Database password: click **Generate**, store it in your password manager. You will not need to give it to anyone.
4. Plan: **Free** is enough for MAHI. Click **Create new project** and wait about 2 minutes.

## 2. Create the database tables
1. Left menu ▸ **SQL Editor** ▸ **New query**.
2. Open `C:\Users\ASUS\MAHI_Workflow\mahi-website\supabase\schema.sql`, copy everything, paste, **Run**. Expect "Success. No rows returned".
3. **New query** again ▸ paste all of `schema_v2.sql` ▸ **Run**. Expect "Success".
4. **New query** ▸ run this with your real e-mail (and a second test address you control, used only for testing that one account cannot see another):
   ```sql
   insert into public.mahi_allowed_emails (email) values
     ('your.email@example.com'),
     ('your.email+mahitest@example.com');
   ```
   Only these addresses can ever create an account.

## 3. Create your login
1. **Authentication ▸ Users ▸ Add user ▸ Create new user**: your e-mail, a strong password, tick **Auto Confirm User**.
2. Do the same for the `+mahitest` address (password different from your real one).
3. **Authentication ▸ Sign In / Providers ▸ Email**: keep Email enabled. Turn **off** "Allow new users to sign up".
4. **Authentication ▸ URL Configuration**:
   - Site URL: `https://mahi-workflow.nathan1020v.workers.dev`
   - Redirect URLs: add `https://mahi-workflow.nathan1020v.workers.dev/**` and `http://localhost:4173/**`

## 4. Copy the two public values
**Project Settings ▸ API Keys** (or **Project Settings ▸ API**):
- **Project URL** – looks like `https://abcdefghijkl.supabase.co`
- **Publishable key** – starts with `sb_publishable_…` (or the legacy **anon public** key, a long `eyJ…` text)

Send only these two values. They are designed to be public: Row Level Security in `schema_v2.sql` is what protects your data.

## What Claude does next (nothing goes live without your approval)
1. Puts the two values in a local, git-ignored `.env.local` and builds a **test** version on `localhost`.
2. Signs in with the **test** account only, and verifies against the real database: sign-in, private records,
   the test account cannot see your records, saving, retry safety, conflicts, offline queue, sign-out.
3. Migrates a copy of your backup file into your account only after you confirm, then compares all 616 deliverables.
4. Asks for your approval before anything is deployed.
