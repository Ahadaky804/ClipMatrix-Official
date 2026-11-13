import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyApprovalAction,
  calculateDashboardStats,
  filterClips,
  generateCaptionBatch,
  validateClipJobInput,
  validateStreamerInput,
} from './clipLogic';
import { GeneratedClip } from '../types/clipmatrix';

const mockClip: GeneratedClip = {
  id: 'clip-1',
  projectId: 'proj-1',
  projectTitle: 'AI Architecture Keynote',
  title: 'Why Local Whisper + Gemini Wins',
  sourceType: 'youtube_url',
  durationSeconds: 45,
  aspectRatio: '9:16',
  startTimecode: '12:10',
  endTimecode: '12:55',
  viralityScore: 94,
  approvalStatus: 'pending_approval',
  targetPlatforms: ['youtube', 'tiktok'],
  captionText: 'Initial caption text',
  captionLanguage: 'english',
  createdAt: '10m ago',
  editConfig: {
    subtitlesEnabled: true,
    subtitleFont: 'Plus Jakarta Sans',
    subtitlePosition: 'bottom',
    smartReframing: true,
    faceTracking: true,
    autoZoomKeyframes: true,
    zoomIntensity: 'balanced',
    backgroundMusicTrack: 'Cyber Pulse Low-Fi',
    musicVolume: 18,
    sfxEnabled: true,
    selectedThumbnailTimecode: '12:24',
    thumbnailHeadline: 'LOCAL AI PIPELINE',
  },
};

test('calculateDashboardStats computes accurate metrics across projects, clips, streams, and schedules', () => {
  const stats = calculateDashboardStats({
    projects: [
      {
        id: 'p1',
        title: 'Project 1',
        sourceType: 'youtube_url',
        sourceUrlOrFile: 'https://youtube.com/watch?v=123',
        durationFormatted: '42:10',
        createdAt: 'Today',
        status: 'ready',
        clipsCount: 2,
        aspectRatio: '9:16',
        detectionMode: 'auto_highlight',
      },
    ],
    clips: [
      mockClip,
      { ...mockClip, id: 'clip-2', approvalStatus: 'published' },
    ],
    liveSessions: [],
    streamers: [
      {
        id: 's1',
        name: 'Kai',
        handle: '@kai',
        platform: 'Twitch',
        avatarInitials: 'KA',
        accentColor: '#8B5CF6',
        status: 'LIVE',
        currentStreamTitle: 'Live Coding',
        currentDuration: '01:20:00',
        lastLiveTime: 'Live now',
        isMonitoring: true,
        isPaused: false,
        notificationsEnabled: true,
        clipsGeneratedCount: 4,
        autoClipThreshold: 85,
      },
    ],
    scheduledPosts: [
      {
        id: 'sp1',
        clipId: 'clip-2',
        clipTitle: 'Clip 2',
        platform: 'youtube',
        scheduledDate: '2026-11-14',
        scheduledTime: '18:00',
        aspectRatio: '9:16',
        status: 'scheduled',
        captionPreview: 'Test',
      },
    ],
  });

  assert.equal(stats.totalVideos, 1);
  assert.equal(stats.generatedClips, 2);
  assert.equal(stats.pendingApproval, 1);
  assert.equal(stats.publishedClips, 1);
  assert.equal(stats.activeLiveStreams, 1);
  assert.equal(stats.scheduledPosts, 1);
});

test('validateClipJobInput validates YouTube URLs, Google Drive links, custom durations, and manual timestamps', () => {
  const invalidYt = validateClipJobInput({
    title: 'Keynote Cut',
    sourceType: 'youtube_url',
    sourceValue: 'https://example.com/video.mp4',
    durationPreset: 30,
    detectionMode: 'auto_highlight',
  });
  assert.equal(invalidYt.valid, false);

  const validYt = validateClipJobInput({
    title: 'Keynote Cut',
    sourceType: 'youtube_url',
    sourceValue: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    durationPreset: 45,
    detectionMode: 'auto_highlight',
  });
  assert.equal(validYt.valid, true);

  const invalidCustomDuration = validateClipJobInput({
    title: 'Podcast Cut',
    sourceType: 'local_upload',
    sourceValue: 'podcast_ep42.mp4',
    durationPreset: 'custom',
    customDurationSeconds: 300,
    detectionMode: 'auto_highlight',
  });
  assert.equal(invalidCustomDuration.valid, false);

  const validManualTimestamp = validateClipJobInput({
    title: 'Manual Highlight',
    sourceType: 'google_drive',
    sourceValue: 'https://drive.google.com/file/d/abc123/view',
    durationPreset: 60,
    detectionMode: 'manual_timestamp',
    manualStartTime: '04:10',
    manualEndTime: '05:10',
  });
  assert.equal(validManualTimestamp.valid, true);
});

test('validateStreamerInput enforces valid name, handle, and threshold bounds', () => {
  assert.equal(
    validateStreamerInput({ name: 'A', handle: '@test', platform: 'YouTube', autoClipThreshold: 80 }).valid,
    false
  );
  assert.equal(
    validateStreamerInput({ name: 'Zayn Live', handle: '@zaynlive', platform: 'YouTube', autoClipThreshold: 88 }).valid,
    true
  );
});

test('generateCaptionBatch generates 5-10 localized options across English, Urdu, and Roman Urdu', () => {
  const urduBatch = generateCaptionBatch({
    clipId: 'clip-1',
    clipTitle: 'AI Studio Breakdown',
    style: 'viral',
    language: 'urdu',
    length: 'medium',
    includeEmojis: true,
    includeHashtags: true,
    count: 6,
  });

  assert.equal(urduBatch.length, 6);
  assert.equal(urduBatch[0].language, 'urdu');
  assert.ok(urduBatch[0].text.includes('AI Studio Breakdown'));
  assert.ok(urduBatch[0].hashtags.includes('#ClipMatrix'));

  const romanBatch = generateCaptionBatch({
    clipId: 'clip-1',
    clipTitle: 'Podcast Episode 12',
    style: 'storytelling',
    language: 'roman_urdu',
    length: 'long',
    includeEmojis: false,
    includeHashtags: false,
    count: 8,
  });

  assert.equal(romanBatch.length, 8);
  assert.equal(romanBatch[0].hashtags.length, 0);
  assert.equal(romanBatch[0].hasEmojis, false);
});

test('filterClips and applyApprovalAction update and filter clip collections accurately', () => {
  const clips = [
    mockClip,
    { ...mockClip, id: 'clip-2', aspectRatio: '16:9' as const, approvalStatus: 'approved' as const },
  ];

  const verticalOnly = filterClips(clips, { aspectRatio: '9:16' });
  assert.equal(verticalOnly.length, 1);
  assert.equal(verticalOnly[0].id, 'clip-1');

  const updated = applyApprovalAction(clips, 'clip-1', 'approved', {
    reviewerNotes: 'Ready for YouTube Shorts',
  });
  assert.equal(updated[0].approvalStatus, 'approved');
  assert.equal(updated[0].reviewerNotes, 'Ready for YouTube Shorts');
});
