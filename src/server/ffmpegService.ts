import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const VIDEOS_DIR = path.join(STORAGE_ROOT, 'videos');
export const AUDIO_DIR = path.join(STORAGE_ROOT, 'audio');
export const CLIPS_DIR = path.join(STORAGE_ROOT, 'clips');
export const THUMBNAILS_DIR = path.join(STORAGE_ROOT, 'thumbnails');

export async function ensureStorageDirectories(): Promise<void> {
  await fs.mkdir(VIDEOS_DIR, { recursive: true });
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  await fs.mkdir(CLIPS_DIR, { recursive: true });
  await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
}

export interface VideoMetadataResult {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  fileSizeBytes: number;
}

export function formatSecondsToTimecode(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function parseTimecodeToSeconds(timecode: string | number): number {
  if (typeof timecode === 'number') return Math.max(0, timecode);
  const clean = timecode.trim();
  if (/^\d+(\.\d+)?$/.test(clean)) {
    return Math.max(0, parseFloat(clean));
  }
  const parts = clean.split(':').map((p) => parseFloat(p));
  if (parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid timestamp format: "${timecode}". Use MM:SS or HH:MM:SS.`);
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  throw new Error(`Invalid timestamp format: "${timecode}".`);
}

export async function checkFfmpegCapabilities(): Promise<{
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  ffmpegVersion: string;
}> {
  try {
    const { stdout: ffmpegOut } = await execFileAsync('ffmpeg', ['-version']);
    const { stdout: ffprobeOut } = await execFileAsync('ffprobe', ['-version']);
    const firstLine = (ffmpegOut.split('\n')[0] || 'ffmpeg installed').trim();
    return {
      ffmpegAvailable: Boolean(ffmpegOut),
      ffprobeAvailable: Boolean(ffprobeOut),
      ffmpegVersion: firstLine,
    };
  } catch {
    return {
      ffmpegAvailable: false,
      ffprobeAvailable: false,
      ffmpegVersion: 'Unavailable',
    };
  }
}

export async function extractVideoMetadata(
  filePath: string
): Promise<VideoMetadataResult> {
  const stat = await fs.stat(filePath);
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=index,codec_name,codec_type,width,height,r_frame_rate',
    '-of',
    'json',
    filePath,
  ]);

  const parsed = JSON.parse(stdout);
  const streams: Array<Record<string, any>> = parsed.streams || [];
  const videoStream = streams.find((s) => s.codec_type === 'video');
  const audioStream = streams.find((s) => s.codec_type === 'audio');

  if (!videoStream) {
    throw new Error('Uploaded file does not contain a valid video stream.');
  }

  const durationSeconds = parseFloat(parsed.format?.duration || '0') || 10;
  const width = Number(videoStream.width) || 1280;
  const height = Number(videoStream.height) || 720;

  let fps = 30;
  if (typeof videoStream.r_frame_rate === 'string' && videoStream.r_frame_rate.includes('/')) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    if (num && den) {
      fps = Math.round((num / den) * 100) / 100;
    }
  }

  return {
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    width,
    height,
    fps,
    videoCodec: String(videoStream.codec_name || 'h264'),
    audioCodec: String(audioStream?.codec_name || 'none'),
    fileSizeBytes: stat.size,
  };
}

export async function extractAudioToWav(
  videoPath: string,
  outputWavFilename: string
): Promise<string> {
  await ensureStorageDirectories();
  const outputPath = path.join(AUDIO_DIR, outputWavFilename);

  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000',
      '-ac',
      '1',
      outputPath,
    ]);
  } catch {
    // If source video has no audio stream, generate a quiet 16kHz mono WAV track matching duration
    const meta = await extractVideoMetadata(videoPath);
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=16000:cl=mono:d=${Math.max(1, meta.durationSeconds)}`,
      '-acodec',
      'pcm_s16le',
      outputPath,
    ]);
  }

  return outputPath;
}

export async function generateVideoClipWithFfmpeg(params: {
  sourceVideoPath: string;
  outputClipFilename: string;
  outputThumbnailFilename: string;
  startSeconds: number;
  endSeconds: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
}): Promise<{
  clipPath: string;
  thumbnailPath: string;
  fileSizeBytes: number;
  durationSeconds: number;
}> {
  await ensureStorageDirectories();
  const {
    sourceVideoPath,
    outputClipFilename,
    outputThumbnailFilename,
    startSeconds,
    endSeconds,
    aspectRatio,
  } = params;

  const duration = Math.max(1, Math.round((endSeconds - startSeconds) * 100) / 100);
  const clipPath = path.join(CLIPS_DIR, outputClipFilename);
  const thumbnailPath = path.join(THUMBNAILS_DIR, outputThumbnailFilename);

  // Build smart crop / aspect ratio filtergraph
  let vfFilter = 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1';
  if (aspectRatio === '9:16') {
    vfFilter =
      'crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=720:1280,setsar=1';
  } else if (aspectRatio === '1:1') {
    vfFilter = 'crop=min(iw\\,ih):min(iw\\,ih),scale=720:720,setsar=1';
  }

  await execFileAsync('ffmpeg', [
    '-y',
    '-ss',
    String(startSeconds),
    '-i',
    sourceVideoPath,
    '-t',
    String(duration),
    '-vf',
    vfFilter,
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    clipPath,
  ]);

  // Generate thumbnail from midpoint of the generated clip
  const midPoint = Math.max(0, Math.min(duration - 0.2, duration / 2));
  await execFileAsync('ffmpeg', [
    '-y',
    '-ss',
    String(midPoint),
    '-i',
    clipPath,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    thumbnailPath,
  ]);

  const stat = await fs.stat(clipPath);
  return {
    clipPath,
    thumbnailPath,
    fileSizeBytes: stat.size,
    durationSeconds: duration,
  };
}

/**
 * Generates a real playable MP4 video file using FFmpeg for quick testing
 * if the user clicks "Create Real Test Video (FFmpeg)" or during automated verification.
 */
export async function synthesizeRealTestVideo(
  filename: string,
  durationSeconds = 60
): Promise<string> {
  await ensureStorageDirectories();
  const targetPath = path.join(VIDEOS_DIR, filename);

  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=1280x720:rate=30:duration=${durationSeconds}`,
    '-f',
    'lavfi',
    '-i',
    `sine=frequency=440:sample_rate=16000:duration=${durationSeconds}`,
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    targetPath,
  ]);

  return targetPath;
}
