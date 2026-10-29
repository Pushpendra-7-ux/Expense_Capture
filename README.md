# Expense Capture (OPE) — Dexter Capital

Expense Capture (OPE) is a web-first expense capture and review app for Dexter Capital investment bankers. Employees log out-of-pocket expenses in the field in about 30 seconds: snap a bill or upload proof, let Gemini pre-fill the claim, check it, and submit. Finance then reviews every claim in a desktop console, sees the exact stored Gemini reading, and approves, rejects, or requests more information.

There is no login, signup, password, or OTP. A role selector at `/` switches between two client-side workspaces and remembers the choice in `localStorage`. The employee experience is mobile-first with a responsive desktop composition (persistent sidebar at lg+, KPI dashboard, spending charts, and a filterable expense table) and employee-facing analytics. The finance experience is desktop-first with tables and a dashboard, and remains usable on phones.

---

## 🏗️ Architecture & Stack

- **Frontend**: React 18, Vite 5, TypeScript, React Router 6, Tailwind CSS 3.4, Lucide icons, Recharts.
- **Backend**: FastAPI (Python 3.11+), Pydantic v2, SQLAlchemy 2 async with `asyncpg`, Alembic, PostgreSQL 16.
- **AI extraction**: Google GenAI SDK with a Gemini Flash fallback cascade, `temperature=0.0`, structured output, and high media resolution for receipts.
- **Image handling**: HEIC/HEIF converted to JPEG in the browser with `heic2any`; all images compressed to a maximum 1600px long edge at JPEG quality 0.85 before upload.
- **Storage**: Attachments are stored as PostgreSQL `bytea` and served through claim-scoped endpoints.
- **Design system**: Inter, warm cream/paper surfaces, ink `#0B0B0F` cards, gray borders, amber highlights, and green/amber/red statuses. Shared `Button`, `Card`, `Badge`, `Chip`, `Input`, `Modal`, and state components are used across both workspaces.

---

## 🧭 Routes

| Route | Purpose |
|---|---|
| `/` | Role selection (Employee / Finance) |
| `/employee` | Desktop: greeting, 4 KPIs, spending chart, category breakdown, attention strip, filterable expense table. Mobile: month total hero, category chips, and expense rows |
| `/employee/analytics` | Period-filtered KPIs, spend trend chart, status breakdown, category breakdown with detail, and CSV export |
| `/employee/snap` | Camera/file bill capture and AI extraction |
| `/employee/no-bill` | Payment proof or manual no-receipt claim |
| `/employee/review` | Editable AI draft and submit |
| `/employee/confirmation` | Submitted claim reference and amount |
| `/employee/expenses/:id` | Read-only employee claim detail |
| `/finance` | Claims queue, filters, sorting, pagination |
| `/finance/claims/:id` | Claim review with bill, AI flags, line items, decision panel |
| `/finance/analytics` | Four KPIs and two approved-spend charts |
| `*` | Redirects to `/` |

---

## 📁 Repository Structure

```
Expense_Capture/
├── docker-compose.yml              # Local PostgreSQL 16
├── .env.example
├── README.md
├── design/                         # Reference designs and brief
├── samples/                        # Synthetic receipt images/PDFs + expected.json
├── backend/
│   ├── alembic/                    # Async migrations (schema + review metadata)
│   ├── app/
│   │   ├── config.py               # Settings and CORS origins
│   │   ├── database.py             # Async engine/session
│   │   ├── models.py               # Users, expenses, attachments, cache, rate limits
│   │   ├── schemas.py              # Validation and API schemas
│   │   ├── storage.py              # PostgreSQL bytea storage backend
│   │   ├── file_validation.py      # Magic bytes, size limits, PDF page checks
│   │   ├── crud.py                 # Create, duplicate detection, review status mapping
│   │   ├── extraction_service.py   # Gemini extraction, verification, fallbacks
│   │   ├── seed.py                 # Idempotent demo user and 7 claims
│   │   └── main.py                 # FastAPI app and routes
│   ├── scripts/eval_extraction.py  # Gemini evaluation harness
│   └── tests/                      # 69 backend tests
└── frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── vercel.json                 # SPA rewrite for static deployment
    ├── src/
    │   ├── App.tsx                 # Routes and 404 redirect
    │   ├── main.tsx
    │   ├── index.css
    │   ├── context/RoleContext.tsx # Employee/finance role persistence
    │   ├── components/
    │   │   ├── ui/                 # Shared design system
    │   │   ├── employee/           # Employee layout, sidebar, KPI card, chart tooltip
    │   │   └── finance/            # Finance sidebar/drawer shell
    │   ├── pages/
    │   │   ├── role-select/
    │   │   ├── employee/           # Feed/overview, analytics, snap, no-bill, review, detail
    │   │   └── finance/
    │   └── lib/
    │       ├── api.ts              # API client, types, categories, constants
    │       ├── analytics.ts        # Employee + finance KPI/chart aggregation
    │       ├── extraction.ts       # Gemini draft summaries and flags
    │       ├── image.ts            # HEIC conversion and compression
    │       ├── draftStore.ts       # Session draft/confirmation state
    │       ├── fallbackDraft.ts    # Manual draft when AI is unavailable
    │       ├── format.ts           # INR paise, IST dates/times
    │       ├── status.ts           # Status copy and tones
    │       ├── cn.ts               # Class name utility
    │       └── hooks.ts            # Reload-on-focus, media query hooks
    └── package.json
```

