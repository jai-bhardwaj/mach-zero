"""
Mach-Zero Shared Memory Bridge

FastAPI + WebSocket server that reads the C++ shared memory region
and pushes real-time snapshots to browser clients.

Usage:
    python main.py
    # or
    uvicorn main:app --host 0.0.0.0 --port 3002
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from shm_service import broadcaster


@asynccontextmanager
async def lifespan(app: FastAPI):
    await broadcaster.start()
    yield
    await broadcaster.stop()


app = FastAPI(title="Mach-Zero Bridge", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "clients": len(broadcaster.clients),
        "shm_available": broadcaster._reader is not None,
    }


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()
    broadcaster.add_client(websocket)
    try:
        while True:
            # Keep connection alive, ignore client messages
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.remove_client(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002, log_level="info")
