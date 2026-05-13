import pytest


async def test_push_delivers_event_to_subscriber():
    from events import hub, push
    event = {"type": "test", "message": "hello"}
    async with hub.subscribe() as q:
        await push(event)
        item = q.get_nowait()
        assert item == event


async def test_push_multiple_events_preserves_order():
    from events import hub, push
    async with hub.subscribe() as q:
        for i in range(3):
            await push({"type": "test", "index": i})
        assert q.qsize() == 3
        for i in range(3):
            item = q.get_nowait()
            assert item["index"] == i


async def test_push_accepts_arbitrary_dict():
    from events import hub, push
    payload = {"type": "x", "nested": {"a": 1}, "list": [1, 2, 3]}
    async with hub.subscribe() as q:
        await push(payload)
        assert q.get_nowait() == payload


async def test_push_fans_out_to_multiple_subscribers():
    from events import hub, push
    async with hub.subscribe() as q1, hub.subscribe() as q2:
        event = {"type": "fanout", "n": 1}
        await push(event)
        assert q1.get_nowait() == event
        assert q2.get_nowait() == event


async def test_unsubscribe_removes_queue():
    from events import hub, push
    async with hub.subscribe() as q:
        await push({"type": "before"})
        assert q.get_nowait() == {"type": "before"}
    # After exit, q is no longer a subscriber — pushes shouldn't reach it.
    await push({"type": "after"})
    assert q.empty()
