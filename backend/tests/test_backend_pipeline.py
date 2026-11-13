import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.video_processor import (
    check_ffmpeg_and_ffprobe,
    format_timecode,
    parse_timecode_to_seconds,
)
from app.services.whisper_service import check_whisper_status
from app.models import Video


class TestClipMatrixFastAPIBackend(unittest.TestCase):
    def test_timecode_formatting_and_parsing(self):
        self.assertEqual(format_timecode(0), "00:00")
        self.assertEqual(format_timecode(65.4), "01:05")
        self.assertEqual(format_timecode(3661), "01:01:01")
        self.assertAlmostEqual(parse_timecode_to_seconds("01:15"), 75.0)
        self.assertAlmostEqual(parse_timecode_to_seconds("01:00:05"), 3605.0)

    def test_ffmpeg_and_ffprobe_availability(self):
        media = check_ffmpeg_and_ffprobe()
        self.assertTrue(media["ffmpeg"]["available"])
        self.assertTrue(media["ffprobe"]["available"])

    def test_faster_whisper_installed_and_ready(self):
        whisper = check_whisper_status()
        self.assertTrue(whisper["available"])
        self.assertTrue(whisper["installed"])
        self.assertEqual(whisper["device"], "cpu")

    def test_video_model_camel_case_serialization(self):
        v = Video(
            id=10,
            user_uid="u-1",
            title="Test Video",
            original_filename="test.mp4",
            stored_filename="10_test.mp4",
            video_url="/storage/videos/10_test.mp4",
            audio_url="/storage/audio/10.wav",
            file_size_bytes=1024,
            mime_type="video/mp4",
            duration_seconds=35.5,
            width=1280,
            height=720,
            fps=24.0,
            video_codec="h264",
            audio_codec="aac",
            status="completed",
        )
        d = v.to_camel_dict()
        self.assertEqual(d["videoUrl"], "/storage/videos/10_test.mp4")
        self.assertEqual(d["durationSeconds"], 35.5)
        self.assertEqual(d["videoCodec"], "h264")


if __name__ == "__main__":
    unittest.main()
