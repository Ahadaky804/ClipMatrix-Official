from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from ..config import settings
from ..errors import WhisperNotAvailableError, VideoProcessingError
from .video_processor import format_timecode

_MODEL_CACHE: Dict[Tuple[str, str, str], Any] = {}


def _resolve_device_and_compute() -> Tuple[str, str]:
    device = settings.WHISPER_DEVICE
    compute_type = settings.WHISPER_COMPUTE_TYPE
    if device == "auto":
        try:
            import torch  # type: ignore
            if torch.cuda.is_available():
                return "cuda", "float16"
        except ImportError:
            pass
        return "cpu", "int8"
    return device, compute_type


def check_whisper_status() -> Dict[str, Any]:
    try:
        import faster_whisper
        import ctranslate2
        device, compute_type = _resolve_device_and_compute()
        return {
            "available": True,
            "installed": True,
            "version": getattr(faster_whisper, "__version__", "1.1.0"),
            "ctranslate2Version": getattr(ctranslate2, "__version__", "unknown"),
            "defaultModel": settings.WHISPER_MODEL_SIZE,
            "device": device,
            "computeType": compute_type,
        }
    except ImportError as exc:
        return {
            "available": False,
            "installed": False,
            "version": "not installed",
            "defaultModel": settings.WHISPER_MODEL_SIZE,
            "device": "none",
            "error": str(exc),
        }


def get_whisper_model(model_size: str):
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise WhisperNotAvailableError(
            "faster-whisper is not installed. Run `pip install -r backend/requirements.txt`."
        ) from exc

    device, compute_type = _resolve_device_and_compute()
    cache_key = (model_size, device, compute_type)
    if cache_key not in _MODEL_CACHE:
        _MODEL_CACHE[cache_key] = WhisperModel(
            model_size, device=device, compute_type=compute_type
        )
    return _MODEL_CACHE[cache_key], device, compute_type


def transcribe_with_faster_whisper(
    audio_path: Path,
    model_size: Optional[str] = None,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    if not audio_path.exists():
        raise VideoProcessingError(f"Extracted audio file not found: {audio_path.name}")

    chosen_model = model_size or settings.WHISPER_MODEL_SIZE
    whisper_model, device, compute_type = get_whisper_model(chosen_model)

    segments_gen, info = whisper_model.transcribe(
        str(audio_path),
        language=language if language and language != "auto" else None,
        beam_size=5,
        vad_filter=True,
        word_timestamps=True,
    )

    # Split continuous speech into sentence-aligned timestamped segments using word_timestamps
    sentence_segments: List[Dict[str, Any]] = []
    seg_id = 1

    for raw_seg in segments_gen:
        words = getattr(raw_seg, "words", None)
        if words:
            cur_words: List[str] = []
            cur_start: Optional[float] = None
            cur_end: float = float(raw_seg.start)

            for w in words:
                w_text = str(w.word or "").strip()
                if not w_text:
                    continue
                if cur_start is None:
                    cur_start = float(w.start)
                cur_end = float(w.end)
                cur_words.append(w_text)

                ends_sentence = w_text.endswith((".", "!", "?", ":"))
                duration_so_far = cur_end - cur_start
                if (ends_sentence and duration_so_far >= 2.5) or duration_so_far >= 10.0:
                    start_sec = round(max(0.0, cur_start), 2)
                    end_sec = round(max(start_sec + 0.5, cur_end), 2)
                    sentence_segments.append(
                        {
                            "id": seg_id,
                            "startSeconds": start_sec,
                            "endSeconds": end_sec,
                            "startTimecode": format_timecode(start_sec),
                            "endTimecode": format_timecode(end_sec),
                            "text": " ".join(cur_words).strip(),
                        }
                    )
                    seg_id += 1
                    cur_words = []
                    cur_start = None

            if cur_words and cur_start is not None:
                start_sec = round(max(0.0, cur_start), 2)
                end_sec = round(max(start_sec + 0.5, cur_end), 2)
                sentence_segments.append(
                    {
                        "id": seg_id,
                        "startSeconds": start_sec,
                        "endSeconds": end_sec,
                        "startTimecode": format_timecode(start_sec),
                        "endTimecode": format_timecode(end_sec),
                        "text": " ".join(cur_words).strip(),
                    }
                )
                seg_id += 1
        else:
            text_clean = str(raw_seg.text or "").strip()
            if text_clean:
                start_sec = round(float(raw_seg.start), 2)
                end_sec = round(float(raw_seg.end), 2)
                sentence_segments.append(
                    {
                        "id": seg_id,
                        "startSeconds": start_sec,
                        "endSeconds": end_sec,
                        "startTimecode": format_timecode(start_sec),
                        "endTimecode": format_timecode(end_sec),
                        "text": text_clean,
                    }
                )
                seg_id += 1

    if not sentence_segments:
        raise VideoProcessingError(
            "faster-whisper processed the audio track but detected no spoken words. Please upload a video with audible speech."
        )

    full_text = " ".join(s["text"] for s in sentence_segments)
    return {
        "engine_used": "faster-whisper",
        "model_size": f"faster-whisper-{chosen_model} ({device}/{compute_type})",
        "language": info.language or (language or "en"),
        "language_probability": round(float(getattr(info, "language_probability", 1.0)), 4),
        "full_text": full_text,
        "segments": sentence_segments,
    }
