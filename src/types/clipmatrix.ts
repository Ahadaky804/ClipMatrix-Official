export type NavigationPageId =
  | 'overview'
  | 'live-streams'
  | 'my-streamers'
  | 'long-video'
  | 'podcast-clips'
  | 'ai-editing'
  | 'generated-clips'
  | 'caption-studio'
  | 'content-calendar'
  | 'social-accounts'
  | 'upload-approval'
  | 'analytics'
  | 'settings';

export type VideoSourceType =
  | 'local_upload'
  | 'youtube_url'
  | 'google_drive'
  | 'livestream_recording'
  | 'podcast_video';

export type ClipDurationPreset = 15 | 30 | 45 | 60 | 'custom';

export type AspectRatioPreset = '9:16' | '16:9' | '1:1';

export type ClipDetectionMode = 'auto_highlight' | 'manual_timestamp';

export type CaptionStyle =
  | 'funny'
  | 'viral'
  | 'professional'
  | 'emotional'
  | 'motivational'
  | 'storytelling';

export type CaptionLanguage = 'english' | 'urdu' | 'roman_urdu';

export type CaptionLength = 'short' | 'medium' | 'long';

export type SocialPlatform = 'youtube' | 'instagram' | 'tiktok';

export type ApprovalStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'published';

export type StreamerStatus = 'LIVE' | 'OFFLINE';

export interface StreamerProfile {
  id: string;
  name: string;
  handle: string;
  platform: 'YouTube' | 'Twitch' | 'Kick';
  avatarInitials: string;
  accentColor: string;
  status: StreamerStatus;
  currentStreamTitle: string;
  currentDuration: string;
  lastLiveTime: string;
  isMonitoring: boolean;
  isPaused: boolean;
  notificationsEnabled: boolean;
  clipsGeneratedCount: number;
  autoClipThreshold: number; // 1-100 virality score
}

export interface LiveStreamSession {
  id: string;
  streamerId: string;
  streamerName: string;
  streamerHandle: string;
  platform: 'YouTube' | 'Twitch' | 'Kick';
  streamTitle: string;
  startedAt: string;
  duration: string;
  viewerCount: number;
  bufferHealth: 'nominal' | 'high_activity';
  detectedMomentsCount: number;
  autoCaptureActive: boolean;
  recentSpikes: {
    timestamp: string;
    label: string;
    confidence: number;
  }[];
}

export interface VideoProject {
  id: string;
  dbId?: number;
  title: string;
  sourceType: VideoSourceType;
  sourceUrlOrFile: string;
  durationFormatted: string;
  createdAt: string;
  status: 'ready' | 'processing_stub' | 'queued';
  clipsCount: number;
  aspectRatio: AspectRatioPreset;
  detectionMode: ClipDetectionMode;
  videoUrl?: string;
  audioUrl?: string | null;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  isRealVideo?: boolean;
}

export interface AIEditConfig {
  subtitlesEnabled: boolean;
  subtitleFont: 'Plus Jakarta Sans' | 'DM Sans' | 'JetBrains Mono';
  subtitlePosition: 'bottom' | 'center' | 'top';
  smartReframing: boolean;
  faceTracking: boolean;
  autoZoomKeyframes: boolean;
  zoomIntensity: 'subtle' | 'balanced' | 'dynamic';
  backgroundMusicTrack: string;
  musicVolume: number;
  sfxEnabled: boolean;
  selectedThumbnailTimecode: string;
  thumbnailHeadline: string;
}

export interface GeneratedClip {
  id: string;
  dbId?: number;
  videoId?: number;
  projectId: string;
  projectTitle: string;
  title: string;
  sourceType: VideoSourceType;
  durationSeconds: number;
  aspectRatio: AspectRatioPreset;
  startTimecode: string;
  endTimecode: string;
  startSeconds?: number;
  endSeconds?: number;
  clipUrl?: string;
  thumbnailUrl?: string;
  fileSizeBytes?: number;
  isRealClip?: boolean;
  viralityScore: number;
  approvalStatus: ApprovalStatus;
  targetPlatforms: SocialPlatform[];
  captionText: string;
  captionLanguage: CaptionLanguage;
  createdAt: string;
  scheduledFor?: string;
  publishedAt?: string;
  reviewerNotes?: string;
  speakerLabel?: string;
  editConfig: AIEditConfig;
}