---

## 🚀 Running Locally

### Prerequisites

- Docker & Docker Compose
- Python 3.11+
- Node.js 18+ and npm

### 1. Database

```bash
docker-compose up -d
```

PostgreSQL runs on `localhost:5432` with database `ope_dev`, user `ope_user`, and password `ope_local_pass`.

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add GEMINI_API_KEY
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Verify:

```bash
curl http://localhost:8000/health
```

On startup the backend seeds one user and seven curated claims (₹3,420.50 total) with stored Gemini extraction snapshots. The seed is idempotent.

### 3. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev
```

Open `http://localhost:5173`. The backend allows `http://localhost:5173` and `http://localhost:4173` by default.

### 4. Production build check

```bash
cd frontend
npm run typecheck
npm run build
npm run preview
```

---

## 🧑‍💼 Employee Flow

1. Open `/employee` to see the workspace overview.
   - **Mobile** (< 768px): dark hero card with month total and pending count, category filter chips, and a scrollable expense list. Bottom dock has Expenses, Analytics, Snap, and No-bill.
   - **Tablet** (768–1023px): header tabs replace the bottom dock; content fills the screen.
   - **Desktop** (≥ 1024px): persistent dark sidebar (workspace info, Overview/Analytics/Snap/No-bill nav, promo card, help modal, profile), breadcrumbs header, greeting with KPI row (total, awaiting review, approved, receipt coverage), attention strip for rejected claims, cumulative spending chart, category breakdown card, and a tabbed/searchable expense table.
2. **Analytics** at `/employee/analytics` provides period-filtered (this month / last 3 months / all time) KPIs, a daily or monthly spend trend bar chart, claims-by-status breakdown, category breakdown with percentages and averages, and a one-click CSV export.
3. **Snap a bill** uses `<input type="file" accept="image/*" capture="environment">` on supported devices, with a gallery/file fallback. Up to three images or PDFs can be attached to one bill.
3. HEIC/HEIF files are converted to JPEG, and images are compressed before upload. PDFs are capped at 10 MB and five pages.
4. **No bill** lets employees upload a payment screenshot or create a manual claim when nothing is attached.
5. AI extraction pre-fills amount, date, merchant, category, purpose, tax, reference numbers, and line items. Confidence and verification flags are shown for review.
6. Submitting creates an `OPE-XXXXXX` claim. The confirmation screen shows the reference and amount, and the new claim appears at the top of the feed.
7. Claim detail shows the current status, finance note, attachments, line items, and extracted values.

If Gemini is unavailable, the bill is still uploaded and the employee continues with a manual draft.

---

## 🏦 Finance Flow

- **Claims queue**: all claims with search across merchant/reference/purpose, category and date filters, status chips with counts, sortable columns, and a dark review-queue summary showing pending amount/count plus approved/rejected counts.
- The list initially shows three claims. **More transactions** reveals the full list, then paginates at 10 per page. Filters reset the preview.
- **Claim detail**: dark claim summary, bill/receipt beside extracted fields, AI flags, line-item reconciliation, employee identity and submission metadata, finance notes, and a decision panel.
- Decisions: **Approve** (comment optional), **Request info** (comment required, moves the claim to `under_review`), **Reject** (comment required).
- **Analytics**: approved spend, pending spend, total claims, approval rate, spend by category, and spend over the last six months. Metrics are computed client-side from all fetched claims.
- Tables become stacked cards below 768px, and the sidebar becomes a drawer below 1024px. All routes work from 360px to 1920px without horizontal scrolling.
- Decisions reload automatically in both workspaces via focus refresh, so a finance change appears in the employee feed and detail.

---

