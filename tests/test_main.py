import os
# Set env vars before importing main so config.py doesn't raise
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-placeholder")
os.environ.setdefault("LINKEDIN_EMAIL", "test@example.com")
os.environ.setdefault("LINKEDIN_PASSWORD", "testpassword")

from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


def test_index_returns_html(tmp_path, monkeypatch):
    # Point the app at a stub dist dir so the test does not require an actual frontend build
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<html><body>reelify</body></html>")
    monkeypatch.setenv("REELIFY_FRONTEND_DIST", str(dist))
    # Reload module to pick up env
    import importlib, main
    importlib.reload(main)
    client = TestClient(main.app)
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "reelify" in response.text.lower()


def test_run_returns_started_status():
    from main import app
    client = TestClient(app)
    mock_run = AsyncMock()
    with patch("main.orchestrator.run", mock_run):
        response = client.post("/run", json={"num_posts": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "started"
    assert data["num_posts"] == 3


def test_run_default_num_posts():
    from main import app
    client = TestClient(app)
    with patch("main.orchestrator.run", new_callable=AsyncMock):
        response = client.post("/run", json={})
    assert response.status_code == 200
    assert response.json()["num_posts"] == 5


def test_run_rejects_invalid_body():
    from main import app
    client = TestClient(app)
    response = client.post("/run", json={"num_posts": "not-a-number"})
    assert response.status_code == 422


def test_run_returns_409_when_already_running():
    import asyncio
    import main as main_module

    async def slow_run(num_posts, tone="Punchy"):
        await asyncio.sleep(10)

    from main import app
    main_module._current_task = None
    with TestClient(app) as client:
        with patch("main.orchestrator.run", new=slow_run):
            first = client.post("/run", json={"num_posts": 3})
            assert first.status_code == 200
            second = client.post("/run", json={"num_posts": 3})
            assert second.status_code == 409
            client.post("/stop")  # cleanup


def test_run_rejects_zero_num_posts():
    from main import app
    client = TestClient(app)
    response = client.post("/run", json={"num_posts": 0})
    assert response.status_code == 422


def test_run_rejects_over_100_num_posts():
    from main import app
    client = TestClient(app)
    response = client.post("/run", json={"num_posts": 101})
    assert response.status_code == 422


def test_run_accepts_valid_tone():
    from main import app
    client = TestClient(app)
    with patch("main.orchestrator.run", new_callable=AsyncMock):
        response = client.post("/run", json={"num_posts": 3, "tone": "Punchy"})
    assert response.status_code == 200
    assert response.json()["tone"] == "Punchy"


def test_run_rejects_invalid_tone():
    from main import app
    client = TestClient(app)
    response = client.post("/run", json={"num_posts": 3, "tone": "Whimsical"})
    assert response.status_code == 422


def test_run_defaults_tone_to_punchy():
    from main import app
    client = TestClient(app)
    with patch("main.orchestrator.run", new_callable=AsyncMock):
        response = client.post("/run", json={"num_posts": 3})
    assert response.json()["tone"] == "Punchy"


def test_stop_when_idle_returns_no_op():
    from main import app
    client = TestClient(app)
    response = client.post("/stop")
    assert response.status_code == 200
    assert response.json()["status"] == "idle"


def test_stop_cancels_running_pipeline():
    import asyncio
    import main as main_module

    async def slow_run(num_posts, tone="Punchy"):
        try:
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            main_module._cancelled_marker = True
            raise

    main_module._cancelled_marker = False
    from main import app
    with TestClient(app) as client:
        with patch("main.orchestrator.run", new=slow_run):
            started = client.post("/run", json={"num_posts": 3})
            assert started.json()["status"] == "started"
            import time
            for _ in range(20):
                if main_module._current_task is not None:
                    break
                time.sleep(0.05)
            stopped = client.post("/stop")
        assert stopped.status_code == 200
        assert stopped.json()["status"] == "stopped"
        for _ in range(20):
            if main_module._cancelled_marker:
                break
            time.sleep(0.05)
        assert main_module._cancelled_marker is True
