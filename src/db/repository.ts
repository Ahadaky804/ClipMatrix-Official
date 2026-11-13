import { desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  generatedClips,
  highlights,
  processingJobs,
  transcripts,
  users,
  videos,
} from './schema.ts';

export async function getOrCreateUser(uid: string, email: string) {
  try {
    const result = await db
      .insert(users)
      .values({ uid, email })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function insertVideoRecord(data: typeof videos.$inferInsert) {
  try {
    const result = await db.insert(videos).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Failed to insert video record:', error);
    throw new Error('Failed to save uploaded video record.', { cause: error });
  }
}

export async function updateVideoRecord(
  videoId: number,
  updates: Partial<typeof videos.$inferInsert>
) {
  try {
    const result = await db
      .update(videos)
      .set(updates)
      .where(eq(videos.id, videoId))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Failed to update video record:', error);
    throw new Error('Failed to update video status.', { cause: error });
  }
}

export async function getAllVideos() {
  try {
    return await db.select().from(videos).orderBy(desc(videos.createdAt));
  } catch (error) {
    console.error('Failed to query videos:', error);
    throw new Error('Failed to load videos.', { cause: error });
  }
}

export async function getVideoById(videoId: number) {
  try {
    const rows = await db.select().from(videos).where(eq(videos.id, videoId));
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to query video by ID:', error);
    throw new Error('Failed to load video details.', { cause: error });
  }
}

export async function insertTranscriptRecord(
  data: typeof transcripts.$inferInsert
) {
  try {
    // Remove previous transcripts for this video so re-transcription stays clean
    await db.delete(transcripts).where(eq(transcripts.videoId, data.videoId));
    const result = await db.insert(transcripts).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Failed to insert transcript:', error);
    throw new Error('Failed to store video transcript.', { cause: error });
  }
}

export async function getTranscriptByVideoId(videoId: number) {
  try {
    const rows = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.videoId, videoId))
      .orderBy(desc(transcripts.createdAt));
    return rows[0] || null;
  } catch (error) {
    console.error('Failed to fetch transcript:', error);
    throw new Error('Failed to load transcript.', { cause: error });
  }
}

export async function replaceVideoHighlights(
  videoId: number,
  items: (typeof highlights.$inferInsert)[]
) {
  try {
    await db.delete(highlights).where(eq(highlights.videoId, videoId));
    if (items.length === 0) return [];
    return await db.insert(highlights).values(items).returning();
  } catch (error) {
    console.error('Failed to insert highlights:', error);
    throw new Error('Failed to store AI highlights.', { cause: error });
  }
}

export async function getHighlightsByVideoId(videoId: number) {
  try {
    return await db
      .select()
      .from(highlights)
      .where(eq(highlights.videoId, videoId))
      .orderBy(desc(highlights.score));
  } catch (error) {
    console.error('Failed to fetch highlights:', error);
    throw new Error('Failed to load highlights.', { cause: error });
  }
}

export async function getAllHighlights() {
  try {
    return await db.select().from(highlights).orderBy(desc(highlights.score));
  } catch (error) {
    console.error('Failed to fetch all highlights:', error);
    throw new Error('Failed to load highlights.', { cause: error });
  }
}

export async function insertGeneratedClipRecord(
  data: typeof generatedClips.$inferInsert
) {
  try {
    const result = await db.insert(generatedClips).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Failed to insert generated clip:', error);
    throw new Error('Failed to save generated clip.', { cause: error });
  }
}

export async function getAllGeneratedClips() {
  try {
    return await db
      .select()
      .from(generatedClips)
      .orderBy(desc(generatedClips.createdAt));
  } catch (error) {
    console.error('Failed to fetch generated clips:', error);
    throw new Error('Failed to load generated clips.', { cause: error });
  }
}

export async function updateGeneratedClipApproval(
  clipId: number,
  updates: Partial<typeof generatedClips.$inferInsert>
) {
  try {
    const result = await db
      .update(generatedClips)
      .set(updates)
      .where(eq(generatedClips.id, clipId))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Failed to update generated clip:', error);
    throw new Error('Failed to update clip status.', { cause: error });
  }
}

export async function createProcessingJobRecord(
  data: typeof processingJobs.$inferInsert
) {
  try {
    const result = await db.insert(processingJobs).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Failed to create processing job:', error);
    throw new Error('Failed to create processing job.', { cause: error });
  }
}

export async function updateProcessingJobRecord(
  jobId: number,
  updates: Partial<typeof processingJobs.$inferInsert>
) {
  try {
    const result = await db
      .update(processingJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(processingJobs.id, jobId))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Failed to update processing job:', error);
    throw new Error('Failed to update processing job.', { cause: error });
  }
}

export async function getJobsByVideoId(videoId: number) {
  try {
    return await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.videoId, videoId))
      .orderBy(desc(processingJobs.createdAt));
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    throw new Error('Failed to load processing jobs.', { cause: error });
  }
}
