# Deploy CAGE Operations Hub outside ChatGPT

This guide takes the exported Hub from a ZIP file to a private production system at `hub.cagemw.com`. The recommended setup is inexpensive, managed and appropriate for CAGE's initial seven users.

## What is already prepared

- Complete CAGE Operations Hub interface and sample workspace
- Secure email-and-password login
- Approved CAGE account roster and administrator controls
- Administrator account creation, role changes and account deactivation
- HR recruitment pipeline, employee profiles, CVs and secure documents
- Public careers page, job applications and interview scheduling
- Shared PostgreSQL state with concurrency protection
- Row Level Security, audit history and private file-storage policies
- Real-time team updates
- Quote and invoice email delivery through Resend
- Daily opportunity scanning with alerts
- Manual JSON backup and restore
- Cloudflare Pages security and routing files
- Docker/Nginx alternative and GitHub Actions deployment

The only items that cannot be embedded are account-specific credentials: Supabase keys, Resend key, Cloudflare token, DNS ownership and user passwords.

## Expected cost

| Stage | Hosting | Database/auth/storage | Email | Expected infrastructure cost |
|---|---|---|---|---|
| Staff pilot | Cloudflare Pages Free | Supabase Free | Resend Free | **US$0/month** within free allowances |
| Recommended production | Cloudflare Pages Free | Supabase Pro | Resend Free initially | **About US$25/month** plus existing domain cost |
| Higher email volume | Cloudflare Pages Free | Supabase Pro | Resend Pro | **About US$45/month** |

