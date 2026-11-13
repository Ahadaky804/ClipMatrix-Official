#!/usr/bin/env python3
"""
Local faster-whisper CLI runner with word-level sentence segmentation.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.whisper_service import transcribe_with_faster_whisper  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Run local faster-whisper transcription")
    parser.add_argument("--audio", required=True, help="Path to 16kHz WAV file")
    parser.add_argument("--model", default="tiny", help="Whisper model size (tiny, base, small, medium, large-v3)")
    parser.add_argument("--language", default=None, help="Optional ISO language code (e.g. en, ur)")
    args = parser.parse_args()

    try:
        result = transcribe_with_faster_whisper(
            Path(args.audio),
            model_size=args.model,
            language=args.language,
        )
        print(json.dumps(result))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
