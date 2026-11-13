import json
from typing import List, Dict, Any
from ..config import settings
from ..errors import GeminiConfigurationError
from .video_processor import format_timecode


def detect_highlights_with_gemini(
    video_title: str,
    duration_seconds: float,
    segments: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
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

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    transcript_lines = "\n".join(
        f"[{s['startSeconds']}s - {s['endSeconds']}s] ({s['startTimecode']}–{s['endTimecode']}): {s['text']}"
        for s in segments
    )

    prompt = (
        f'Analyze the timestamped transcript for video "{video_title}" '
        f"(duration: {duration_seconds:.1f}s).\n"
        "Identify 2 to 5 engaging, funny, emotional, surprising, or educational highlight moments.\n"
        "Select meaningful startSeconds and endSeconds without cutting sentences unnecessarily.\n"
        "Return structured JSON with title, reason, category, startSeconds, endSeconds, and score (0-100).\n\n"
        f"Transcript:\n{transcript_lines}"
    )

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    raw_items = json.loads(response.text or "[]")
    validated: List[Dict[str, Any]] = []
    for item in raw_items:
        start_sec = max(0.0, float(item.get("startSeconds", 0.0)))
        end_sec = min(duration_seconds, max(start_sec + 2.0, float(item.get("endSeconds", start_sec + 15.0))))
        score = max(0, min(100, int(item.get("score", 80))))
        validated.append(
            {
                "title": str(item.get("title", "Highlight Moment")).strip(),
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
