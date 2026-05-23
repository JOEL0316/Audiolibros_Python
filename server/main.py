import os
from pathlib import Path

import edge_tts
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="Audiolibro TTS API", version="1.0.0")

_default_origins = "*"
_cors_raw = os.getenv("CORS_ORIGINS", _default_origins).strip()
_allow_all = _cors_raw == "*" or os.getenv("CORS_ALLOW_ALL", "").lower() in ("1", "true", "yes")

if _allow_all:
    _origins = ["*"]
else:
    _origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_DIR = Path(__file__).parent / "audio_cache"
CACHE_DIR.mkdir(exist_ok=True)

MAX_CHARS = int(os.getenv("TTS_MAX_CHARS_PER_CHUNK", "4000"))
DEFAULT_VOICE = os.getenv("TTS_VOICE", "es-ES-ElviraNeural")


def split_text_into_chunks(text: str, max_chars: int) -> list[str]:
    words = text.split(' ')
    chunks: list[str] = []
    current = ''

    for word in words:
        if not current:
            current = word
            continue

        if len(current) + 1 + len(word) <= max_chars:
            current = f"{current} {word}"
            continue

        chunks.append(current)
        current = word

    if current:
        chunks.append(current)

    result: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            result.append(chunk)
            continue

        start = 0
        while start < len(chunk):
            end = min(start + max_chars, len(chunk))
            result.append(chunk[start:end])
            start = end

    return result


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1)
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

    if len(text) > MAX_CHARS:
        chunks = split_text_into_chunks(text, MAX_CHARS)
    else:
        chunks = [text]

    try:
        audio_bytes = b""
        for chunk in chunks:
            communicate = edge_tts.Communicate(chunk, body.voice)
            async for part in communicate.stream():
                if part["type"] == "audio":
                    audio_bytes += part["data"]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not audio_bytes:
        raise HTTPException(status_code=500, detail="No se generó audio")

    return Response(content=audio_bytes, media_type="audio/mpeg")
