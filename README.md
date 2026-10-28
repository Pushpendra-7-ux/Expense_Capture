# Expense Capture (OPE) — Dexter Capital

Expense Capture (OPE) is a phone-first, single-purpose web application designed for Dexter Capital investment bankers to log out-of-pocket expenses (OPE) in the field in ~30 seconds.

Employees log expenses standing up, in a hurry, right as they get into a cab. The product focuses strictly on this 30-second capture flow: snap a bill (or upload proof) -> auto-fill -> confirm and submit.

---

## 🏗️ Architecture & Stack

- **Frontend**: React Native with Expo (SDK 53), exported as a web build (`react-native-web`). Mobile-first viewport (max 420px on desktop, fluid on mobile).
- **Backend**: FastAPI (Python 3.11+, async), Pydantic v2, SQLAlchemy 2 (async with `asyncpg`), Alembic migrations.
- **Database**: PostgreSQL 16 (local via `docker-compose`).
- **AI Extraction**: Google GenAI SDK (`google-genai`), using `gemini-3.8-flash` with `thinking_level="low"`, `media_resolution="media_resolution_high"`, and `temperature=0.0`.
- **Styling**: Single theme file (`theme.ts`) defining color tokens, typography (Inter), spacing, radii, and elevation shadows matching the Dexter design language.

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
│   │       └── 001_initial_schema.py   # Full schema: 5 tables, 4 enums, indexes
│   ├── alembic.ini
│   ├── app/
│   │   ├── config.py         # Pydantic Settings (.env loader)
│   │   ├── database.py       # Async engine & sessionmaker (asyncpg) with lazy init
│   │   ├── models.py         # SQLAlchemy 2.0 ORM models (paise BigInt, enums)
│   │   ├── schemas.py        # Pydantic v2 validation schemas & AttachmentInfo
│   │   ├── storage.py        # StorageBackend interface & PostgreSQL bytea implementation
│   │   ├── file_validation.py # Magic-byte, size (<=5MB img, <=10MB PDF), and pypdf page limits
│   │   ├── crud.py           # Idempotent create, OPE- reference ID, duplicate check
│   │   ├── seed.py           # Idempotent seed: 1 user, 10 Indian sample expenses
│   │   └── main.py           # FastAPI app, /expenses, /expenses/attachments, /health
│   ├── tests/
│   │   ├── test_phase2.py    # 14 unit tests for validation, paise, idempotency
│   │   ├── test_phase3.py    # 13 unit tests for magic bytes, PDF checks, size limits
│   │   └── test_phase4.py    # 10 unit tests for extraction caching, verification, and rate limiting
│   ├── requirements.txt
│   ├── .env.example
│   └── .env
└── frontend/
    ├── app/                  # Expo Router file-based screens
    │   ├── _layout.tsx       # Root stack navigator & theme container
    │   ├── index.tsx         # Welcome screen (Employee, Finance, Admin cards)
    │   ├── home.tsx          # Expenses feed (summary bar, action cards, FAB)
    │   ├── snap.tsx          # Snap a bill (tips card, camera, PDF/photo picker, +Add chip)
    │   ├── no-bill.tsx       # No bill screen (payment proof & supporting doc slots, optional note)
    │   ├── review.tsx        # Review form (thumbnails with remove, 5 fields, sticky submit)
    │   ├── confirmation.tsx  # Confirmation screen (full-screen checkmark, ref ID)
    │   └── expense/
    │       └── [id].tsx      # Expense detail (read-only, IST time, single Submitted pill)
    ├── components/
    │   └── PDFCard.tsx       # PDF document card with View action
    ├── assets/
    ├── theme.ts              # Single source of truth for design tokens
    ├── utils/
    │   ├── api.ts            # Fetch wrapper: uploadAttachments, submitExpense, fetchExpenses
    │   ├── format.ts         # INR formatting (paise to ₹), IST dates & times
    │   └── image_processing.ts # Client-side HEIC-to-JPEG & canvas compression (max 1600px, 0.85)
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
- 10 realistic Indian sample expenses (Uber, Ola, Swiggy, Blue Tokai, Taj Hotel, Vodafone, Amazon, BigBasket, Chai Point, IndiGo Airlines) in integer paise.
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

---

## 🧪 Running Tests

Run the full backend test suite:
```bash
PYTHONPATH=backend python3 -m pytest backend/tests/ -v
```
All 35 tests verify:
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
- Safe fallback draft on timeout or budget expiry (never blocking user manual flow)

---

## 🔐 Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://ope_user:ope_local_pass@localhost:5432/ope_dev` | Async PostgreSQL connection string |
| `GEMINI_API_KEY` | `""` | Google Gemini API key |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model ID for extraction |
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
   - **No bill screen (`app/no-bill.tsx`)**: "Add payment proof" and "Add supporting doc" slots, "1 of 3" counter, optional note (max 500 chars), "Fill it in myself" skip link.
   - **Client-Side Image Processing**: HEIC/HEIF to JPEG browser conversion via `heic2any`, canvas compression (max 1600px long edge, JPEG quality 0.85, never below legibility), PDFs untouched.
   - **Attachment Storage & Serving**: `StorageBackend` interface with PostgreSQL BYTEA storage, serving endpoints (`GET /expenses/{id}/attachments/{aid}`, `GET /attachments/{aid}`) with stored Content-Type, `X-Content-Type-Options: nosniff`, and `inline` disposition.
   - **File Validation**: Strict magic-byte checks, <=5 MB per image, <=10 MB and <=5 pages per PDF, encrypted PDF rejection, max 3 files total.
   - **Orphan Cleanup**: Automated 24h cleanup on startup and scheduled sweeps.
4. **Phase 4 — Gemini Extraction & Verification**:
   - **Gemini Flash Model**: `gemini-3.8-flash` with `thinking_level="low"`, `media_resolution="media_resolution_high"`, and `temperature=0.0`.
   - **Extraction Endpoint (`POST /expenses/extract`)**: Multipart 0-3 files + optional user note.
   - **Postgres Extraction Cache**: Keyed by `sha256(sorted file hashes | normalized note | today IST)`. Zero duplicate Gemini calls.
   - **Rate Limiting**: PostgreSQL-backed per-IP hourly limit (20 req/hr) and global daily cap (300 req/day with `__global__` sentinel row).
   - **Code-Side Verification**: Integer paise conversion, subtotal + tax reconciliation, typed note amount override, foreign currency notices, future date reset, multiple distinct bills detection.
   - **Graceful Fallback**: Returns draft object even on timeout/budget expiry with status `failed` so user is never blocked from filing manually.
   - **Evaluation Script (`backend/scripts/eval_extraction.py`)**: Runs sample receipts comparing accuracy and timing with `--thinking low/high`.

---

## 🔒 Privacy & AI Notice

- **Privacy**: The Gemini extraction pipeline operates on receipts and expense documents. On free-tier API keys, Google may use prompt content for model improvement; use only synthetic or sanitized sample bills for testing.
- **AI Coding Tool Notice**: AI coding tools (Antigravity by Google DeepMind) were used in the design, architecture, and development of this codebase.
