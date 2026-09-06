# CAGE Operations Hub

Production export of CAGE Operations Hub, upgraded with secure authentication, administrator-managed accounts and roles, a complete recruitment and employee-records module, a public careers application page, a shared PostgreSQL database, row-level permissions, real-time synchronization, audit logging, private file storage, email delivery functions, daily opportunity monitoring, backups and repeatable deployment files.

## Production stack

- Front end: the existing CAGE HTML/CSS/JavaScript interface
- Database, sign-in, storage, real-time updates and server functions: Supabase
- Recommended hosting: Cloudflare Pages
- Transactional email: Resend
- Source control and automatic deployments: GitHub Actions

Start with [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md). Architecture and security details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and the go-live sequence is in [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).

## Local commands

```bash
npm install
cp .env.example .env
npm run build
npm run check
npm run dev
```

Do not commit `.env`, service-role keys, email API keys, cron secrets or Cloudflare tokens.
