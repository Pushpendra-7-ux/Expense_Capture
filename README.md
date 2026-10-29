# Expense Capture (OPE) — Dexter Capital

Expense Capture (OPE) is a phone-first, single-purpose web application designed for Dexter Capital investment bankers to log out-of-pocket expenses (OPE) in the field in ~30 seconds.

Employees log expenses standing up, in a hurry, right as they get into a cab. The product focuses strictly on this 30-second capture flow: snap a bill (or upload proof) -> auto-fill -> confirm and submit. A finance workspace then reviews every claim, opens the exact Gemini reading, and approves or rejects the payment.

The interface is responsive by design: mobile widths follow the reference screens, while screens 1024px and wider use a persistent sidebar, wide claim feed, and two-column capture, review, and finance workspaces.

---

## 🏗️ Architecture & Stack

- **Frontend**: React Native with Expo (SDK 53), running natively on iOS/Android and exported as a responsive web build (`react-native-web`). Mobile widths match the reference screens; desktop widths (>=1024px) use a persistent sidebar and multi-column workspaces.
- **Backend**: FastAPI (Python 3.11+, async), Pydantic v2, SQLAlchemy 2 (async with `asyncpg`), Alembic migrations.
- **Database**: PostgreSQL 16 (local via `docker-compose`).
- **AI Extraction**: Google GenAI SDK (`google-genai`) with a Gemini Flash fallback cascade, `temperature=0.0`, structured output, and `media_resolution_high` for receipts.
- **Finance workflow**: Role-based employee/finance workspaces with no login or mock authentication. The finance console lists every claim, exposes the stored Gemini extraction, and records approve/reject decisions with a reviewer label and optional note.
- **Styling**: Single theme file (`theme.ts`) defining warm paper/ink/amber tokens, typography, spacing, radii, and elevation shadows matching the Dexter design language.

---

## 📁 Repository Structure

```
Expense_Capture/
├── docker-compose.yml        # Local PostgreSQL container definition
├── .env.example              # Root environment template
├── .gitignore
├── README.md
├── design/                   # Reference designs and brief
├── backend/
│   ├── alembic/              # Async Alembic migrations
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 001_initial_schema.py     # Full schema: 5 tables, 4 enums, indexes
│   │       ├── 002_review_metadata.py    # Display/review metadata columns
│   │       └── 003_finance_review.py     # Rejected status, reviewed_at, review_note
│   ├── alembic.ini
│   ├── app/
│   │   ├── config.py         # Pydantic Settings (.env loader)
│   │   ├── database.py       # Async engine & sessionmaker (asyncpg) with lazy init
│   │   ├── models.py         # SQLAlchemy 2.0 ORM models (paise BigInt, enums)
│   │   ├── schemas.py        # Pydantic v2 validation schemas & AttachmentInfo
│   │   ├── storage.py        # StorageBackend interface & PostgreSQL bytea implementation
│   │   ├── file_validation.py # Magic-byte, size (<=5MB img, <=10MB PDF), and pypdf page limits
│   │   ├── crud.py           # Idempotent create, OPE- reference ID, duplicate check, review
│   │   ├── seed.py           # Idempotent seed: 1 user, 7 curated claims (₹3,420.50) with Gemini drafts
│   │   └── main.py           # FastAPI app, /expenses, /expenses/extract, /expenses/attachments, /health
│   ├── tests/
│   │   ├── test_phase2.py    # Validation, paise, idempotency
│   │   ├── test_phase3.py    # Magic bytes, PDF checks, size limits
│   │   ├── test_phase4.py    # Extraction caching, verification, itemized bills, rate limiting
│   │   ├── test_phase5.py    # Pagination, category labels, feed response
│   │   ├── test_phase6.py    # API endpoints and mobile edge cases
│   │   └── test_api_endpoints.py # Review decisions, attachments ownership, API behaviour
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
└── frontend/
    ├── app/                  # Expo Router file-based screens
    │   ├── _layout.tsx       # Root stack, role provider, desktop app shell, global CSS
    │   ├── index.tsx         # Redirects to /home
    │   ├── home.tsx          # Expenses feed (summary, filters, seeded claims, FAB)
    │   ├── snap.tsx          # Bill capture → Gemini analysis → review
    │   ├── no-bill.tsx       # UPI proof/documents + optional note → Gemini → review
    │   ├── review.tsx        # Shared editable AI draft and submit
    │   ├── confirmation.tsx  # Confirmation screen (reference ID, amount)
    │   ├── finance.tsx       # Finance claims inbox: pending / approved / rejected
    │   ├── finance/
    │   │   └── [id].tsx      # Finance claim review: Gemini extraction + approve/reject
    │   └── expense/
    │       └── [id].tsx      # Read-only expense detail with IST time and attachment view
    ├── components/
    │   ├── AnalysisOverlay.tsx  # Shared bill/payment AI progress and fallback UI
    │   ├── AttachmentGrid.tsx   # Thumbnail grid for images and PDFs
    │   ├── DesktopSidebar.tsx   # Role-aware desktop navigation and workspace switch
    │   ├── ExpenseFields.tsx    # Shared fields used by the review screen
    │   ├── LineItemsCard.tsx    # Every itemized-bill row with totals and mismatch warnings
    │   ├── PDFCard.tsx          # PDF document card with View action
    │   └── RoleContext.tsx      # Client-side employee/finance role switch (no auth)
    ├── assets/
    ├── theme.ts              # Single source of truth for design tokens
    ├── utils/
    │   ├── api.ts            # Upload, extract, submit, feed, detail, review API calls
    │   ├── draft_store.ts    # Preserves the full Gemini draft from capture to review
    │   ├── extraction.ts     # Extraction summary and confidence helpers
    │   ├── file_picker.ts    # Native image/PDF pickers
    │   ├── format.ts         # INR formatting (paise to ₹), IST dates & times
    │   ├── image_processing.ts # Client-side HEIC-to-JPEG & canvas compression (max 1600px, 0.85)
    │   └── status.ts         # Shared claim status colours and labels
    ├── app.json              # Expo configuration
    ├── package.json          # Dependencies (React 19, RN 0.79, Expo 53)
    ├── tsconfig.json
    ├── .env.example
    └── .env
```

