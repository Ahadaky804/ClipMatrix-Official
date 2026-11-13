import { GoogleGenAI, Type } from '@google/genai';
import { formatSecondsToTimecode } from './ffmpegService.ts';
import {
  isGeminiApiKeyConfigured,
  TranscriptSegmentItem,
} from './transcriptionService.ts';

export interface ValidatedHighlightItem {
  title: string;
  reason: string;
  category: string;
  startSeconds: number;
  endSeconds: number;
  startTimecode: string;
  endTimecode: string;
  score: number;
}

export async function analyzeTranscriptWithGemini(params: {
  videoTitle: string;
  durationSeconds: number;
  segments: TranscriptSegmentItem[];
}): Promise<ValidatedHighlightItem[]> {
  const { videoTitle, durationSeconds, segments } = params;

  if (!isGeminiApiKeyConfigured()) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the backend. Add a valid GEMINI_API_KEY in AI Studio Settings > Secrets (or backend/.env) to run Gemini AI Highlight Detection, or use Manual Clip Selection below.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const formattedTranscript = segments
    .map(
      (s) =>
        `[${s.startSeconds.toFixed(1)}s - ${s.endSeconds.toFixed(1)}s] (${
          s.startTimecode
        }–${s.endTimecode}): ${s.text}`
    )
    .join('\n');

  const prompt = `You are a senior video editor and viral content strategist.
Analyze the following timestamped transcript for the video "${videoTitle}" (total duration: ${durationSeconds.toFixed(
    1
  )} seconds).

Identify 2 to 5 engaging highlight moments suitable for short-form video clips.
Rules:
1. Select meaningful clip startSeconds and endSeconds within [0, ${durationSeconds.toFixed(
    1
  )}].
2. Ensure endSeconds > startSeconds (each highlight should be between 5 and 60 seconds, bounded by total video duration).
3. Avoid cutting mid-sentence where possible.
4. Provide a compelling title, a clear explanation ("reason") why the moment was selected, a category ("hook", "educational", "funny", "emotional", "surprising", or "engaging"), and a highlight score from 0 to 100.

Transcript with timestamps:
${formattedTranscript}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Compelling title for the highlight clip.',
            },
            reason: {
              type: Type.STRING,
              description: 'Explanation of why this moment was selected.',
            },
            category: {
              type: Type.STRING,
              description:
                'One of: hook, educational, funny, emotional, surprising, engaging.',
            },
            startSeconds: {
              type: Type.NUMBER,
              description: 'Clip start timestamp in seconds.',
            },
            endSeconds: {
              type: Type.NUMBER,
              description: 'Clip end timestamp in seconds.',
            },
            score: {
              type: Type.INTEGER,
              description: 'Highlight virality/engagement score from 0 to 100.',
            },
          },
          required: [
            'title',
            'reason',
            'category',
            'startSeconds',
            'endSeconds',
            'score',
          ],
        },
      },
    },
  });

  const rawJson = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawJson);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Gemini returned an empty highlight list.');
  }

  return parsed.map((item: any) => {
    const rawStart = Math.max(0, Number(item.startSeconds) || 0);
    const maxEnd = Math.max(1, durationSeconds);
    const clampedStart = Math.min(rawStart, Math.max(0, maxEnd - 2));
    const rawEnd = Math.max(clampedStart + 2, Number(item.endSeconds) || clampedStart + 15);
    const clampedEnd = Math.min(maxEnd, rawEnd);
    const score = Math.max(0, Math.min(100, Math.round(Number(item.score) || 80)));

    return {
      title: String(item.title || 'Highlighted Moment').trim(),
      reason: String(item.reason || 'Selected for high engagement potential.').trim(),
      category: String(item.category || 'engaging').trim(),
      startSeconds: Math.round(clampedStart * 100) / 100,
      endSeconds: Math.round(clampedEnd * 100) / 100,
      startTimecode: formatSecondsToTimecode(clampedStart),
      endTimecode: formatSecondsToTimecode(clampedEnd),
      score,
    };
  });
}
