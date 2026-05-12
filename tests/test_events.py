import asyncio
import pytest


@pytest.fixture(autouse=True)
def clear_bus():
    from events import event_bus
    while not event_bus.empty():
        event_bus.get_nowait()
    yield
    while not event_bus.empty():
        event_bus.get_nowait()


async def test_push_adds_event_to_queue():
    from events import event_bus, push
    event = {"type": "test", "message": "hello"}
    await push(event)
    assert not event_bus.empty()
    item = event_bus.get_nowait()
    assert item == event


async def test_push_multiple_events_preserves_order():
    from events import event_bus, push
    for i in range(3):
        await push({"type": "test", "index": i})
    assert event_bus.qsize() == 3
    for i in range(3):
        item = event_bus.get_nowait()
        assert item["index"] == i


async def test_push_accepts_arbitrary_dict():
    from events import push, event_bus
    payload = {"type": "x", "nested": {"a": 1}, "list": [1, 2, 3]}
    await push(payload)
    assert event_bus.get_nowait() == payload