---

## 🚀 Running Locally

### Prerequisites
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+ and npm

### 1. Database Setup (Docker)
Start the PostgreSQL container:
```bash
docker-compose up -d
```
PostgreSQL runs on `localhost:5432` with database `ope_dev`, user `ope_user`, and password `ope_local_pass`.

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```
On startup, the backend automatically runs `app/seed.py`, seeding:
- User: `Pushpendra Suryawanshi` (`d290f1ee-6c54-4b01-90e6-d701748f0851`)
- 7 curated Indian claims totaling ₹3,420.50 (Uber, Blue Tokai, Taj Hotel, IndiGo, Amazon, Vodafone, The Grill) with realistic paise amounts, IST timestamps, and a stored Gemini extraction snapshot.
- One rejected Amazon Business claim with a finance note so the Rejected section is populated on first run.
- Runs 24h orphan attachment cleanup.

Verify the server:
```bash
curl http://localhost:8000/health
# {"status":"ok","timestamp":"2026-10-28T..."}
```

### 3. Frontend Setup
```bash
cd frontend

# Install npm packages
npm install

# Start Expo Web dev server
npm run web
```
The application will open at `http://localhost:8081`.

### 4. Finance Workspace

There is no login or authentication. The desktop sidebar switches between two client-side workspaces and remembers the choice in `localStorage`:

- **Employee** — `Expenses`, `Quick capture`, `No-bill claim`.
- **Finance** — `Claims inbox`, `Approved payments`, `Rejected payments`.

The finance detail screen opens every claim with:
- The submitted amount, date, payee, category, business purpose, receipt type, and attachments.
- The full Gemini extraction stored with the claim: read fields, per-field confidence, cross-checks, and model notices.
- The employee and submission metadata.
- An approve/reject decision card. Rejection requires a short reviewer note; approval notes are optional.

Decisions are persisted through:

```http
PATCH /expenses/{reference_id}/review
Content-Type: application/json

{
  "action": "approve" | "reject",
  "note": "Optional for approval; required for rejection",
  "reviewer": "Finance Team • OPE"
}
```

The updated claim is returned immediately and the employee feed/detail reflects the decision. The endpoint is intentionally unauthenticated in this prototype; authentication and server-enforced roles are out of scope.

---

## 🧪 Running Tests

