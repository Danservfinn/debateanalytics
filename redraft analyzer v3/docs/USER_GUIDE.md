# Redraft Analyzer — User Guide (v0.10)

This guide explains how to run the backend and frontend, configure dependencies, and use every feature (with details on how values are calculated). It also includes operational notes for production.

## 1) Prerequisites

- Python 3.11
- Node.js 20 (for the `web/` frontend)
- Postgres 15+ (for snapshots and harness metadata)
- Redis 6+ (rate limiting and idempotency; harness queue/cache)
- LM Studio (OpenAI-compatible) for the local valuation adjuster
- Optional: Docker + docker-compose (to run Postgres/Redis locally)

## 2) Environment Setup

Create a `.env` in the project root (tune values as needed):

```bash
# Core
API_BEARER_TOKEN=replace-with-strong-32+char-token
DEPLOY_ENV=dev

# Database + Redis
PERSIST_SNAPSHOTS=true
DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/redraft
REDIS_URL=redis://localhost:6379/0

# LM Studio (local)
LMSTUDIO_BASE_URL=http://localhost:1234/v1
VALUATION_ADJUSTER_MODEL=openai/gpt-oss-20b

# Analyst sources
YAHOO_JUSTIN_BOONE_URL_PATTERN=https://sports.yahoo.com/fantasy/*justin-boone*-week-*-rankings*
YAHOO_FETCH_USER_AGENT=Mozilla/5.0 (compatible; RedraftBot/0.10)
PIHS_SOURCE_URL=https://peakedinhighskool.com/fantasy-trade-value-chart/

# Calibration
CALIBRATION_VERSION_PREFIX=v0.10.c

# Feature flags
UNCERTAINTY_ENABLED=false
```

Recommended local services via Docker (optional):

```bash
docker compose up -d postgres redis
```

LM Studio: start it and ensure the model is available at `${LMSTUDIO_BASE_URL}/models` (200 or 401 is acceptable for readiness).

## 3) Backend — Run & Verify

Install deps (from repo root):

```bash
python -m pip install --upgrade pip
pip install -r requirements-dev.txt
```

Run database migrations:

```bash
alembic upgrade head
```

Start the API:

```bash
make run
# or
uvicorn src.app.api.server:app --host 0.0.0.0 --port 8000
```

Health checks:

```bash
curl -s http://127.0.0.1:8000/healthz | jq
curl -s http://127.0.0.1:8000/readyz | jq
```

Notes:
- In prod (`DEPLOY_ENV=prod`), the server fails fast if `API_BEARER_TOKEN` is empty.
- Readiness includes `sources_configured`, `staleness_ok`, `db_ok`, `redis_ok`, `lmstudio_ok`. In prod it adds `prod_ready` and `issues`.

## 4) Frontend — Run & Verify

In `web/` directory:

```bash
npm install
npm run dev
```

Open the app (default): `http://localhost:3000`.
- Players page reads from backend `/v2/players`.
- Source Harness dashboard page calls `/api/source-harness/*` (requires bearer token).

## 5) Ingestion — Running and Behavior

Trigger ingestion (manual):

```bash
curl -X POST http://127.0.0.1:8000/v2/ingest/run \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

Idempotency (safe retry):

```bash
curl -X POST http://127.0.0.1:8000/v2/ingest/run \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Idempotency-Key: run-abc-123" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Important:
- Required sources: Justin Boone (Yahoo via Grok-4 parser) and PIHS (vision → Grok-4 normalization).
- Staleness ≤ 14 days enforced; ingestion fails `422 stale_source` if required sources are stale/missing.
- Snapshots persist to Postgres when `PERSIST_SNAPSHOTS=true`.

## 6) Players — Reading Data

List (paging/sort/filter):

```bash
curl -s "http://127.0.0.1:8000/v2/players?page=1&page_size=50&sort_by=app_value&sort_dir=desc&position=RB&team=SF&name=allen" | jq
```

- `sort_by`: `app_value|baseline_score|name`
- `sort_dir`: `asc|desc` (respected for numeric sorts)
- `position`: `QB|RB|WR|TE` (optional)
- `team`: single team code (optional)
- `name`: case-insensitive substring filter (optional)

Detail (components & provenance):

```bash
curl -s http://127.0.0.1:8000/v2/players/<sleeper_id> | jq
```

- `components`: baseline_score, `vor_score`, `boone_score`, `pihs_score` (when available)
- `provenance`: `{ snapshot_ts, pipeline_version, analyst_baseline_version, analyst?, calibration? }`
- If `calibration.apply_at_read=true` and an artifact is present, response may include `baseline_score_calibrated` and `calibration_version` and provenance calibration details.

## 7) How Values Are Calculated

- Core components per player (position-specific weighting):
  - VOR (internal) → normalized [0,100]
  - Boone rank → `boone_score = 100 * max(0, (N_pos - rank + 1)/N_pos)` (QB/TE 40; RB 100; WR 120)
  - PIHS valuation → normalized [0,100] via deterministic min–max by position

