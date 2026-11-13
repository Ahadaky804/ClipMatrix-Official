import json
import time
from typing import List, Dict, Any, Optional
from ..config import settings
from ..errors import GeminiConfigurationError
from .video_processor import format_timecode

_LAST_GEMINI_CHECK: Optional[Dict[str, Any]] = None
_LAST_GEMINI_CHECK_TS: float = 0.0


def _create_gemini_client():
    api_key = settings.GEMINI_API_KEY
    if not api_key or api_key in ("YOUR_GEMINI_API_KEY", "MY_GEMINI_API_KEY"):
        raise GeminiConfigurationError(
            "GEMINI_API_KEY is not configured in backend environment variables."
        )

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise GeminiConfigurationError(
            "google-genai SDK is not installed. Run `pip install google-genai`."
        ) from exc

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(headers={"User-Agent": "aistudio-build"}),
    )
    return client, types


def verify_gemini_live_connection(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Verifies the Gemini API connection by performing a real generate_content call
    against the configured model. Never reports available=True without a real API response.
    """
    global _LAST_GEMINI_CHECK, _LAST_GEMINI_CHECK_TS
    now = time.time()
    if not force_refresh and _LAST_GEMINI_CHECK and (now - _LAST_GEMINI_CHECK_TS) < 45.0:
        return _LAST_GEMINI_CHECK

    try:
        client, _types = _create_gemini_client()
        t0 = time.perf_counter()
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents="Respond with the single word OK.",
        )
        latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        reply_text = (response.text or "").strip()
        if not reply_text:
            raise GeminiConfigurationError("Gemini API returned an empty response body.")

        result = {
            "available": True,
            "verified": True,
            "model": settings.GEMINI_MODEL,
            "latencyMs": latency_ms,
            "responsePreview": reply_text[:40],
        }
        _LAST_GEMINI_CHECK = result
        _LAST_GEMINI_CHECK_TS = now
        return result
    except Exception as exc:
        result = {
            "available": False,
            "verified": False,
            "model": settings.GEMINI_MODEL,
            "error": str(exc),
        }
        _LAST_GEMINI_CHECK = result
        _LAST_GEMINI_CHECK_TS = now
        return result


def detect_highlights_with_gemini(
    video_title: str,
    duration_seconds: float,
    segments: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not segments:
        raise GeminiConfigurationError(
            "Cannot analyze highlights on an empty transcript. Transcribe the video with faster-whisper first."
        )

    client, types = _create_gemini_client()

    transcript_lines = "\n".join(
        f"[{s['startSeconds']}s - {s['endSeconds']}s] ({s['startTimecode']}–{s['endTimecode']}): {s['text']}"
        for s in segments
    )

    prompt = (
        f'You are a senior video editor and viral content strategist.\n'
        f'Analyze the following Whisper speech-to-text transcript for the video "{video_title}" '
        f"(total duration: {duration_seconds:.1f} seconds).\n\n"
        "Identify 2 to 4 distinct highlight moments (hooks, educational takeaways, surprising insights, or engaging statements).\n"
        "Rules:\n"
        f"1. Select meaningful clip startSeconds and endSeconds within [0, {duration_seconds:.1f}].\n"
        "2. Ensure endSeconds > startSeconds and avoid cutting sentences mid-thought.\n"
        "3. Provide a compelling title, a clear explanation ('reason') why the moment was selected, "
        "a category ('hook', 'educational', 'funny', 'emotional', 'surprising', or 'engaging'), "
        "and a highlight score from 0 to 100.\n\n"
        f"Whisper Transcript with Timestamps:\n{transcript_lines}"
    )

    response_schema = types.Schema(
        type=types.Type.ARRAY,
        items=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "title": types.Schema(type=types.Type.STRING),
                "reason": types.Schema(type=types.Type.STRING),
                "category": types.Schema(type=types.Type.STRING),
                "startSeconds": types.Schema(type=types.Type.NUMBER),
                "endSeconds": types.Schema(type=types.Type.NUMBER),
                "score": types.Schema(type=types.Type.INTEGER),
            },
            required=["title", "reason", "category", "startSeconds", "endSeconds", "score"],
        ),
    )

    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
            ),
        )
    except Exception as exc:
        raise GeminiConfigurationError(f"Gemini API request failed: {exc}") from exc

    raw_items = json.loads((response.text or "[]").strip())
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        raise GeminiConfigurationError("Gemini API returned an empty highlight list.")

    validated: List[Dict[str, Any]] = []
    max_end = max(1.0, float(duration_seconds))
    for item in raw_items:
        raw_start = max(0.0, float(item.get("startSeconds", 0.0)))
        start_sec = min(raw_start, max(0.0, max_end - 2.0))
        raw_end = max(start_sec + 2.0, float(item.get("endSeconds", start_sec + 12.0)))
        end_sec = min(max_end, raw_end)
        score = max(0, min(100, int(item.get("score", 85))))
        validated.append(
            {
                "title": str(item.get("title", "Highlighted Moment")).strip(),
                "reason": str(item.get("reason", "Strong hook and audience retention.")).strip(),
                "category": str(item.get("category", "engaging")).strip(),
                "startSeconds": round(start_sec, 2),
                "endSeconds": round(end_sec, 2),
                "startTimecode": format_timecode(start_sec),
                "endTimecode": format_timecode(end_sec),
                "score": score,
            }
        )

    return validated