Run the full backend test suite:
```bash
PYTHONPATH=backend backend/.venv/bin/pytest backend/tests/ -v
```
All 67 unit tests verify:
- Exact rupee-to-paise conversion and rounding
- Positive amount requirement and ₹10,00,000 ceiling enforcement
- Future date rejection (today and past dates allowed)
- Merchant requirement when bill/screenshot is present
- Reason character count rules (min 3 chars normally; min 10 chars when category is Other or no bill)
- All 7 predefined categories
- OPE-XXXXXX reference ID generation (alphanumeric, unique)
- Magic-byte detection (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF..WEBP`, PDF `%PDF-`)
- Image size limits (<= 5 MB) and PDF size limits (<= 10 MB)
- Rejection of fake PDFs, empty files, and batch limits (> 3 files)
- PDF encryption check and max 5-page ceiling
- Deterministic extraction cache key calculation (sha256 of sorted hashes + normalized note + today IST)
- Code-side verification: subtotal + tax reconciliation, typed note amount override, foreign currency detection, future date reset, multiple bills warning
- Safe fallback draft on timeout, budget expiry, or rate limits (never blocking manual user flow)
- Duplicate detection by transaction reference (`txn_ref`), `(merchant + amount + date)` tuple, and attachment `sha256` hash
- Trusted proxy IP extraction (`X-Forwarded-For` when `TRUSTED_PROXY=true`, socket IP when `false`)
- Audit field tracking (`edited_fields` list)
- Finance approval updates status and reviewer, rejection requires a note, and missing claims return 404
- Itemized bills keep every row (including 10+ entries), preserve unreadable amounts, and flag line-item totals that disagree with the bill
- An attachment can only be read through the claim it belongs to; mismatched claim IDs return 404

---

## 📊 Running Extraction Evaluation

Run the evaluation script to test live Gemini extraction against sample bills:
```bash
# Low thinking level (fast structured extraction)
PYTHONPATH=backend backend/.venv/bin/python3 backend/scripts/eval_extraction.py --thinking low

# High thinking level (deep extraction for ambiguous receipts)
PYTHONPATH=backend backend/.venv/bin/python3 backend/scripts/eval_extraction.py --thinking high

# Custom model override
PYTHONPATH=backend backend/.venv/bin/python3 backend/scripts/eval_extraction.py --model gemini-3.6-flash --thinking low
```
The script reads synthetic sample receipts from `samples/` against ground truth in `samples/expected.json` and outputs:
- Per-field accuracy (exact for amount and date, normalized fuzzy match for merchant)
- Latency (p50, p95)
- Success / failure breakdown and token counts

---

## 🚀 Deployment Guide

### 1. Backend + PostgreSQL (Render / Railway / Fly.io / Cloud Run)
- **Database**: Provision PostgreSQL 16 (or higher). Set `DATABASE_URL` in environment.
- **Run migrations**:
  ```bash
  alembic upgrade head
  ```
- **Start command**:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```
- **Configure environment**: Set `GEMINI_API_KEY`, `FRONTEND_ORIGINS`, `TRUSTED_PROXY=true` (when behind reverse proxy / load balancer).

### 2. Frontend Static Web Build (Vercel / Netlify / Cloudflare Pages / S3)
- **Build command**:
  ```bash
  cd frontend
  EXPO_PUBLIC_API_URL=https://your-backend-api.com npm run build:web
  ```
- **Output directory**: `frontend/dist`
- The static files can be served directly by any web server or static CDN.

---

## ❄️ Free-Tier Cold-Starts & Storage Limits

- **Free-Tier Cold Starts**: Free hosting platforms (Render, Railway, Fly.io free tiers) put inactive containers to sleep. On initial load, the frontend initiates a `/health` probe. If the server takes over 3 seconds to respond, an animated top banner notifies the user: *"Waking up the server…"*.
- **PostgreSQL 0.5 GB Free Tier Storage Limit**:
  - Image attachments are compressed client-side (max 1600px long edge, JPEG quality 0.85) before upload.
  - PDF uploads are capped at 10 MB and max 5 pages.
  - An automated 24-hour cleanup job runs on backend startup and during extraction sweeps, deleting unattached orphan files (`expense_id IS NULL AND created_at < NOW() - INTERVAL '24 hours'`).

---

## ⚠️ Known Limitations

1. **Unauthenticated Prototype**: Per specification, there is no login/auth logic. All submissions are tied to a single seeded user (`Pushpendra Suryawanshi`). The Employee/Finance workspace switch is client-side only; the review endpoint trusts the reviewer label supplied by the console. Production role enforcement would belong on the server.
2. **Rate Limits on Public Endpoint**: To protect against abuse on public unauthenticated endpoints, `/expenses/extract` enforces a 20 request/hour per-IP limit and a 300 extraction/day global cap stored in PostgreSQL. When exceeded, the app returns a graceful fallback draft so users can always enter expenses manually.
3. **Free-Tier Gemini Model Availability**: Free-tier keys experience occasional 503 high-demand spikes. Extraction starts with `gemini-3.5-flash-lite` and falls back through `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-3.6-flash`, `gemini-3.8-flash`, and `gemini-2.5-flash-lite`.
4. **Single-Purpose Scope**: Designed strictly for out-of-pocket field expenses in ~30 seconds. The finance console intentionally covers only claim review (approve/reject with a note); policy engines, accounting integrations, analytics, and gamification are out of scope.

---

## 🔐 Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://ope_user:ope_local_pass@localhost:5432/ope_dev` | Async PostgreSQL connection string |
| `GEMINI_API_KEY` | `""` | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Primary Gemini model for extraction |
| `GEMINI_FALLBACK_MODELS` | `gemini-3.5-flash,gemini-2.5-flash,gemini-3.6-flash,gemini-3.8-flash,gemini-2.5-flash-lite` | Ordered fallback models when the primary is unavailable |
| `FRONTEND_ORIGINS` | `http://localhost:8081` | Comma-separated CORS origins |
| `TRUSTED_PROXY` | `false` | When true, reads client IP from `X-Forwarded-For` |
| `RATE_LIMIT_PER_IP` | `20` | Max extractions per IP per hour |
| `DAILY_GLOBAL_CAP` | `300` | Max total Gemini extractions across all users per day |

### Frontend (`frontend/.env`)
| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL (injected at build time) |

---

## 📱 Phases Implemented

1. **Phase 1 — Skeleton & DB**: PostgreSQL via docker-compose, manual Alembic migration, seed data, /health, CORS, ONE theme file, Expo web shell with Welcome and Home screens.
2. **Phase 2 — Manual Entry End to End**: Review form (5 fields), server and UI validation, idempotent POST /expenses with OPE- reference IDs, confirmation screen, feed with date grouping and load more, expense detail screen.
3. **Phase 3 — File Capture & Storage**:
   - **Snap a bill screen (`app/snap.tsx`)**: Static tips card, "Take photo" and "Choose photo or PDF" pickers, "+ Add another photo" chip (max 3 files, all parts of ONE bill).
   - **No bill screen (`app/no-bill.tsx`)**: Minimal upload surface for UPI payment screenshots or supporting documents, an optional note about the payment, and one AI action that sends everything to Gemini. Multi-file upload (max 3), native image/PDF pickers, and a manual-entry fallback.
   - **Shared AI analysis**: `AnalysisOverlay` shows the same progress, success, manual, and retry states for bill and payment-proof analysis.
   - **Client-Side Image Processing**: HEIC/HEIF to JPEG browser conversion via `heic2any`, canvas compression (max 1600px long edge, JPEG quality 0.85, never below legibility), PDFs untouched.
   - **Attachment Storage & Serving**: `StorageBackend` interface with PostgreSQL BYTEA storage, serving endpoints (`GET /expenses/{id}/attachments/{aid}`, `GET /attachments/{aid}`) with stored Content-Type, `X-Content-Type-Options: nosniff`, and `inline` disposition.
   - **File Validation**: Strict magic-byte checks, <=5 MB per image, <=10 MB and <=5 pages per PDF, encrypted PDF rejection, max 3 files total.
   - **Orphan Cleanup**: Automated 24h cleanup on startup and scheduled sweeps.
4. **Phase 4 — Gemini Extraction & Verification**:
   - **Gemini Flash Model**: `gemini-3.8-flash` with `thinking_level="low"`, `media_resolution="media_resolution_high"`, and `temperature=0.0`.
   - **Extraction Endpoint (`POST /expenses/extract`)**: Multipart 0-3 files + optional user note + optional attachment kind (`bill`, `payment_screenshot`, `supporting`). Used by both bill capture and no-bill claims.
   - **Postgres Extraction Cache**: Keyed by `sha256(sorted file hashes | normalized note | today IST)`. Zero duplicate Gemini calls.
   - **Rate Limiting**: PostgreSQL-backed per-IP hourly limit (20 req/hr) and global daily cap (300 req/day with `__global__` sentinel row).
   - **Code-Side Verification**: Integer paise conversion, subtotal + tax reconciliation, typed note amount override, foreign currency notices, future date reset, multiple distinct bills detection.
   - **Graceful Fallback**: Returns draft object even on timeout/budget expiry with status `failed` so user is never blocked from filing manually.
   - **Evaluation Script (`backend/scripts/eval_extraction.py`)**: Runs sample receipts comparing accuracy and timing with `--thinking low/high`.
5. **Phase 5 — Feed Polish, Cursor Pagination & Abuse Protection**:
   - **Deterministic Cursor-Based Pagination**: Cursor encoding `(created_at desc, id desc)` supporting forward paging through unlimited records.
   - **Pull to Refresh**: Native `RefreshControl` integrating seamless manual re-fetching on the feed.
   - **Duplicate Detection**: Three-layer duplicate warning engine checking `txn_ref`, `(user_id, merchant, amount_minor, expense_date)`, and attachment `sha256` hash.
   - **Sentinels & Proxy IP Handling**: `TRUSTED_PROXY=true` reading `X-Forwarded-For` client IP, falling back to socket IP.
6. **Phase 6 — Mobile Polish, Accessibility & Production Edge Cases**:
   - **48 px Minimum Tap Targets**: Enforced on all interactive elements across all screens (back buttons, category chips, picker cards, remove actions, pagination buttons).
   - **Safe Areas**: `useSafeAreaInsets` integrated across sticky bottom action bars, FAB, and scroll views, preventing notch or navigation bar collision.
   - **Zero Horizontal Scroll**: Guaranteed fluid responsive layout from 320px/360px up to 420px max-width centered desktop container with global box-sizing and `overflow-x: hidden`.
   - **Local Draft Resilience & One-Tap Retry**: Active review form persists to session storage across refreshes; network submission errors feature immediate one-tap retry without lost input.
   - **Audit Field Tracking**: `edited_fields` audit array tracked when AI pre-filled fields are altered by the user before submitting.
7. **Phase 7 — No-Bill AI & Design Alignment**:
   - **AI-Assisted No-Bill Claims**: Employees upload UPI transaction screenshots or other documents and optionally describe the payment. Gemini reads every file plus the note and returns the same draft shape as bill extraction.
   - **Shared Review Handoff**: Extracted payment claims land on the same review screen, with payment-proof copy, attachment labels, and an AI summary.
   - **Resilient Fallback**: If analysis fails, uploaded evidence is still saved and the user can complete the claim manually.
   - **Reference-Aligned UI**: Expenses Feed, Quick Capture, Expense Detail, No-Bill, Review, and Confirmation share the warm paper/ink/amber theme on app and web.
8. **Phase 8 — Finance Console & Desktop Workspaces**:
   - **Role-Based Workspaces**: A persistent desktop sidebar switches between Employee and Finance views without login or mock authentication; the choice is stored locally.
   - **Claims Inbox**: Every employee claim lands in Finance with pending, approved, and rejected tabs, totals, and AI confidence.
   - **Full Claim Review**: Finance opens the claim summary, business purpose, employee metadata, attachments, and the stored Gemini extraction with per-field confidence and notices.
   - **Real Decisions**: Approve/reject actions persist through `PATCH /expenses/{identifier}/review`; rejection requires a note, and the employee feed/detail reflects the decision immediately.
   - **Desktop Layouts**: Every screen has a purpose-built desktop composition (persistent sidebar, wide feed, two-column capture/review/finance workspaces) while mobile widths stay true to the reference designs.
9. **Phase 9 — Edge-Case Hardening**:
   - **Long Itemized Bills**: Gemini asks for every visible line-item row, including 10+ entries. All rows are stored with the claim, shown on review, employee detail, and finance detail, and reconciled against the bill total. Unreadable amounts stay visible as missing values instead of disappearing.
   - **Attachment Integrity**: Every attachment is owned by exactly one claim and can only be fetched through that claim's URL. JPEG, PNG, WebP, and PDF evidence stays stored in PostgreSQL and is reopenable from both employee and finance detail forever.
   - **Complete Finance Intake**: The finance inbox pages through every claim rather than only the first 100, so a growing workspace never silently drops submissions.
   - **Return-to-Feed Refresh**: The employee feed and finance inbox reload on focus, so a claim filed in Quick Capture or No-Bill appears in Recent Activity and the finance queue immediately.
   - **Seed Coverage**: Demo data includes a 10-line Grill House bill so the itemized-receipt path is exercised on first launch.

---

## 🔒 Privacy & AI Notice

- **Privacy**: The Gemini extraction pipeline operates on receipts and expense documents. On free-tier API keys, Google may use prompt content for model improvement; use only synthetic or sanitized sample bills for testing.
- **AI Coding Tool Notice**: AI coding tools (Antigravity by Google DeepMind) were used in the design, architecture, and development of this codebase.
