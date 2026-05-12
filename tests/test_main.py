import os
# Set env vars before importing main so config.py doesn't raise
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-placeholder")
os.environ.setdefault("LINKEDIN_EMAIL", "test@example.com")
os.environ.setdefault("LINKEDIN_PASSWORD", "testpassword")

from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient


def test_index_returns_html():
    from main import app
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<html" in response.text.lower()


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
    import main as main_module
    main_module._pipeline_running = True  # simulate running state
    try:
        from main import app
        client = TestClient(app)
        with patch("main.orchestrator.run", new_callable=AsyncMock):
            response = client.post("/run", json={"num_posts": 3})
        assert response.status_code == 409
        assert response.json()["status"] == "already_running"
    finally:
        main_module._pipeline_running = False  # reset


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
