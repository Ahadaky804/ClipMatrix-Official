import json
import time
from typing import List, Dict, Any, Optional, Union
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

    # Strictly enforce gemini-4-hydrogen from backend environment variables
    model_name = settings.GEMINI_MODEL
    if not model_name:
        raise GeminiConfigurationError(
            "GEMINI_MODEL is not configured in backend environment variables."
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
    against settings.GEMINI_MODEL (gemini-4-hydrogen). Never reports available=True
    without a real API response.
    """
    global _LAST_GEMINI_CHECK, _LAST_GEMINI_CHECK_TS
    now = time.time()
    if (
        not force_refresh
        and _LAST_GEMINI_CHECK
        and _LAST_GEMINI_CHECK.get("available")
        and (now - _LAST_GEMINI_CHECK_TS) < 3600.0
    ):
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
    num_shorts: Union[int, str] = "auto",
    target_duration_seconds: float = 0.0,
    subtitle_language: str = "english",
) -> List[Dict[str, Any]]:
    """
    Uses ONLY settings.GEMINI_MODEL ('gemini-4-hydrogen') to analyze the faster-whisper
    transcript and identify the most interesting moments with accurate start/end timestamps,
    AI-generated captions, and viral hashtags.
    """
    if not segments:
        raise GeminiConfigurationError(
            "Cannot analyze highlights on an empty transcript. Transcribe the video with faster-whisper first."
        )

    client, types = _create_gemini_client()

    transcript_lines = "\n".join(
        f"[{s['startSeconds']}s - {s['endSeconds']}s] ({s['startTimecode']}–{s['endTimecode']}): {s['text']}"
        for s in segments
    )

    if str(num_shorts).lower() in ("auto", "automatic", "0"):
        count_instruction = "Identify between 3 and 5 distinct high-retention short-form moments."
        requested_count = 3
    else:
        requested_count = max(1, min(10, int(num_shorts)))
        count_instruction = f"Identify exactly {requested_count} distinct short-form moments."

    duration_instruction = (
        f"Aim for each clip to be approximately {target_duration_seconds:.0f} seconds long where natural sentence boundaries permit."
        if target_duration_seconds and target_duration_seconds > 0
        else "Choose natural sentence boundaries so each clip is between 7 and 60 seconds long."
    )

    prompt = (
        f"You are an expert short-form video editor for YouTube Shorts, TikTok, and Instagram Reels.\n"
        f'Analyze the following faster-whisper speech transcript for the video "{video_title}" '
        f"(total duration: {duration_seconds:.1f} seconds).\n\n"
        f"{count_instruction}\n"
        f"{duration_instruction}\n\n"
        "Select moments based on:\n"
        "- Interesting conversations\n"
        "- Funny moments\n"
        "- Surprising statements\n"
        "- Emotional moments\n"
        "- Important information\n"
        "- Strong hooks\n"
        "- Engaging storytelling\n\n"
        "Strict Rules:\n"
        f"1. Return accurate startSeconds and endSeconds within [0, {duration_seconds:.1f}].\n"
        "2. Avoid selecting incomplete sentences or clips that start and end awkwardly.\n"
        "3. Provide a compelling clip 'title', a clear 'reason' why the moment is viral, "
        "a 'category' ('hook', 'conversation', 'funny', 'surprising', 'emotional', 'information', or 'storytelling'), "
        "a virality 'score' from 0 to 100, "
        f"an engaging social media 'caption' written in {subtitle_language}, "
        "and a list of 4 to 6 relevant 'hashtags' (each starting with #).\n\n"
        f"Faster-Whisper Transcript with Timestamps:\n{transcript_lines}"
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
                "caption": types.Schema(type=types.Type.STRING),
                "hashtags": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(type=types.Type.STRING),
                ),
            },
            required=[
                "title",
                "reason",
                "category",
                "startSeconds",
                "endSeconds",
                "score",
                "caption",
                "hashtags",
            ],
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
        raise GeminiConfigurationError(
            f"Gemini ({settings.GEMINI_MODEL}) API request failed: {exc}"
        ) from exc

    raw_items = json.loads((response.text or "[]").strip())
    if not isinstance(raw_items, list) or len(raw_items) == 0:
        raise GeminiConfigurationError(
            f"Gemini ({settings.GEMINI_MODEL}) returned an empty highlight list."
        )

    validated: List[Dict[str, Any]] = []
    max_end = max(1.0, float(duration_seconds))
    for item in raw_items:
        raw_start = max(0.0, float(item.get("startSeconds", 0.0)))
        start_sec = min(raw_start, max(0.0, max_end - 2.0))
        raw_end = max(start_sec + 2.0, float(item.get("endSeconds", start_sec + 10.0)))
        end_sec = min(max_end, raw_end)
        score = max(0, min(100, int(item.get("score", 88))))
        raw_tags = item.get("hashtags") or ["#Shorts", "#ClipMatrix", "#Reels", "#Viral"]
        clean_tags = [
            str(t).strip() if str(t).strip().startswith("#") else f"#{str(t).strip()}"
            for t in raw_tags
            if str(t).strip()
        ]
        if not clean_tags:
            clean_tags = ["#Shorts", "#ClipMatrix", "#Reels", "#Viral"]

        title_str = str(item.get("title", "Highlighted Moment")).strip()
        caption_str = str(
            item.get("caption")
            or f"{title_str} — watch till the end!"
        ).strip()

        validated.append(
            {
                "title": title_str,
                "reason": str(item.get("reason", "Strong hook and audience retention.")).strip(),
                "category": str(item.get("category", "hook")).strip(),
                "startSeconds": round(start_sec, 2),
                "endSeconds": round(end_sec, 2),
                "startTimecode": format_timecode(start_sec),
                "endTimecode": format_timecode(end_sec),
                "score": score,
                "caption": caption_str,
                "hashtags": " ".join(clean_tags),
                "hashtagsList": clean_tags,
            }
        )

    return validated