Official pages: [Supabase pricing](https://supabase.com/pricing), [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/), [Resend pricing](https://resend.com/pricing).

Start on free plans for the controlled pilot. Move Supabase to Pro before the Hub becomes CAGE's only authoritative system, because the paid plan includes daily backups and support.

## 1. Put the source in CAGE's GitHub

1. Create or sign in to a CAGE-owned GitHub account at <https://github.com/>.
2. Create a **private** repository named `cage-operations-hub`.
3. Extract `CAGE_Operations_Hub_Production_Export.zip` on the Mac.
4. Open Terminal inside the extracted folder and run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial production CAGE Operations Hub"
git remote add origin https://github.com/YOUR-CAGE-ACCOUNT/cage-operations-hub.git
git push -u origin main
```

Keep the repository private. Never upload `.env` or secret keys.

## 2. Create the Supabase backend

1. Open <https://supabase.com/dashboard> and create a CAGE-owned organization.
2. Create a project named `cage-operations-hub` in the nearest suitable region.
3. Generate and securely record a strong database password.
4. Open **SQL Editor**, create a query, paste all of `supabase/migrations/001_initial_schema.sql`, and click **Run**.
5. In a new query, run all of `supabase/migrations/003_hr_and_role_management.sql`.
6. Confirm the core tables plus `employee_profiles`, `employee_documents`, `job_openings`, `job_applications` and `interviews` exist.
7. Under **Project Settings → API**, copy the Project URL and public anon/publishable key.
8. Never put the service-role key in the browser, repository or front-end `.env`.

The migration preloads this roster:

| User | Email | Role |
|---|---|---|
| Alexander DC Mtambo | alexander@cagemw.com | Administrator |
| Ndapile Mkuwu | ndapile@cagemw.com | Administrator |
| Comfort Claire Mwenje | comfort@cagemw.com | Member |
| Ian Mtika | ian@cagemw.com | Member |
| Mayamiko C. Ndala | mayamiko@cagemw.com | Member |
| Bonifancio Nguluwe | bonfancio@cagemw.com | Member |
| CAGE Team | info@cagemw.com | Shared/non-assignable |

## 3. Configure secure authentication

1. In Supabase, open **Authentication → URL Configuration**.
2. Set Site URL to `https://hub.cagemw.com`.
3. Add `https://hub.cagemw.com/**` as an allowed redirect URL.
4. Keep public user sign-up disabled.
5. Open **Authentication → Users → Invite user** and invite all seven approved addresses.
6. Each person opens the invitation and sets a personal password.
7. Test Alexander first. His first sign-in initializes the shared workspace.

Official authentication guide: <https://supabase.com/docs/guides/auth/passwords>.

## 4. Configure real email delivery

1. Create a Resend account at <https://resend.com/>.
2. Add and verify `cagemw.com` using Resend's DNS records.
3. Create an API key restricted to sending.
4. Install the Supabase CLI from <https://supabase.com/docs/guides/local-development/cli/getting-started>.
5. In the project folder run:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set "EMAIL_FROM=CAGE Operations <operations@cagemw.com>"
supabase secrets set APP_URL=https://hub.cagemw.com
supabase secrets set OPPORTUNITY_ALERT_TO=alexander@cagemw.com,ndapile@cagemw.com
supabase secrets set OPPORTUNITY_MIN_SCORE=80
supabase secrets set CRON_SECRET=CREATE_A_LONG_RANDOM_SECRET
supabase functions deploy send-document
supabase functions deploy admin-users
supabase functions deploy careers --no-verify-jwt
supabase functions deploy notify-interview
supabase functions deploy opportunity-scan --no-verify-jwt
```

Quotes and invoices are sent as branded HTML emails and logged in `email_log`. Formal attached PDF generation is not included in this release.

The public recruitment address will be `https://hub.cagemw.com/careers.html`. Applications and CVs are accepted by the rate-limited `careers` function; the general public never receives direct database or storage access.

## 5. Configure the daily grant and tender scan

The scanner supports public RSS/Atom feeds, keyword screening and optional AI scoring. It does not scrape private or login-protected sites. LinkedIn may only be used through an approved API or lawful feed.

1. Identify the official public feeds to monitor.
2. Set them as a comma-separated secret:

```bash
supabase secrets set "OPPORTUNITY_FEEDS=https://source-one.example/feed.xml,https://source-two.example/feed.xml"
```

3. Optional AI scoring:

```bash
supabase secrets set OPENAI_API_KEY=YOUR_KEY
supabase secrets set AI_MODEL=gpt-5-mini
```

4. Open `supabase/migrations/002_daily_opportunity_scan.sql`.
5. Replace `YOUR_PROJECT_REF` and `YOUR_CRON_SECRET`.
6. Run it once in Supabase SQL Editor. It schedules 05:00 UTC, or 07:00 Malawi time.
7. Monitor it in Supabase Cron. Guide: <https://supabase.com/docs/guides/functions/schedule-functions>.

Only strong new matches at or above the configured score are stored and emailed. A person must still verify eligibility before intake.

## 6. Build the production front end

1. Copy the configuration template:

```bash
cp .env.example .env
```

2. Set these values in `.env`:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
CAGE_ORGANIZATION_ID=00000000-0000-4000-8000-000000000001
APP_URL=https://hub.cagemw.com
```

3. Build, validate and test:

```bash
npm install
npm run build
npm run check
npm run dev
```

Open `http://localhost:4173` and test sign-in, boards, CRM, Work Chat, approvals and backup export.

## 7. Deploy on Cloudflare Pages

1. Sign in at <https://dash.cloudflare.com/>.
2. Open **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the private GitHub repository.
4. Use:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22` |

5. Add build variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CAGE_ORGANIZATION_ID`, and `APP_URL`.
6. Deploy and test the generated `*.pages.dev` address.

Official guide: <https://developers.cloudflare.com/pages/>.

## 8. Connect `hub.cagemw.com`

1. In Pages, open **Custom domains → Set up a custom domain**.
2. Enter `hub.cagemw.com`.
3. Accept the proposed DNS record or create the CNAME record at CAGE's DNS provider.
4. Wait for SSL to become active.
5. Confirm Supabase Site URL and redirect URLs use the final address.

Guide: <https://developers.cloudflare.com/pages/configuration/custom-domains/>.

## 9. Migrate current browser data

1. Follow `docs/DATA_MIGRATION.md` using the browser profile that contains Version 9 changes.
2. Sign in to production as Alexander or Ndapile.
3. Open **Reports → Import workspace backup**.
4. Verify counts across Requests, Projects, CRM, Finance and Work Chat.
5. Export a new backup and store it securely.

## 10. Controlled launch

1. Test with Alexander and Ndapile first.
2. Invite the other accounts from **User administration → Invite user**. Future account and role changes can also be made there.
3. Complete `docs/LAUNCH_CHECKLIST.md`.
4. Pilot with live but non-sensitive records for five working days.
5. Export a daily JSON backup during the pilot.
6. Only after sign-off should the Hub become CAGE's official work record and replace work-related WhatsApp communication.

## Administration and alternatives

- Add or disable people through `allowed_accounts` and Supabase Authentication.
- Do not share personal logins. CAGE Team must never receive administrator privileges.
- Review `audit_log` weekly during the pilot.
- Download a weekly JSON backup even after managed backups are enabled.
- Rotate any exposed secret immediately.
- Use separate staging and production Supabase projects before major upgrades.
- The included `Dockerfile` and `nginx.conf` can host the front end on any Docker provider; Supabase remains the backend.
