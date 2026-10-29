"""Backend checks: JSON extraction, rate limiting, SPA fallback.  Run: pytest backend/"""
import importlib
import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def mod(tmp_path, monkeypatch):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>shell</html>")
    (tmp_path / "sw.js").write_text("// sw")
    monkeypatch.setenv("STATIC_DIR", str(tmp_path))
    monkeypatch.setenv("RATE_LIMIT_PER_HOUR", "3")
    import main

    m = importlib.reload(main)

    async def fake_llm(req):
        return 'Sure! Here you go:\n```json\n[{"q":"1+1?","choices":["1","2","3","4"],"answer":1}]\n```'

    monkeypatch.setattr(m, "call_gemini", fake_llm)
    monkeypatch.setattr(m, "call_anthropic", fake_llm)
    return m


def test_extract_plain_and_fenced(mod):
    assert mod.extract_json('[{"a":1}]') == [{"a": 1}]
    assert mod.extract_json('```json\n{"a": [1, 2]}\n```') == {"a": [1, 2]}
    assert mod.extract_json("```\n[1,2]\n```") == [1, 2]


def test_extract_chatty_preamble(mod):
    assert mod.extract_json('Here are your questions:\n[{"q":"x"}]\nGood luck!') == [{"q": "x"}]
    # object containing arrays must come back as the object, not its inner array
    got = mod.extract_json('Lesson below.\n{"title":"t","steps":["a","b"],"core":"c"} hope it helps')
    assert got == {"title": "t", "steps": ["a", "b"], "core": "c"}


def test_extract_garbage(mod):
    assert mod.extract_json("I can't help with that.") is None
    assert mod.extract_json("[not json at all}") is None
    assert mod.extract_json("") is None


def test_generate_and_rate_limit(mod):
    c = TestClient(mod.app)
    body = {"prompt": "x", "max_tokens": 512, "temperature": 0.5}
    hdr = {"X-Forwarded-For": "203.0.113.9, 10.0.0.1"}
    for _ in range(3):
        r = c.post("/api/generate", json=body, headers=hdr)
        assert r.status_code == 200 and r.json()["data"][0]["answer"] == 1
    r = c.post("/api/generate", json=body, headers=hdr)
    assert r.status_code == 429 and "limit" in r.json()["detail"]
    # a different first X-Forwarded-For hop is a different client
    r = c.post("/api/generate", json=body, headers={"X-Forwarded-For": "198.51.100.7"})
    assert r.status_code == 200


def test_non_json_model_output_is_422(mod, monkeypatch):
    async def chatty(req):
        return "Sorry, I cannot produce that."

    monkeypatch.setattr(mod, "call_gemini", chatty)
    r = TestClient(mod.app).post("/api/generate", json={"prompt": "x"})
    assert r.status_code == 422
    assert r.json() == {"error": "model_output_not_json", "raw": "Sorry, I cannot produce that."}


def test_validation(mod):
    r = TestClient(mod.app).post("/api/generate", json={"prompt": ""})
    assert r.status_code == 422 and "error" not in r.json()


def test_health_and_spa(mod):
    c = TestClient(mod.app)
    assert c.get("/api/health").json() == {"ok": True, "provider": "gemini"}
    assert c.get("/drill/whatever").text == "<html>shell</html>"
    assert c.get("/sw.js").headers["cache-control"] == "no-cache"
    assert c.get("/api/nope").status_code == 404
    assert "shell" in c.get("/..%2fmain.py").text  # traversal falls back to the shell
