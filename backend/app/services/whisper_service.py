from pathlib import Path
from typing import Dict, Any, Optional
from ..config import settings
from ..errors import WhisperNotAvailableError
from .video_processor import format_timecode


def transcribe_with_faster_whisper(
    audio_path: Path,
    model_size: Optional[str] = None,
    language: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise WhisperNotAvailableError(
            "faster-whisper is not installed. Run `pip install -r backend/requirements.txt` on the server."
        ) from exc

    chosen_model = model_size or settings.WHISPER_MODEL_SIZE
    device = settings.WHISPER_DEVICE
    compute_type = settings.WHISPER_COMPUTE_TYPE

    if device == "auto":
        try:
            import torch  # type: ignore
            if torch.cuda.is_available():
                device = "cuda"
                compute_type = "float16"
            else:
                device = "cpu"
        except ImportError:
            device = "cpu"

    whisper_model = WhisperModel(chosen_model, device=device, compute_type=compute_type)
    segments_gen, info = whisper_model.transcribe(
        str(audio_path),
        language=language if language and language != "auto" else None,
        beam_size=5,
        vad_filter=True,
    )

    segments = []
    for idx, seg in enumerate(segments_gen, start=1):
        start_sec = round(float(seg.start), 2)
        end_sec = round(float(seg.end), 2)
        segments.append(
            {
                "id": idx,
                "startSeconds": start_sec,
                "endSeconds": end_sec,
                "startTimecode": format_timecode(start_sec),
                "endTimecode": format_timecode(end_sec),
                "text": seg.text.strip(),
            }
        )

    full_text = " ".join(s["text"] for s in segments)
    return {
        "engine_used": "faster-whisper",
        "model_size": chosen_model,
        "language": info.language,
        "full_text": full_text,
        "segments": segments,
    }
