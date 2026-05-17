import asyncio

from app import health_check


def test_health():
    response = asyncio.run(health_check())
    assert response["status"] == "ok"
    assert response["database"] == "postgresql"
