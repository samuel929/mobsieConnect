# Mobsie Connect Control Centre

After installing this update, run `npm run db:migrate`. Migration `007` adds the required
previous-school telephone and referral-source fields. Gallery photos, shared documents, team
photos, product images, and application documents use authenticated Cloudinary-backed routes;
their URLs and public IDs are persisted in Neon.

The supplied Control Centre design and its modular page structure are preserved. This version adds a Neon-backed API, Cloudinary uploads, separate admin and mobile JWT authentication, role-based dashboard access, Redis rate limiting, request throttling, search filters and pagination.

## Access model

- `PRINCIPAL`: all Control Centre routes and all administrative APIs.
- `TEACHER`: learner and academic routes only (`learners`, `attendance`, `homework`, `reports`, `calendar`). Student and academic API queries are automatically restricted to the teacher's branch.
- `PARENT`: mobile-only JWT. Parent tokens use a separate JWT audience and cannot access admin APIs.

Middleware enforces page access. Every protected API independently verifies the role, so hiding navigation is not the security boundary.

## Editing screens

Every visible screen has an individual typed Next.js App Router entry under
`app/(control-centre)/<screen>/page.tsx`. These small route files make the page
map easy to discover. The full editable layouts are grouped by feature:

| Screens | Editable layout file |
| --- | --- |
| Dashboard | `components/legacy/pages/dashboard.js` |
| Schools, branches | `components/legacy/pages/platform.js` |
| Applications, waiting list | `components/legacy/pages/admissions.js` |
| Learners, parents, teachers | `components/legacy/pages/people.js` |
| Attendance, homework, reports, calendar | `components/legacy/pages/academics.js` |
| Payments, invoices, statements | `components/legacy/pages/finance.js` |
| Messages, newsletters, push, feedback | `components/legacy/pages/comms.js` |
| Gallery | `components/legacy/pages/media.js` |
| Products, orders, inventory | `components/legacy/pages/shop.js` |
| Documents, users, roles, audit, settings | `components/legacy/pages/system.js` |

Shared visual controls are in `app/globals.css`. The route adapter is
`components/screens/EditablePage.tsx`, so any screen can be migrated from its
current `render()`/`mount()` module to a React component without changing URLs.

Normalized operational records (campuses, parents, learners, team, applications,
attendance, calendar and shop) use dedicated relational tables. Remaining
editable dashboard modules are persisted per tenant in indexed Neon JSONB state,
which powers their database pagination, filtering and exports. The parent feed
combines both stores and exposes only records belonging to the authenticated
parent.

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Create strong seed passwords in `.env.local` before running the seed:

```env
SEED_PRINCIPAL_PASSWORD=a-strong-principal-password
SEED_TEACHER_PASSWORD=a-strong-teacher-password
```

Configure Nodemailer so approving an application can email the applicant:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM="Mobsie Kids <admissions@example.com>"
```

Open [http://localhost:3000/login](http://localhost:3000/login).

## Mobile configuration

The Expo app should use:

```env
EXPO_PUBLIC_API_URL=http://YOUR-LAN-IP:3000/api
EXPO_PUBLIC_TENANT_ID=YOUR-TENANT-UUID
EXPO_PUBLIC_USE_MOCK_API=false
```

Do not use `localhost` on a physical phone.

## API routes

| Route | Access | Purpose |
| --- | --- | --- |
| `POST /api/auth/login` | Public | Principal/teacher login and secure cookie |
| `GET /api/auth/me` | Admin session | Current dashboard user |
| `POST /api/auth/logout` | Admin session | Clear dashboard session |
| `POST /api/mobile/auth/signup` | Public | Parent registration and mobile JWT |
| `POST /api/mobile/auth/login` | Public | Parent login and mobile JWT |
| `GET /api/mobile/auth/me` | Parent JWT | Restore mobile session |
| `GET /api/mobile/feed` | Parent JWT | Parent-scoped students, academics, attendance, events and content |
| `GET/POST /api/mobile/messages` | Parent JWT | Parent/school mobile messages |
| `GET/POST /api/mobile/feedback` | Parent JWT | Parent feedback stored in Neon |
| `POST /api/mobile/enrollment` | Parent JWT | Confirm enrolment and create/update learner |
| `GET/POST /api/mobile/shop/orders` | Parent JWT | Parent checkout and order history |
| `GET/POST /api/mobile-admin/messages` | Principal | View/reply to mobile messages |
| `GET/PUT /api/mobile-admin/feedback` | Principal | View/resolve mobile feedback |
| `GET/POST /api/branches` | Public read, principal write | Mobile branch feed and dashboard management |
| `GET/POST /api/team` | Public read, principal write | Mobile team feed and Cloudinary staff upload |
| `GET/POST /api/parents` | Principal | Parent directory and mobile-account invitations |
| `GET/POST /api/students` | Principal/teacher read, principal write | Learner directory and enrolment |
| `GET/POST /api/applications` | Principal read, parent/public create | Application step one |
| `PUT /api/applications/:id/preferences` | Application token | Application step two |
| `POST /api/applications/:id/documents` | Application token | Required Cloudinary document upload |
| `POST /api/applications/:id/submit` | Application token | Consent validation and Neon submission |
| `GET /api/students` | Principal/teacher | Branch-scoped search and cursor pagination |
| `GET /api/academics` | Principal/teacher | Branch-scoped filters and page pagination |
| `GET/POST /api/events` | Principal | Calendar filtering and event creation |
| `GET/PUT /api/control-centre/state` | Principal/teacher | Persist every dashboard model and modal mutation |
| `GET /api/control-centre/:model` | Principal/teacher | Server-side search, sorting and pagination |
| `GET /api/control-centre/export?model=...` | Principal/teacher | Authorized CSV exports from Neon |
| `GET /api/policies/:slug` | Public | Terms and privacy content |

List responses include pagination metadata. Search and filter parameters are applied in parameterised SQL queries backed by tenant-first compound and full-text indexes.

All legacy modal actions still use the supplied UI structure. Their existing `App.refresh()` path now saves the changed model to Neon, while branch, team, application and calendar creation also call their normalized API routes directly. Export, report, receipt, register, statement and template buttons now create real downloadable files. Table search, sorting and page controls query the server once activated instead of filtering only the current browser array.

## Request protection

- Upstash Redis sliding-window rate limits.
- Reads: 120 requests per minute per IP/route.
- Mutations: 30 requests per minute per IP/route.
- Development has a memory limiter.
- Production refuses to run unprotected if Redis is missing.
- Validation uses Zod and all database input is parameterised.
- Cloudinary secrets remain server-side.

## Checks

```bash
npm run typecheck
npm test
npm run build
```
