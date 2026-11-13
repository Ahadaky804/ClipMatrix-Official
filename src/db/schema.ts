import { relations } from 'drizzle-orm';
import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  title: text('title').notNull(),
  originalFilename: text('original_filename').notNull(),
  storedFilename: text('stored_filename').notNull(),
  videoUrl: text('video_url').notNull(),
  audioUrl: text('audio_url'),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  mimeType: text('mime_type').notNull(),
  durationSeconds: doublePrecision('duration_seconds').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  fps: doublePrecision('fps').notNull(),
  videoCodec: text('video_codec').notNull(),
  audioCodec: text('audio_codec').notNull(),
  status: text('status').notNull().default('uploaded'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const transcripts = pgTable('transcripts', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id')
    .references(() => videos.id, { onDelete: 'cascade' })
    .notNull(),
  engineUsed: text('engine_used').notNull(),
  modelSize: text('model_size').notNull(),
  language: text('language').notNull(),
  fullText: text('full_text').notNull(),
  segmentsJson: text('segments_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const highlights = pgTable('highlights', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id')
    .references(() => videos.id, { onDelete: 'cascade' })
    .notNull(),
  transcriptId: integer('transcript_id').references(() => transcripts.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  reason: text('reason').notNull(),
  category: text('category').notNull().default('engaging'),
  startSeconds: doublePrecision('start_seconds').notNull(),
  endSeconds: doublePrecision('end_seconds').notNull(),
  startTimecode: text('start_timecode').notNull(),
  endTimecode: text('end_timecode').notNull(),
  score: integer('score').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const generatedClips = pgTable('generated_clips', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id')
    .references(() => videos.id, { onDelete: 'cascade' })
    .notNull(),
  highlightId: integer('highlight_id').references(() => highlights.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  aspectRatio: text('aspect_ratio').notNull(),
  durationSeconds: doublePrecision('duration_seconds').notNull(),
  startSeconds: doublePrecision('start_seconds').notNull(),
  endSeconds: doublePrecision('end_seconds').notNull(),
  startTimecode: text('start_timecode').notNull(),
  endTimecode: text('end_timecode').notNull(),
  clipUrl: text('clip_url').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  viralityScore: integer('virality_score').notNull().default(85),
  approvalStatus: text('approval_status').notNull().default('pending_approval'),
  captionText: text('caption_text').notNull(),
  captionLanguage: text('caption_language').notNull().default('english'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const processingJobs = pgTable('processing_jobs', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id')
    .references(() => videos.id, { onDelete: 'cascade' })
    .notNull(),
  jobType: text('job_type').notNull(),
  status: text('status').notNull(),
  progressPercent: integer('progress_percent').notNull().default(0),
  currentStep: text('current_step').notNull(),
  errorMessage: text('error_message'),
  resultMetaJson: text('result_meta_json'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Relations
export const videosRelations = relations(videos, ({ many }) => ({
  transcripts: many(transcripts),
  highlights: many(highlights),
  generatedClips: many(generatedClips),
  processingJobs: many(processingJobs),
}));

export const transcriptsRelations = relations(transcripts, ({ one, many }) => ({
  video: one(videos, {
    fields: [transcripts.videoId],
    references: [videos.id],
  }),
  highlights: many(highlights),
}));

export const highlightsRelations = relations(highlights, ({ one, many }) => ({
  video: one(videos, {
    fields: [highlights.videoId],
    references: [videos.id],
  }),
  transcript: one(transcripts, {
    fields: [highlights.transcriptId],
    references: [transcripts.id],
  }),
  generatedClips: many(generatedClips),
}));

export const generatedClipsRelations = relations(generatedClips, ({ one }) => ({
  video: one(videos, {
    fields: [generatedClips.videoId],
    references: [videos.id],
  }),
  highlight: one(highlights, {
    fields: [generatedClips.highlightId],
    references: [highlights.id],
  }),
}));

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  video: one(videos, {
    fields: [processingJobs.videoId],
    references: [videos.id],
  }),
}));
