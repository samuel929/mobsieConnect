# Mobsie Control Centre handover

This is an editable Next.js application. The original visual design is retained, while authentication, API handlers, Neon persistence, Cloudinary uploads, pagination, exports, attendance, calendar management, and shop operations are implemented server-side.

## Project structure

```text
app/(control-centre)/*/      One editable/discoverable page route per screen
app/                         Layout, login, home redirect, and global styles
components/                  App shell and modular legacy-compatible UI
components/legacy/pages/     Feature screens grouped by domain
pages/api/                   Typed API routes
server/                      Auth, database, errors, rate limits, uploads, validation
db/migrations/               Ordered PostgreSQL migrations
scripts/                     Migration and seed runners
public/                      Static assets
tests/                       Automated API/security tests
```

The retired SMS, Email Campaign, Discount, Interviews, Media Library, Analytics, and Support Ticket modules are absent from navigation, route generation, generic model APIs, persistence, and exports.

## Main editable feature files

- `components/legacy/pages/platform.js`: schools, campuses, branches
- `components/legacy/pages/admissions.js`: applications and waiting list
- `components/legacy/pages/people.js`: learners, parents, teachers, profiles
- `components/legacy/pages/academics.js`: attendance, homework, reports, calendar
- `components/legacy/pages/shop.js`: products, orders, and inventory
- `components/legacy/app-core.js`: navigation and route wiring
- `app/globals.css`: shared controls and responsive styling

## Database-backed functionality

- Campus and application forms use validated inputs and live branch choices.
- Teacher images upload through Cloudinary and appear in teacher profiles.
- Attendance stores per-child present/absent status by branch, class, and date.
- Calendar filtering uses real event dates, branch, category, and month.
- Products, Cloudinary images, stock adjustments, orders, and order statuses persist in Neon.
- CSV exports are role-authorized and generated from persisted state.

Run `npm run db:migrate` after configuring `.env.local`; migration `004_attendance_and_shop.sql` creates the attendance and commerce tables. Run `npm run db:seed` for initial products and a sample order.

## Local setup

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Use `/login` to enter the Control Centre. Principals have full access; teachers are restricted to learner and academic sections in both middleware and API authorization.

## Verification

```bash
npm run typecheck
npm test
npm run build
```
