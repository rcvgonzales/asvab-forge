"""
ASVAB Forge — backend.
One file: LLM proxy + static file server for the built frontend.

Pattern (same as Study Forge):
  browser -> POST /api/generate -> this proxy -> provider (Gemini free tier or Anthropic)
  API keys live server-side only (Secret Manager in Cloud Run).

Env vars:
  LLM_PROVIDER      gemini | anthropic          (default: gemini)
  GEMINI_API_KEY    required if provider=gemini
  ANTHROPIC_API_KEY required if provider=anthropic
  GEMINI_MODEL      default: gemini-2.5-flash
  ANTHROPIC_MODEL   default: claude-sonnet-4-6
  GEMINI_THINKING_BUDGET  default: 1024 (added on top of max_tokens so thinking can't truncate output)
  STATIC_DIR        default: ./static next to this file (Docker copies the Vite build here)
  RATE_LIMIT_PER_HOUR default: 60 (per client IP, /api/generate only)
"""

import json
import os
import re
import time
from collections import defaultdict, deque
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
GEMINI_THINKING_BUDGET = int(os.getenv("GEMINI_THINKING_BUDGET", "1024"))
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).parent / "static")).resolve()

app = FastAPI(title="asvab-forge")


# ---------------------------------------------------------------- request model
class GenRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=12_000)
    max_tokens: int = Field(4096, ge=256, le=8192)
    temperature: float = Field(0.8, ge=0.0, le=1.5)


# ---------------------------------------------------------------- providers
async def call_gemini(req: GenRequest) -> str:
    if not GEMINI_API_KEY:
        raise HTTPException(500, "GEMINI_API_KEY is not set")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent"
    )
    payload = {
        "contents": [{"parts": [{"text": req.prompt}]}],
        "generationConfig": {
            # 2.5-flash counts thinking tokens against maxOutputTokens; reserve
            # the thinking budget on top so long JSON replies aren't cut off.
            "maxOutputTokens": req.max_tokens + GEMINI_THINKING_BUDGET,
            "temperature": req.temperature,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": GEMINI_THINKING_BUDGET},
        },
    }
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(
            url, params={"key": GEMINI_API_KEY}, json=payload
        )
    if r.status_code != 200:
        raise HTTPException(502, f"Gemini {r.status_code}: {r.text[:500]}")
    data = r.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        # skip thought parts if the API ever returns them
        return "".join(p.get("text", "") for p in parts if not p.get("thought"))
    except (KeyError, IndexError, TypeError):
        raise HTTPException(502, f"Gemini returned no text: {json.dumps(data)[:500]}")


async def call_anthropic(req: GenRequest) -> str:
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY is not set")
    payload = {
        "model": ANTHROPIC_MODEL,
        "max_tokens": req.max_tokens,
        "temperature": min(req.temperature, 1.0),
        "messages": [{"role": "user", "content": req.prompt}],
    }
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages", headers=headers, json=payload
        )
    if r.status_code != 200:
        raise HTTPException(502, f"Anthropic {r.status_code}: {r.text[:500]}")
    data = r.json()
    parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
    text = "\n".join(p for p in parts if p)
    if not text:
        raise HTTPException(502, f"Anthropic returned no text: {json.dumps(data)[:500]}")
    return text


# ---------------------------------------------------------------- JSON hygiene
_FENCE = re.compile(r"^\s*```[a-zA-Z]*\s*$", re.MULTILINE)


def extract_json(text: str):
    """Defensive extraction: strip markdown fences, then fall back to slicing the
    outermost [...] or {...} — whichever bracket opens first, so an object that
    contains arrays isn't mistaken for its inner array."""
    if not isinstance(text, str):
        return None
    cleaned = _FENCE.sub("", text.strip()).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    pairs = [("[", "]"), ("{", "}")]
    pairs.sort(key=lambda p: (cleaned.find(p[0]) == -1, cleaned.find(p[0])))
    for open_ch, close_ch in pairs:
        start = cleaned.find(open_ch)
        end = cleaned.rfind(close_ch)
        if start != -1 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                continue
    return None


# ---------------------------------------------------------------- rate limit
# Simple in-memory sliding window, per IP. Cloud Run sits behind a proxy,
# so trust the first X-Forwarded-For entry. Protects the LLM quota if the
# URL leaks; fine for a single-instance personal app.
RATE_LIMIT_PER_HOUR = int(os.getenv("RATE_LIMIT_PER_HOUR", "60"))
_hits: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate(request: Request) -> None:
    ip = _client_ip(request)
    now = time.time()
    q = _hits[ip]
    while q and q[0] < now - 3600:
        q.popleft()
    if len(q) >= RATE_LIMIT_PER_HOUR:
        wait = int(q[0] + 3600 - now) // 60 + 1
        raise HTTPException(
            429,
            f"Slow down, recruit — you've hit the limit of {RATE_LIMIT_PER_HOUR} "
            f"generations per hour. Try again in about {wait} min, or drill from "
            "your offline bank in the meantime.",
        )
    q.append(now)
    # drop idle IPs so the table doesn't grow forever
    if len(_hits) > 10_000:
        for k in [k for k, v in _hits.items() if not v or v[-1] < now - 3600]:
            _hits.pop(k, None)


# ---------------------------------------------------------------- routes
@app.get("/api/health")
async def health():
    return {"ok": True, "provider": PROVIDER}


@app.post("/api/generate")
async def generate(req: GenRequest, request: Request):
    check_rate(request)
    if PROVIDER == "anthropic":
        text = await call_anthropic(req)
    else:
        text = await call_gemini(req)
    parsed = extract_json(text)
    if parsed is None:
        # surface the model's actual reply so the frontend can show a real error
        return JSONResponse(
            status_code=422,
            content={"error": "model_output_not_json", "raw": text[:2000]},
        )
    return {"data": parsed}


# ---------------------------------------------------------------- static SPA
NO_CACHE = {"Cache-Control": "no-cache"}  # index + sw must revalidate so deploys land


@app.api_route("/api/{rest:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def api_not_found(rest: str):
    raise HTTPException(404, "Not found")


if STATIC_DIR.is_dir():
    if (STATIC_DIR / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def spa(full_path: str):
        candidate = (STATIC_DIR / full_path).resolve()
        if (
            full_path
            and candidate.is_relative_to(STATIC_DIR)  # no ../ escapes
            and candidate.is_file()
        ):
            headers = NO_CACHE if candidate.name in ("sw.js", "index.html") else None
            return FileResponse(candidate, headers=headers)
        return FileResponse(STATIC_DIR / "index.html", headers=NO_CACHE)