## 🔌 API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/health` | Service check |
| `POST` | `/expenses/extract` | Upload up to 3 files + optional note; returns an AI draft |
| `POST` | `/expenses/attachments` | Persist attachments before manual submission |
| `POST` | `/expenses` | Create a claim (requires `Idempotency-Key`) |
| `GET` | `/expenses` | Cursor-paginated claim feed |
| `GET` | `/expenses/{identifier}` | Claim by UUID or OPE reference |
| `PATCH` | `/expenses/{identifier}/review` | `approve`, `reject`, or `request_info` |
| `GET` | `/expenses/{identifier}/attachments/{attachment_id}` | Claim-scoped attachment |
| `GET` | `/attachments/{attachment_id}` | Draft-scoped attachment |

Review payload:

```json
{
  "action": "approve | reject | request_info",
  "note": "Required for reject/request_info",
  "reviewer": "Finance Team • OPE"
}
```

Status mapping:

- `approve` → `approved`
- `reject` → `rejected`
- `request_info` → `under_review`

The endpoint is intentionally unauthenticated in this prototype; production role enforcement belongs on the server.

---

## 🧪 Tests

```bash
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests/ -q
```

The 69 backend tests cover:

- Paise conversion, amount ceilings, future dates, merchant/reason/category validation
- OPE reference generation and idempotent creation
- Magic-byte checks, file size/page limits, encrypted PDFs, batch limits
- Extraction caching, verification, typed-note overrides, currency and multi-bill notices
- Duplicate detection and attachment ownership
- Cursor pagination and category labels
- Review decisions including `request_info` note validation
- Itemized bills, unreadable amounts, and reconciliation warnings

Frontend checks:

```bash
cd frontend
npm run typecheck
npm run build
```

---

## 📊 Gemini Evaluation

```bash
PYTHONPATH=backend backend/.venv/bin/python3 backend/scripts/eval_extraction.py --thinking low
PYTHONPATH=backend backend/.venv/bin/python3 backend/scripts/eval_extraction.py --thinking high
```

The script compares extraction against `samples/expected.json` and reports field accuracy, latency (p50/p95), and token usage.

---

## 🚀 Deployment

### Backend

- Provision PostgreSQL 16+ and set `DATABASE_URL`.
- Run `alembic upgrade head`.
- Start with `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- Set `GEMINI_API_KEY`, `FRONTEND_ORIGINS=https://your-frontend.example`, and `TRUSTED_PROXY=true` behind a load balancer.
- Never expose the Gemini key to the frontend.

### Frontend

- Deploy `frontend/` to Vercel, Netlify, Cloudflare Pages, or any static host.
- Build command: `npm run build` (runs TypeScript checking and Vite).
- Output directory: `dist`.
- Set `VITE_API_BASE_URL=https://your-backend.example`.
- `vercel.json` rewrites all paths to `index.html` for client-side routing.

---

## 🔐 Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://ope_user:ope_local_pass@localhost:5432/ope_dev` | Async PostgreSQL URL |
| `GEMINI_API_KEY` | empty | Google Gemini key (server-side only) |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Primary extraction model |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.5-flash,gemini-2.5-flash,...` | Ordered fallbacks |
| `FRONTEND_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Comma-separated CORS origins |
| `TRUSTED_PROXY` | `false` | Read client IP from `X-Forwarded-For` when true |
| `RATE_LIMIT_PER_IP` | `20` | Extractions per IP per hour |
| `DAILY_GLOBAL_CAP` | `300` | Total Gemini extractions per day |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend API base URL, injected at build time |

---

## ❄️ Cold Starts, Rate Limits & Storage

- Free hosting tiers may sleep. The frontend's first API request can take a few seconds while the backend wakes.
- `/expenses/extract` is public and rate-limited: 20 requests/hour per IP and 300 extractions/day globally, backed by PostgreSQL.
- Images are compressed client-side; PDFs are capped at 10 MB and 5 pages.
- Orphan attachments are deleted after 24 hours by the startup cleanup job.
- PostgreSQL free tiers are small, so attachments use compressed JPEGs and page-limited PDFs.

---

## ⚠️ Known Limitations

1. **Unauthenticated prototype**: All claims belong to the single seeded user. The employee/finance switch is client-side, and the review endpoint trusts the supplied reviewer label. Server-side authentication and role enforcement are out of scope.
2. **Client-side analytics**: Both employee and finance analytics aggregate up to 5,000 fetched claims in the browser rather than a dedicated reporting service.
3. **AI variability**: Free-tier Gemini keys can return 503s or lower-quality reads. The app always falls back to a manual draft, and verification flags ask the employee or reviewer to check uncertain fields.
4. **Demo data**: The seeded claims and synthetic receipts are for demonstration only. Do not use real receipts with free-tier API keys.

---

## 🔒 Privacy & AI Notice

The Gemini extraction pipeline sends receipt and payment-document images to Google for processing. On free-tier keys, Google may use prompt content for model improvement; use synthetic or sanitized documents when testing. AI coding tools were used in the design, architecture, and development of this codebase.
