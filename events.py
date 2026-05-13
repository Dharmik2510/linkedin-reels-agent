import asyncio
from contextlib import asynccontextmanager


class EventHub:
    """Fan-out event bus: each subscriber gets its own bounded queue.

    A single `asyncio.Queue` can't fan out — `get()` removes the event,
    so only one consumer ever sees it. Concurrent /stream listeners
    (e.g. one browser tab on :8000 and another on the Vite dev server)
    each need their own queue.
    """

    def __init__(self, maxsize: int = 200) -> None:
        self._subscribers: set[asyncio.Queue] = set()
        self._maxsize = maxsize

    async def push(self, event: dict) -> None:
        for q in list(self._subscribers):
            if q.full():
                # Drop the oldest event rather than block a slow consumer.
                try:
                    q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            await q.put(event)

    @asynccontextmanager
    async def subscribe(self):
        q: asyncio.Queue = asyncio.Queue(maxsize=self._maxsize)
        self._subscribers.add(q)
        try:
            yield q
        finally:
            self._subscribers.discard(q)


hub = EventHub()


async def push(event: dict) -> None:
    await hub.push(event)
