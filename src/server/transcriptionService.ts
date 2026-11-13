import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { formatSecondsToTimecode } from './ffmpegService.ts';

const execFileAsync = promisify(execFile);

export interface TranscriptSegmentItem {
  id: number;
  startSeconds: number;
  endSeconds: number;
  startTimecode: string;
  endTimecode: string;
  text: string;
}

export interface TranscriptionResult {
  engineUsed: 'faster-whisper' | 'gemini-3.5-transcribe' | 'ffmpeg-acoustic-segments';
  fasterWhisperInstalled: boolean;
  modelSize: string;
  language: string;
  fullText: string;
  segments: TranscriptSegmentItem[];
  notice?: string;
}

export async function isFasterWhisperAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c',
      'import faster_whisper; print("OK")',
    ]);
    return stdout.trim() === 'OK';
  } catch {
    return false;
  }
}

export function isGeminiApiKeyConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== '' && key !== 'MY_GEMINI_API_KEY');
}

export async function transcribeAudioFile(params: {
  audioWavPath: string;
  videoTitle: string;
  durationSeconds: number;
  modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3';
  language?: string;
}): Promise<TranscriptionResult> {
  const {
    audioWavPath,
    videoTitle,
    durationSeconds,
    modelSize = 'base',
    language = 'en',
  } = params;

  const whisperAvailable = await isFasterWhisperAvailable();

  // 1. Primary Path: Local faster-whisper Python execution if installed on host
  if (whisperAvailable) {
    const scriptPath = path.resolve(
      process.cwd(),
      'backend',
      'scripts',
      'run_faster_whisper.py'
    );
    const { stdout } = await execFileAsync(
      'python3',
      [
        scriptPath,
        '--audio',
        audioWavPath,
        '--model',
        modelSize,
        '--language',
        language,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );

    const parsed = JSON.parse(stdout);
    const segments: TranscriptSegmentItem[] = (parsed.segments || []).map(
      (seg: any, idx: number) => ({
        id: idx + 1,
        startSeconds: Number(seg.start),
        endSeconds: Number(seg.end),
        startTimecode: formatSecondsToTimecode(Number(seg.start)),
        endTimecode: formatSecondsToTimecode(Number(seg.end)),
        text: String(seg.text || '').trim(),
      })
    );

    return {
      engineUsed: 'faster-whisper',
      fasterWhisperInstalled: true,
      modelSize,
      language: parsed.language || language,
      fullText: segments.map((s) => s.text).join(' '),
      segments,
    };
  }

  // 2. Secondary Path: Official Gemini Audio Transcription (gemini-3.5-transcribe / gemini-4-hydrogen)
  if (isGeminiApiKeyConfigured()) {
    try {
      const audioBuffer = await fs.readFile(audioWavPath);
      const base64Audio = audioBuffer.toString('base64');

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: { 'User-Agent': 'aistudio-build' },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: base64Audio,
              },
            },
            {
              text: `Transcribe the spoken audio in this ${Math.round(
                durationSeconds
              )}-second recording titled "${videoTitle}". Break the transcript into timestamped segments covering the video duration from 0 to ${Math.round(
                durationSeconds
              )} seconds. If the audio is an instrumental/test tone without human words, describe the acoustic segments and timecodes accurately so clip slicing can be tested.`,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              language: { type: Type.STRING },
              segments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    startSeconds: { type: Type.NUMBER },
                    endSeconds: { type: Type.NUMBER },
                    text: { type: Type.STRING },
                  },
                  required: ['startSeconds', 'endSeconds', 'text'],
                },
              },
            },
            required: ['language', 'segments'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      if (Array.isArray(parsed.segments) && parsed.segments.length > 0) {
        const segments: TranscriptSegmentItem[] = parsed.segments.map(
          (seg: any, idx: number) => {
            const start = Math.max(0, Number(seg.startSeconds) || 0);
            const end = Math.min(
              durationSeconds,
              Math.max(start + 2, Number(seg.endSeconds) || start + 10)
            );
            return {
              id: idx + 1,
              startSeconds: start,
              endSeconds: end,
              startTimecode: formatSecondsToTimecode(start),
              endTimecode: formatSecondsToTimecode(end),
              text: String(seg.text || '').trim(),
            };
          }
        );

        return {
          engineUsed: 'gemini-3.5-transcribe',
          fasterWhisperInstalled: false,
          modelSize: `gemini-audio (faster-whisper ${modelSize} not installed in container)`,
          language: parsed.language || language,
          fullText: segments.map((s) => s.text).join(' '),
          segments,
          notice:
            'Local Python faster-whisper package is not installed in this container; audio was transcribed using Gemini Audio Transcription on the FFmpeg-extracted WAV file.',
        };
      }
    } catch (err: any) {
      console.warn('Gemini audio transcription fallback warning:', err?.message);
    }
  }

  // 3. Honest Acoustic Time-Window Segmentation (when faster-whisper is not installed in container and Gemini audio did not run)
  const step = Math.max(5, Math.min(15, Math.floor(durationSeconds / 4) || 5));
  const segments: TranscriptSegmentItem[] = [];
  let cursor = 0;
  let idx = 1;
  while (cursor < durationSeconds) {
    const next = Math.min(durationSeconds, cursor + step);
    segments.push({
      id: idx,
      startSeconds: Math.round(cursor * 10) / 10,
      endSeconds: Math.round(next * 10) / 10,
      startTimecode: formatSecondsToTimecode(cursor),
      endTimecode: formatSecondsToTimecode(next),
      text: `[Audio Segment ${idx} (${formatSecondsToTimecode(cursor)}–${formatSecondsToTimecode(next)}) from "${videoTitle}" — extracted 16kHz mono WAV via FFmpeg]`,
    });
    cursor = next;
    idx++;
  }

  return {
    engineUsed: 'ffmpeg-acoustic-segments',
    fasterWhisperInstalled: false,
    modelSize: `ffmpeg-wav (faster-whisper ${modelSize} not installed in container)`,
    language,
    fullText: segments.map((s) => s.text).join(' '),
    segments,
    notice:
      'Local Python faster-whisper is not installed in this container runtime. FFmpeg extracted the 16kHz WAV audio track and partitioned timecoded segments. Install faster-whisper via backend/requirements.txt on your host or configure GEMINI_API_KEY for AI speech transcription.',
  };
}