- Baseline combination (rounded to 0.1):

  \[ baseline\_score = round(w\_vor * vor\_score + w\_boone * boone\_score + w\_pihs * pihs\_score, 1) \]

  Default weights:
  - QB: vor=0.70, boone=0.20, pihs=0.10
  - RB: vor=0.60, boone=0.25, pihs=0.15
  - WR: vor=0.60, boone=0.30, pihs=0.10
  - TE: vor=0.70, boone=0.20, pihs=0.10

- Local LM Studio adjuster (always on):

  - Model proposes `applied_delta ∈ [-25, +25]` (clamped); failures fall back to baseline.
  - Final value (default weight α = 0.6):

    \[ app\_value = round((1 - \alpha) * baseline + \alpha * clamp(baseline + applied\_delta, 0, 100), 1) \]

- Calibration (Stage 05; optional):
  - Order-preserving transform per position (isotonic-like), versioned `calibration_version`.
  - Applied either off-path during artifact generation or at read-time (`calibration.apply_at_read=true`).
  - Guardrails: staleness, minimum sample, quality metrics.

## 8) Models — UI Dropdown

List supported models (for UIs and future LLM features):

```bash
curl -s http://127.0.0.1:8000/v2/models | jq
```

## 9) Uncertainty (Stage 08 stubs)

- GET `/v2/players/{id}/uncertainty` → 501 with envelope when `UNCERTAINTY_ENABLED=false`.
- POST `/v2/players/{id}/uncertainty/recompute` → same gating.

## 10) Trade Analyzer (Stubs + Manual Validation)

- Endpoints exist under `/v2/trade/analyze*` and return `501 not_implemented` envelopes while disabled.
- When enabled (future): manual identity resolution and provider LLM integration apply.

## 11) Source Harness — Dashboard & Runs

Routes (bearer auth required):

- `GET /api/source-harness/dashboard.json` — JSON dashboard summary
- `GET /api/source-harness/runs?limit=50` — recent runs
- `GET /api/source-harness/runs/{run_id}` — run details
- `POST /api/source-harness/runs` — trigger a new run (idempotent)
- `GET /api/source-harness/fixtures/{run_id}/download?source=pihs` — pre-signed URL

Example — trigger run:

```bash
curl -X POST http://127.0.0.1:8000/api/source-harness/runs \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sources":["pihs","boone"]}' | jq
```

Screenshot policy: base64 screenshots are removed from JSON unless enabled in config (`cfg.harness.expose_screenshots_b64=true`).

## 12) Observability & Security

- Correlation IDs: `X-Correlation-ID` returned on responses; middleware propagates/creates IDs.
- Metrics: templated route labels (FastAPI route template preferred; fallbacks for `/api/source-harness/*`, analysis, waivers, etc.).
- Logging: headers and nested payloads redacted (Authorization, API keys, tokens, secrets, PII patterns).
- Ready checks (prod): if Redis/DB/LM Studio or sources aren’t ready/stale, readiness lists issues and `prod_ready=false` (HTTP 200 body).

## 13) OpenAPI, Contracts, and CI

Export OpenAPI:

```bash
python tools/export_openapi.py --out api/openapi_v010
```

CI (already configured):
- Validates harness routes in OpenAPI
- Spectral lint with `.spectral.yaml` (fail on error)
- Guards breaking changes with redocly diff
- Runs Newman contract tests (AJV validation)
- Runs ruff + pytest + coverage; secret scan; SBOM
- Migration idempotency tests (fresh and already-migrated DBs)

## 14) Calibration Artifacts (Optional Path)

Run weekly job (CI example exists):

```bash
python tools/run_calibration_job.py \
  --boone-url "<yahoo_article_url>" \
  --calibration-version "v0.10.cYYYYMMDD" \
  --alpha 0.05 \
  --artifact-dir reports/calibration \
  --trend-csv reports/calibration/trends.csv \
  --merged-output reports/calibration/latest_ingestion_with_calibration.json
```

Apply at read-time by setting `calibration.apply_at_read=true`.

## 15) Production Checklist (Highlights)

- `API_BEARER_TOKEN` set to a strong token; auth enforced on sensitive routes.
- Redis and Postgres reachable; in prod, in-memory fallbacks for rate limiting/idempotency are disabled.
- LM Studio accessible; `/models` returns 200/401.
- `/readyz` shows `prod_ready=true`; otherwise fix listed `issues`.
- Snapshots persisted; migrations applied; indexes present.
- OpenAPI artifacts exported; CI spectral/diff/contract tests green.
- Logging redaction enabled; secret scan clean; SBOM generated.

## 16) Common Troubleshooting

- Auth errors: verify `Authorization: Bearer <token>` and `API_BEARER_TOKEN` matches.
- Rate limit (429): reduce frequency or adjust `RATE_LIMIT_PER_MINUTE` per policy.
- Idempotency: reuse the same `Idempotency-Key` for safe retries within TTL (~600s).
- Stale sources: run Source Harness; confirm Boone/PIHS artifacts ≤ 14 days old.
- Empty `/v2/players`: ensure a successful ingestion and that snapshots exist.
- Calibration missing: verify artifacts in `reports/calibration` and config `apply_at_read=true` if you expect on-read transforms.

---

You are now ready to run the Redraft Analyzer end-to-end, explore valuations and components, review provenance and calibration metadata, and operate safely with strong observability and CI contract guards.