export interface BackendTranscriptSegment {
  id: number;
  startSeconds: number;
  endSeconds: number;
  startTimecode: string;
  endTimecode: string;
  text: string;
}

export interface BackendTranscriptRecord {
  id: number;
  videoId: number;
  engineUsed: string;
  modelSize: string;
  language: string;
  fullText: string;
  segments: BackendTranscriptSegment[];
  createdAt: string;
}

export interface BackendHighlightRecord {
  id: number;
  videoId: number;
  transcriptId: number | null;
  title: string;
  reason: string;
  category: string;
  startSeconds: number;
  endSeconds: number;
  startTimecode: string;
  endTimecode: string;
  score: number;
  createdAt: string;
}

export interface BackendClipRecord {
  id: number;
  videoId: number;
  highlightId: number | null;
  title: string;
  aspectRatio: AspectRatioPreset;
  durationSeconds: number;
  startSeconds: number;
  endSeconds: number;
  startTimecode: string;
  endTimecode: string;
  clipUrl: string;
  thumbnailUrl: string;
  fileSizeBytes: number;
  viralityScore: number;
  approvalStatus: ApprovalStatus;
  captionText: string;
  captionLanguage: CaptionLanguage;
  createdAt: string;
}

export interface BackendJobRecord {
  id: number;
  videoId: number;
  jobType: string;
  status: string;
  progressPercent: number;
  currentStep: string;
  errorMessage: string | null;
  resultMetaJson: string | null;
  createdAt: string;
}

export interface BackendVideoRecord {
  id: number;
  userUid: string;
  title: string;
  originalFilename: string;
  storedFilename: string;
  videoUrl: string;
  audioUrl: string | null;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  transcript: BackendTranscriptRecord | null;
  highlights: BackendHighlightRecord[];
  clips: BackendClipRecord[];
  jobs: BackendJobRecord[];
}

export interface PodcastSpeakerSegment {
  id: string;
  speakerName: string;
  role: 'Host' | 'Guest';
  startTime: string;
  endTime: string;
  transcriptSnippet: string;
  highlightScore: number;
}

export interface PodcastEpisode {
  id: string;
  showTitle: string;
  episodeTitle: string;
  episodeNumber: number;
  durationFormatted: string;
  speakers: string[];
  layoutMode: 'split_screen_9_16' | 'active_speaker_crop' | 'cinema_16_9';
  segments: PodcastSpeakerSegment[];
  clipsExtracted: number;
}

export interface CaptionOption {
  id: string;
  clipId: string;
  style: CaptionStyle;
  language: CaptionLanguage;
  length: CaptionLength;
  text: string;
  hashtags: string[];
  hasEmojis: boolean;
  isSaved: boolean;
  createdAt: string;
}

export interface ScheduledPost {
  id: string;
  clipId: string;
  clipTitle: string;
  platform: SocialPlatform;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  aspectRatio: AspectRatioPreset;
  status: 'scheduled' | 'published' | 'awaiting_approval';
  captionPreview: string;
}

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  handle: string;
  connected: boolean;
  tokenHealth: 'healthy' | 'expiring_soon' | 'disconnected';
  requireApprovalBeforePublish: boolean;
  defaultAspectRatio: AspectRatioPreset;
  subscribersOrFollowers: string;
  lastSyncedAt: string;
}

export interface PublishingActivityItem {
  id: string;
  clipTitle: string;
  platform: SocialPlatform;
  action: 'Published' | 'Scheduled' | 'Approved' | 'Edited' | 'Rejected';
  timestamp: string;
  actor: string;
}

export interface PlatformAnalytics {
  platform: SocialPlatform;
  label: string;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  engagementRate: number;
  publishedClipsCount: number;
  topClipTitle: string;
  growthDeltaPercent: number;
}

export interface DashboardStatistics {
  totalVideos: number;
  generatedClips: number;
  pendingApproval: number;
  publishedClips: number;
  activeLiveStreams: number;
  scheduledPosts: number;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  read: boolean;
  category: 'stream' | 'clip' | 'approval' | 'publish';
  targetPage: NavigationPageId;
}
