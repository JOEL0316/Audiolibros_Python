import os
from pathlib import Path

import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="Audiolibro TTS API", version="1.0.0")

origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_DIR = Path(__file__).parent / "audio_cache"
CACHE_DIR.mkdir(exist_ok=True)

MAX_CHARS = int(os.getenv("TTS_MAX_CHARS_PER_CHUNK", "4000"))
DEFAULT_VOICE = os.getenv("TTS_VOICE", "es-ES-ElviraNeural")


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_CHARS)
    voice: str = DEFAULT_VOICE


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/voices")
async def list_voices():
    voices = await edge_tts.list_voices()
    names = sorted({v["ShortName"] for v in voices})
    return {"voices": names}


@app.post("/synthesize")
async def synthesize(body: SynthesizeRequest):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Texto vacío")

    try:
        communicate = edge_tts.Communicate(text, body.voice)
        audio_bytes = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_bytes += chunk["data"]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not audio_bytes:
        raise HTTPException(status_code=500, detail="No se generó audio")

    return Response(content=audio_bytes, media_type="audio/mpeg")
