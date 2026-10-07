# Civica — Backend

Node.js + Express REST API for Civica.

## Tech stack

- **Runtime** — Node.js `^20.19 || ^22.12 || >=24`
- **Framework** — Express.js
- **Database** — PostgreSQL via **Prisma 7** (`@prisma/adapter-pg`, typically Supabase)
- **Auth** — JWT (access + httpOnly refresh), bcryptjs
- **Validation** — Zod
- **Security** — helmet, cors, express-rate-limit
- **Documents** — multer; local disk and/or Vercel Blob / Supabase Storage
- **PDFs / Excel** — pdfkit, exceljs, qrcode

Runtime persistence is confirmed by `GET /api/health` → `persistence: "postgresql-prisma"`.  
`data/db.json` is **not** used at runtime; it is only a source for `npm run db:import:legacy`.

Domain services still speak a Mongo-like API (`find`, `_id`) through [`src/db/prismaCollection.js`](src/db/prismaCollection.js).

## Folder structure

```
backend/
├── api/index.js              # Vercel Express entry
├── prisma/                   # schema.prisma, migrations, seed
├── scripts/                  # import/verify/helpers
├── src/
│   ├── config/               # env, prisma, supabase, permissions
│   ├── db/                   # prismaCollection adapter
│   ├── middlewares/          # auth, validate, errorHandler, notFound
│   ├── modules/              # feature modules (routes/controller/service/model)
│   ├── seeds/
│   ├── services/             # notification channel stubs, etc.
│   ├── utils/
│   ├── app.js
│   └── server.js
├── data/db.json              # legacy import source only
├── uploads/                  # local document files
├── .env.example
└── package.json
```

## Getting started

1. **Install**

   ```bash
   cd backend
   npm install
   ```

2. **Configure**

   ```bash
   cp .env.example .env
   ```

   Required: `DATABASE_URL`, `DIRECT_URL`, JWT secrets, `CORS_ORIGIN`, seed super-admin credentials.  
   Optional: Supabase URL/keys and storage bucket names (see `.env.example`).

3. **Migrate**

   ```bash
   npm run prisma:deploy
   # local iterative: npm run prisma:migrate
   ```

4. **Seed**

   ```bash
   npm run seed
   ```

5. **Run**

   ```bash
   npm run dev
   ```

6. **Verify**

   ```bash
   curl http://localhost:5000/api/health
   # → { "success": true, "data": { "persistence": "postgresql-prisma", "database": "up", ... } }
   ```

## NPM scripts (selected)

| Script | Description |
|--------|-------------|
| `npm run dev` | Nodemon API server |
| `npm start` | Production Node server |
| `npm run seed` | Roles, admin, numbering, RBAC, recovery, HR payroll, phase15 |
| `npm run seed:development` | Full demo chain + invoice backfill |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Dev migrations |
| `npm run prisma:deploy` | Apply migrations |
| `npm run db:import:legacy` | Import `data/db.json` → Postgres |
| `npm run storage:import` | Import local uploads to Blob (when configured) |

## API response format

```jsonc
// Success
{ "success": true,  "message": "…", "data": { … } }

// Error
{ "success": false, "message": "…", "errors": [] }
```

## Auth and authorization

- Bearer **access JWT**; **refresh** via httpOnly cookie `refreshToken` (and/or body)
- Routes: `authenticate` + `authorize("moduleKey", "action")`
- Actions: `view|create|edit|delete|approve|reject|cancel|print|export|refund`
- Super Admin bypasses checks; others use `RoleModuleAccess`

Module mounts live in [`src/app.js`](src/app.js) (`/api/auth`, `/api/members`, `/api/plots`, `/api/payments`, `/api/recovery`, lifecycle routes, HR, security, procurement, …).

## Background jobs

`startRecoveryScheduler()` in `server.js` runs the recovery auto-block check (skipped on Vercel; disable with `RECOVERY_JOB_ENABLED=false`). No Redis/queue workers.

## Vercel deployment

Live frontend origin accepted by default:

- `https://housing-society-erp-frontend.vercel.app`

Typical production env:

```bash
NODE_ENV=production
DATABASE_URL=<pooled supabase uri>
DIRECT_URL=<direct uri for migrate/deploy CI>
CORS_ORIGIN=https://housing-society-erp-frontend.vercel.app
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
JWT_ACCESS_SECRET=<long-random-secret>
JWT_REFRESH_SECRET=<different-long-random-secret>
```

`vercel.json` routes Express through `api/index.js`. Prefer a **private** Blob store if using Vercel Blob for documents.

## Notifications

Email, SMS, and WhatsApp implementations under `src/services/notificationChannels/` are intentional **stubs** (`status: "stubbed"`). Overdue recovery reminders use in-app notifications.
