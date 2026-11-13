import React, { useState, useMemo } from 'react';
import {
  AIEditConfig,
  ApprovalStatus,
  AspectRatioPreset,
  CaptionLanguage,
  CaptionOption,
  GeneratedClip,
  LiveStreamSession,
  NavigationPageId,
  PodcastEpisode,
  PublishingActivityItem,
  ScheduledPost,
  SocialAccount,
  StreamerProfile,
  VideoProject,
} from './types/clipmatrix';
import {
  INITIAL_ANALYTICS,
  INITIAL_CAPTIONS,
  INITIAL_CLIPS,
  INITIAL_LIVE_SESSIONS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PODCAST_EPISODES,
  INITIAL_PROJECTS,
  INITIAL_PUBLISHING_ACTIVITY,
  INITIAL_SCHEDULED_POSTS,
  INITIAL_SOCIAL_ACCOUNTS,
  INITIAL_STREAMERS,
} from './data/sampleData';
import {
  applyApprovalAction,
  calculateDashboardStats,
} from './utils/clipLogic';
import { Sidebar } from './components/layout/Sidebar';
import { TopNavbar } from './components/layout/TopNavbar';
import { OverviewPage } from './pages/OverviewPage';
import { LiveStreamsPage } from './pages/LiveStreamsPage';
import { MyStreamersPage } from './pages/MyStreamersPage';
import { LongVideoToClipsPage } from './pages/LongVideoToClipsPage';
import { PodcastClipsPage } from './pages/PodcastClipsPage';
import { AIEditingStudioPage } from './pages/AIEditingStudioPage';
import { GeneratedClipsPage } from './pages/GeneratedClipsPage';
import { CaptionStudioPage } from './pages/CaptionStudioPage';
import { ContentCalendarPage } from './pages/ContentCalendarPage';
import { SocialAccountsPage } from './pages/SocialAccountsPage';
import { UploadApprovalPage } from './pages/UploadApprovalPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  const [activePage, setActivePage] = useState<NavigationPageId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Core Workspace State (Sample Data separated from backend service layer)
  const [projects, setProjects] = useState<VideoProject[]>(INITIAL_PROJECTS);
  const [clips, setClips] = useState<GeneratedClip[]>(INITIAL_CLIPS);
  const [streamers, setStreamers] = useState<StreamerProfile[]>(INITIAL_STREAMERS);
  const [liveSessions, setLiveSessions] = useState<LiveStreamSession[]>(
    INITIAL_LIVE_SESSIONS
  );
  const [podcastEpisodes] = useState<PodcastEpisode[]>(INITIAL_PODCAST_EPISODES);
  const [captions, setCaptions] = useState<CaptionOption[]>(INITIAL_CAPTIONS);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(
    INITIAL_SCHEDULED_POSTS
  );
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>(
    INITIAL_SOCIAL_ACCOUNTS
  );
  const [publishingActivity, setPublishingActivity] = useState<
    PublishingActivityItem[]
  >(INITIAL_PUBLISHING_ACTIVITY);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [selectedClipId, setSelectedClipId] = useState<string>(
    INITIAL_CLIPS[0]?.id || ''
  );

  const stats = useMemo(
    () =>
      calculateDashboardStats({
        projects,
        clips,
        liveSessions,
        streamers,
        scheduledPosts,
      }),
    [projects, clips, liveSessions, streamers, scheduledPosts]
  );

  // Handlers for Live Streams
  const handleToggleAutoCapture = (sessionId: string) => {
    setLiveSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, autoCaptureActive: !s.autoCaptureActive } : s
      )
    );
  };

  const handleTriggerInstantClip = (sessionId: string, spikeLabel: string) => {
    const session = liveSessions.find((s) => s.id === sessionId);
    if (!session) return;

    const newClip: GeneratedClip = {
      id: `clip-live-${Date.now()}`,
      projectId: 'proj-103',
      projectTitle: `${session.streamerName} Live Stream`,
      title: `${session.streamerName}: ${spikeLabel}`,
      sourceType: 'livestream_recording',
      durationSeconds: 45,
      aspectRatio: '9:16',
      startTimecode: session.duration,
      endTimecode: 'LIVE+45s',
      viralityScore: 93,
      approvalStatus: 'pending_approval',
      targetPlatforms: ['youtube', 'tiktok'],
      captionText: `🔥⚡ Instant live buffer clip from ${session.streamerName}: "${spikeLabel}" #ClipMatrix #LiveClips`,
      captionLanguage: 'english',
      createdAt: 'Just now',
      speakerLabel: session.streamerName,
      editConfig: {
        subtitlesEnabled: true,
        subtitleFont: 'Plus Jakarta Sans',
        subtitlePosition: 'bottom',
        smartReframing: true,
        faceTracking: true,
        autoZoomKeyframes: true,
        zoomIntensity: 'dynamic',
        backgroundMusicTrack: 'None (Original Stream Audio)',
        musicVolume: 0,
        sfxEnabled: true,
        selectedThumbnailTimecode: session.duration,
        thumbnailHeadline: spikeLabel.toUpperCase().slice(0, 24),
      },
    };

    setClips((prev) => [newClip, ...prev]);
    setSelectedClipId(newClip.id);
  };

  // Handlers for My Streamers
  const handleAddStreamer = (newStreamerData: Omit<StreamerProfile, 'id'>) => {
    const newStreamer: StreamerProfile = {
      ...newStreamerData,
      id: `streamer-${Date.now()}`,
    };
    setStreamers((prev) => [newStreamer, ...prev]);
  };

  const handleTogglePauseStreamer = (id: string) => {
    setStreamers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isPaused: !s.isPaused } : s))
    );
  };

  const handleToggleStreamerNotifications = (id: string) => {
    setStreamers((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, notificationsEnabled: !s.notificationsEnabled }
          : s
      )
    );
  };

  const handleRemoveStreamer = (id: string) => {
    setStreamers((prev) => prev.filter((s) => s.id !== id));
  };

  // Handlers for Long Video to Clips & Podcast Clips
  const handleCreateProjectAndClips = (params: {
    project: VideoProject;
    generatedClips: GeneratedClip[];
  }) => {
    setProjects((prev) => [params.project, ...prev]);
    setClips((prev) => [...params.generatedClips, ...prev]);
    if (params.generatedClips[0]) {
      setSelectedClipId(params.generatedClips[0].id);
    }
  };

  const handleExtractPodcastSegment = (clip: GeneratedClip) => {
    setClips((prev) => [clip, ...prev]);
    setSelectedClipId(clip.id);
  };

  // Handlers for AI Editing Studio
  const handleUpdateClipEditConfig = (
    clipId: string,
    editConfig: AIEditConfig,
    aspectRatio: AspectRatioPreset
  ) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId ? { ...c, editConfig, aspectRatio } : c
      )
    );
  };

  // Handlers for Caption Studio
  const handleApplyCaptionToClip = (
    clipId: string,
    captionText: string,
    language: CaptionLanguage
  ) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId
          ? { ...c, captionText, captionLanguage: language }
          : c
      )
    );
  };

  // Handlers for Content Calendar
  const handleAddScheduledPost = (postData: Omit<ScheduledPost, 'id'>) => {
    const newPost: ScheduledPost = {
      ...postData,
      id: `sched-${Date.now()}`,
    };
    setScheduledPosts((prev) => [newPost, ...prev]);
  };

  const handleRemoveScheduledPost = (id: string) => {
    setScheduledPosts((prev) => prev.filter((p) => p.id !== id));
  };

  // Handlers for Social Accounts
  const handleToggleAccountConnection = (id: string) => {
    setSocialAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id
          ? {
              ...acc,
              connected: !acc.connected,
              tokenHealth: !acc.connected ? 'healthy' : 'disconnected',
            }
          : acc
      )
    );
  };

  const handleToggleApprovalRequirement = (id: string) => {
    setSocialAccounts((prev) =>
      prev.map((acc) =>
        acc.id === id
          ? {
              ...acc,
              requireApprovalBeforePublish: !acc.requireApprovalBeforePublish,
            }
          : acc
      )
    );
  };

  // Handlers for Upload Approval
  const handleApprovalDecision = (
    clipId: string,
    status: ApprovalStatus,
    options?: {
      reviewerNotes?: string;
      scheduledFor?: string;
      captionText?: string;
    }
  ) => {
    const targetClip = clips.find((c) => c.id === clipId);
    setClips((prev) => applyApprovalAction(prev, clipId, status, options));

    if (targetClip) {
      const actionMap: Record<
        ApprovalStatus,
        PublishingActivityItem['action']
      > = {
        approved: 'Approved',
        rejected: 'Rejected',
        scheduled: 'Scheduled',
        published: 'Published',
        pending_approval: 'Edited',
      };

      const newAct: PublishingActivityItem = {
        id: `act-${Date.now()}`,
        clipTitle: targetClip.title,
        platform: targetClip.targetPlatforms[0] || 'youtube',
        action: actionMap[status],
        timestamp: 'Just now',
        actor:
          status === 'scheduled' && options?.scheduledFor
            ? `Scheduled for ${options.scheduledFor}`
            : 'Approval Queue Decision',
      };
      setPublishingActivity((prev) => [newAct, ...prev]);

      if (status === 'scheduled' && options?.scheduledFor) {
        const [datePart, timePart] = options.scheduledFor.split(' ');
        setScheduledPosts((prev) => [
          {
            id: `sched-${Date.now()}`,
            clipId: targetClip.id,
            clipTitle: targetClip.title,
            platform: targetClip.targetPlatforms[0] || 'youtube',
            scheduledDate: datePart || '2026-11-15',
            scheduledTime: timePart || '18:00',
            aspectRatio: targetClip.aspectRatio,
            status: 'scheduled',
            captionPreview: (options.captionText || targetClip.captionText).slice(
              0,
              80
            ),
          },
          ...prev,
        ]);
      }
    }
  };

  const handleResetSampleWorkspace = () => {
    setProjects(INITIAL_PROJECTS);
    setClips(INITIAL_CLIPS);
    setStreamers(INITIAL_STREAMERS);
    setLiveSessions(INITIAL_LIVE_SESSIONS);
    setCaptions(INITIAL_CAPTIONS);
    setScheduledPosts(INITIAL_SCHEDULED_POSTS);
    setSocialAccounts(INITIAL_SOCIAL_ACCOUNTS);
    setPublishingActivity(INITIAL_PUBLISHING_ACTIVITY);
    setNotifications(INITIAL_NOTIFICATIONS);
  };

  return (
    <div className="min-h-screen flex bg-[#090A0F] text-[#F3F4F6]">
      {/* Left Collapsible Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        liveCount={stats.activeLiveStreams}
        pendingApprovalCount={stats.pendingApproval}
      />

      {/* Right Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNavbar
          activePage={activePage}
          onNavigate={setActivePage}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          notifications={notifications}
          onMarkAllNotificationsRead={() =>
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
          }
          clips={clips}
          streamers={streamers}
          onQuickCreateClip={() => setActivePage('long-video')}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activePage === 'overview' && (
            <OverviewPage
              stats={stats}
              projects={projects}
              clips={clips}
              streamers={streamers}
              publishingActivity={publishingActivity}
              onNavigate={setActivePage}
              onSelectClipForStudio={setSelectedClipId}
            />
          )}

          {activePage === 'live-streams' && (
            <LiveStreamsPage
              liveSessions={liveSessions}
              onToggleAutoCapture={handleToggleAutoCapture}
              onTriggerInstantClip={handleTriggerInstantClip}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'my-streamers' && (
            <MyStreamersPage
              streamers={streamers}
              onAddStreamer={handleAddStreamer}
              onTogglePauseStreamer={handleTogglePauseStreamer}
              onToggleNotifications={handleToggleStreamerNotifications}
              onRemoveStreamer={handleRemoveStreamer}
            />
          )}

          {activePage === 'long-video' && (
            <LongVideoToClipsPage
              projects={projects}
              onCreateProjectAndClips={handleCreateProjectAndClips}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'podcast-clips' && (
            <PodcastClipsPage
              episodes={podcastEpisodes}
              onExtractPodcastSegment={handleExtractPodcastSegment}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'ai-editing' && (
            <AIEditingStudioPage
              clips={clips}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
              onUpdateClipEditConfig={handleUpdateClipEditConfig}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'generated-clips' && (
            <GeneratedClipsPage
              clips={clips}
              onSelectClipForStudio={setSelectedClipId}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'caption-studio' && (
            <CaptionStudioPage
              clips={clips}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
              captions={captions}
              onSetCaptions={setCaptions}
              onApplyCaptionToClip={handleApplyCaptionToClip}
            />
          )}

          {activePage === 'content-calendar' && (
            <ContentCalendarPage
              scheduledPosts={scheduledPosts}
              clips={clips}
              onAddScheduledPost={handleAddScheduledPost}
              onRemoveScheduledPost={handleRemoveScheduledPost}
            />
          )}

          {activePage === 'social-accounts' && (
            <SocialAccountsPage
              accounts={socialAccounts}
              onToggleAccountConnection={handleToggleAccountConnection}
              onToggleApprovalRequirement={handleToggleApprovalRequirement}
            />
          )}

          {activePage === 'upload-approval' && (
            <UploadApprovalPage
              clips={clips}
              onApprovalDecision={handleApprovalDecision}
              onSelectClipForStudio={setSelectedClipId}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'analytics' && (
            <AnalyticsPage
              platformAnalytics={INITIAL_ANALYTICS}
              clips={clips}
            />
          )}

          {activePage === 'settings' && (
            <SettingsPage
              onResetSampleWorkspace={handleResetSampleWorkspace}
            />
          )}
        </main>
      </div>
    </div>
  );
}
