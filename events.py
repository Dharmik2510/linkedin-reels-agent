import asyncio

event_bus: asyncio.Queue = asyncio.Queue()


async def push(event: dict) -> None:
    await event_bus.put(event)
