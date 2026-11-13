#!/usr/bin/env python3
"""
Local faster-whisper CLI runner used by both the Python FastAPI backend
and the Node/Express bridge when faster-whisper is installed on the host.
"""
import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Run local faster-whisper transcription")
    parser.add_argument("--audio", required=True, help="Path to 16kHz WAV file")
    parser.add_argument("--model", default="base", help="Whisper model size (tiny, base, small, medium, large-v3)")
    parser.add_argument("--language", default=None, help="Optional ISO language code (e.g. en, ur)")
    parser.add_argument("--device", default="auto", help="cpu, cuda, or auto")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            json.dumps(
                {
                    "error": "faster-whisper is not installed in this Python environment. Install via: pip install faster-whisper"
                }
            ),
            file=sys.stderr,
        )
        return 2

    device = args.device
    compute_type = "int8"
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

    model = WhisperModel(args.model, device=device, compute_type=compute_type)
    segments_gen, info = model.transcribe(
        args.audio,
        language=args.language if args.language and args.language != "auto" else None,
        beam_size=5,
        vad_filter=True,
    )

    segments_list = []
    for seg in segments_gen:
        segments_list.append(
            {
                "id": seg.id,
                "start": round(float(seg.start), 2),
                "end": round(float(seg.end), 2),
                "text": seg.text.strip(),
            }
        )

    output = {
        "language": info.language,
        "language_probability": round(float(info.language_probability), 4),
        "duration": round(float(info.duration), 2),
        "device": device,
        "model": args.model,
        "segments": segments_list,
    }
    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
