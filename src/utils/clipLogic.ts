import {
  ApprovalStatus,
  AspectRatioPreset,
  CaptionLanguage,
  CaptionLength,
  CaptionOption,
  CaptionStyle,
  ClipDetectionMode,
  ClipDurationPreset,
  DashboardStatistics,
  GeneratedClip,
  LiveStreamSession,
  ScheduledPost,
  StreamerProfile,
  VideoProject,
  VideoSourceType,
} from '../types/clipmatrix';

export function calculateDashboardStats(params: {
  projects: VideoProject[];
  clips: GeneratedClip[];
  liveSessions: LiveStreamSession[];
  streamers: StreamerProfile[];
  scheduledPosts: ScheduledPost[];
}): DashboardStatistics {
  const { projects, clips, liveSessions, streamers, scheduledPosts } = params;

  const pendingApproval = clips.filter((c) => c.approvalStatus === 'pending_approval').length;
  const publishedClips = clips.filter((c) => c.approvalStatus === 'published').length;
  const liveCountFromStreamers = streamers.filter((s) => s.status === 'LIVE').length;
  const activeLiveStreams = Math.max(liveSessions.length, liveCountFromStreamers);
  const activeScheduled = scheduledPosts.filter((p) => p.status === 'scheduled').length;

  return {
    totalVideos: projects.length,
    generatedClips: clips.length,
    pendingApproval,
    publishedClips,
    activeLiveStreams,
    scheduledPosts: activeScheduled,
  };
}

export interface ClipJobValidationInput {
  title: string;
  sourceType: VideoSourceType;
  sourceValue: string;
  durationPreset: ClipDurationPreset;
  customDurationSeconds?: number;
  detectionMode: ClipDetectionMode;
  manualStartTime?: string;
  manualEndTime?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateClipJobInput(input: ClipJobValidationInput): ValidationResult {
  const cleanTitle = input.title.trim();
  const cleanSource = input.sourceValue.trim();

  if (!cleanTitle || cleanTitle.length < 3) {
    return { valid: false, error: 'Project title must be at least 3 characters long.' };
  }

  if (!cleanSource) {
    return { valid: false, error: 'Please provide a valid video file name or source URL.' };
  }

  if (input.sourceType === 'youtube_url') {
    const isYt =
      cleanSource.includes('youtube.com/') ||
      cleanSource.includes('youtu.be/');
    if (!isYt) {
      return { valid: false, error: 'Enter a valid YouTube URL (youtube.com or youtu.be).' };
    }
  }

  if (input.sourceType === 'google_drive') {
    if (!cleanSource.includes('drive.google.com')) {
      return { valid: false, error: 'Enter a valid Google Drive link (drive.google.com).' };
    }
  }

  if (input.durationPreset === 'custom') {
    const customSec = Number(input.customDurationSeconds);
    if (!Number.isFinite(customSec) || customSec < 5 || customSec > 180) {
      return {
        valid: false,
        error: 'Custom clip duration must be between 5 and 180 seconds.',
      };
    }
  }

  if (input.detectionMode === 'manual_timestamp') {
    const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
    if (
      !input.manualStartTime ||
      !input.manualEndTime ||
      !timeRegex.test(input.manualStartTime.trim()) ||
      !timeRegex.test(input.manualEndTime.trim())
    ) {
      return {
        valid: false,
        error: 'Manual timestamps must use MM:SS or HH:MM:SS format (e.g. 04:15 to 05:00).',
      };
    }
    if (input.manualStartTime.trim() === input.manualEndTime.trim()) {
      return {
        valid: false,
        error: 'End timestamp must be later than start timestamp.',
      };
    }
  }

  return { valid: true };
}

export function validateStreamerInput(input: {
  name: string;
  handle: string;
  platform: string;
  autoClipThreshold: number;
}): ValidationResult {
  if (!input.name.trim() || input.name.trim().length < 2) {
    return { valid: false, error: 'Streamer display name is required (min 2 characters).' };
  }
  const cleanHandle = input.handle.trim();
  if (!cleanHandle || cleanHandle.length < 2) {
    return { valid: false, error: 'Channel handle is required (e.g. @creator_live).' };
  }
  if (input.autoClipThreshold < 50 || input.autoClipThreshold > 99) {
    return { valid: false, error: 'Auto-clip virality threshold must be between 50% and 99%.' };
  }
  return { valid: true };
}

export function filterClips(
  clips: GeneratedClip[],
  filters: {
    searchQuery?: string;
    aspectRatio?: AspectRatioPreset | 'all';
    approvalStatus?: ApprovalStatus | 'all';
    sourceType?: VideoSourceType | 'all';
    minDuration?: number;
  }
): GeneratedClip[] {
  return clips.filter((clip) => {
    if (filters.aspectRatio && filters.aspectRatio !== 'all' && clip.aspectRatio !== filters.aspectRatio) {
      return false;
    }
    if (
      filters.approvalStatus &&
      filters.approvalStatus !== 'all' &&
      clip.approvalStatus !== filters.approvalStatus
    ) {
      return false;
    }
    if (filters.sourceType && filters.sourceType !== 'all' && clip.sourceType !== filters.sourceType) {
      return false;
    }
    if (filters.minDuration && clip.durationSeconds < filters.minDuration) {
      return false;
    }
    if (filters.searchQuery && filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchTitle = clip.title.toLowerCase().includes(q);
      const matchProject = clip.projectTitle.toLowerCase().includes(q);
      const matchCaption = clip.captionText.toLowerCase().includes(q);
      if (!matchTitle && !matchProject && !matchCaption) {
        return false;
      }
    }
    return true;
  });
}

const STYLE_TEMPLATES: Record<
  CaptionLanguage,
  Record<CaptionStyle, string[]>
> = {
  english: {
    viral: [
      'Nobody expected what happened at {timecode} during "{topic}" — watch till the final second.',
      'This 45-second breakdown on {topic} changes everything you thought you knew.',
      '99% of creators miss this exact detail in {topic}. Here is the raw clip.',
      'Wait for the reaction right after the point about {topic}. Unfiltered gold.',
      'The internet is split on this take from {topic}. Do you agree or disagree?',
      'Stop scrolling: this single insight from {topic} saved 6 months of trial and error.',
      'How a single moment in {topic} turned into the clip of the week.',
      'They tried to skip past this part of {topic}, but the mic caught every word.',
    ],
    funny: [
      'When the confidence is at 100% but the timing in {topic} has other plans.',
      'Plot twist in {topic} happened faster than my morning coffee kicking in.',
      'Me trying to explain {topic} at 2 AM vs how it actually sounded on stream.',
      'Someone clip that immediately — the silence after {topic} was deafening.',
      'No script, no filter, just pure chaos during {topic}.',
      'That awkward pause in {topic} deserves its own documentary series.',
      'Bro really thought nobody was recording during {topic}.',
    ],
    professional: [
      'Key strategic takeaway from "{topic}": execution speed compounds faster than theory.',
      'A concise framework from {topic} on optimizing high-leverage creative workflows.',
      'Executive summary clip: How modern teams approach {topic} with measurable precision.',
      'Breaking down the core operational bottleneck discussed in {topic}.',
      'Three actionable principles from {topic} for scaling production quality.',
      'Industry perspective: Why {topic} represents a structural shift for digital studios.',
      'High-signal excerpt from {topic} focusing on sustainable system architecture.',
    ],
    emotional: [
      'You can hear the exact moment the realization hit during {topic}. Real talk.',
      'Behind every milestone in {topic} are the quiet hours nobody sees.',
      'This honest reflection from {topic} hit closer to home than expected.',
      'Sometimes one unfiltered conversation in {topic} says what everyone is feeling.',
      'A reminder from {topic} that setbacks are part of every meaningful journey.',
      'Raw, unscripted honesty during {topic} — thank you for sharing this perspective.',
      'Pause for 30 seconds and listen to the heart behind {topic}.',
    ],
    motivational: [
      'Discipline outlasts motivation every single time. Lesson from {topic}.',
      'Start before you feel ready — the core message from today’s {topic} session.',
      'Your consistency in the dark builds the momentum seen in {topic}.',
      'Zero excuses, full ownership: the mindset shift inside {topic}.',
      'One percent sharper every day. Watch how {topic} breaks down the process.',
      'Don’t lower the target; increase the focus. Key clip from {topic}.',
      'Proof from {topic} that relentless iteration beats waiting for perfection.',
    ],
    storytelling: [
      'It started as an ordinary recording of {topic}, until the conversation took a sharp turn.',
      'Three years ago this idea was written on a napkin — today in {topic}, here is the result.',
      'Every great story has a turning point. In {topic}, it happened at {timecode}.',
      'Picture this: live cameras rolling on {topic}, zero second takes, and one defining question.',
      'Here is the backstory behind {topic} that never made the main broadcast.',
      'From near cancellation to the most replayed segment of {topic} — the full arc.',
      'Listen closely to how the narrative unfolds in this 45-second cut of {topic}.',
    ],
  },
  urdu: {
    viral: [
      '"{topic}" کے دوران {timecode} پر جو ہوا اس کی کسی کو توقع نہیں تھی — آخر تک دیکھیں۔',
      '{topic} کا یہ مختصر کلپ آپ کی سوچ بدل دے گا، بہترین لمحہ مِس نہ کریں۔',
      'لائیو اسٹریم میں {topic} پر ہونے والی سب سے زیادہ وائرل گفتگو۔',
      'کیا آپ اس بات سے متفق ہیں؟ {topic} کے اس کلپ نے نئی بحث چھیڑ دی۔',
      'صرف 45 سیکنڈ میں {topic} کا سب سے اہم نقطہ، مکمل کلپ دیکھیں۔',
      '{topic} کے اس حصے کو بار بار دیکھا جا رہا ہے، وجہ خود سنیں۔',
      'کیمرے کے سامنے {topic} کا سب سے غیر متوقع لمحہ۔',
    ],
    funny: [
      'جب اعتماد سو فیصد ہو لیکن {topic} میں حالات اچانک بدل جائیں۔',
      '{topic} کے دوران ایسا ٹوئسٹ آیا کہ سب حیران رہ گئے۔',
      'لائیو شو میں {topic} پر ہونے والا سب سے دلچسپ اور بے ساختہ لمحہ۔',
      'اسٹریم کے دوران {topic} پر خاموشی ہی سب کچھ کہہ گئی۔',
      'بغیر اسکرپٹ کے {topic} میں جو ہوا وہ واقعی لاجواب تھا۔',
      '{topic} کا یہ کلپ دیکھ کر ہنسی روکنا مشکل ہے۔',
      'لگتا ہے {topic} کے دوران کسی کو یاد نہیں رہا کہ مائیک آن ہے!',
    ],
    professional: [
      '"{topic}" سے اہم پیشہ ورانہ تجزیہ: معیار اور رفتار کا بہترین امتزاج۔',
      'جدید ڈیجیٹل پروڈکشن اور {topic} کے حوالے سے تین عملی اصول۔',
      '{topic} کے اس سیشن میں کاروباری حکمت عملی پر جامع گفتگو۔',
      'بہترین نتائج کے لیے {topic} کے اس فریم ورک کو ضرور سمجھیں۔',
      'ماہرین کی نظر میں {topic} کے کلیدی نکات کا مختصر خلاصہ۔',
      '{topic} سے سیکھیں کہ کس طرح پیچیدہ کام کو منظم کیا جاتا ہے۔',
      'پیشہ ورانہ معیار کو بہتر بنانے کے لیے {topic} کی اہم بصیرت۔',
    ],
    emotional: [
      '{topic} کے دوران کہی گئی یہ سچی بات دل کو چھو لینے والی ہے۔',
      'کامیابی کے پیچھے چھپی محنت کا خوبصورت ذکر — {topic} کا یادگار لمحہ۔',
      'کبھی کبھی {topic} جیسی سادہ گفتگو انسان کو گہری سوچ میں ڈال دیتی ہے۔',
      '{topic} کا یہ کلپ ہر اس شخص کے لیے ہے جو خاموشی سے محنت کر رہا ہے۔',
      'جذبات اور حقیقت سے بھرپور {topic} کا ایک ناقابلِ فراموش حصہ۔',
      '{topic} کے اس پیغام میں زندگی کا ایک بڑا سبق پوشیدہ ہے۔',
      'چند سیکنڈ نکال کر {topic} کی یہ سچی گفتگو ضرور سنیں۔',
    ],
    motivational: [
      'مستقل مزاجی ہی اصل کامیابی ہے — {topic} سے آج کا بہترین پیغام۔',
      'بہانے چھوڑیں اور اپنے ہدف پر توجہ دیں، {topic} کا شاندار کلپ۔',
      'ہر نیا دن بہتر بننے کا موقع ہے، {topic} کی اس بات کو یاد رکھیں۔',
      'مشکلات کے باوجود آگے بڑھنے کا حوصلہ — {topic} کا متاثر کن حصہ۔',
      'اپنی محنت پر یقین رکھیں، {topic} کا یہ کلپ آپ کا حوصلہ بڑھا دے گا۔',
      'بڑے خواب دیکھنے والوں کے لیے {topic} سے ایک خاص نصیحت۔',
      'آغاز کریں چاہے وسائل کم ہوں — {topic} کا عملی پیغام۔',
    ],
    storytelling: [
      '{topic} کی شروعات ایک عام گفتگو سے ہوئی، مگر اگلے ہی لمحے کہانی بدل گئی۔',
      'اس کلپ کے پیچھے کی اصل کہانی جو {topic} میں پہلی بار سامنے آئی۔',
      'ہر بڑی کامیابی کا ایک اہم موڑ ہوتا ہے، {topic} میں وہ لمحہ {timecode} پر آیا۔',
      'آئیے جانتے ہیں کہ {topic} کا یہ سفر کس طرح شروع ہوا اور کہاں تک پہنچا۔',
      'کیمرے کے پیچھے کی حقیقت جو {topic} کے اس مختصر کلپ میں بیان ہوئی۔',
      'ایک سوال جس نے {topic} کے پورے پروگرام کا رخ موڑ دیا۔',
      '{topic} کی یہ مختصر داستان آپ کو آخر تک باندھے رکھے گی۔',
    ],
  },
  roman_urdu: {
    viral: [
      '"{topic}" ke dauran {timecode} par jo hua kisi ne expect nahi kiya tha — end tak dekhein.',
      '{topic} ka yeh 45-second clip poori game badal dega, miss mat karein.',
      '99% log {topic} mein yeh detail notice nahi karte. Raw clip hazir hai.',
      'Live stream par {topic} ka sab se zyada share hone wala moment!',
      'Kya aap is take se agree karte hain? {topic} ke is clip ne internet hila diya.',
      'Scrolling rokein: {topic} ki yeh ek baat aap ke 6 mahine bacha sakti hai.',
      '{topic} ke is part par reaction dekhne wala tha — unfiltered clip.',
    ],
    funny: [
      'Jab confidence 100% ho lekin {topic} mein timing dhoka de jaye.',
      '{topic} mein plot twist meri subah ki chai se bhi tez aaya.',
      'Raat 2 baje {topic} samjhana vs stream par jo asal mein nikla.',
      'Bhai koi isay foran clip karo — {topic} ke baad wali khamoshi next level thi.',
      'Zero script, zero filter, {topic} ke dauran full entertainment.',
      'Lagta hai {topic} mein bhai bhool gaye thay ke mic on hai!',
      '{topic} ka yeh awkward pause apni alag documentary deserve karta hai.',
    ],
    professional: [
      '"{topic}" se ahem takeaway: Execution speed hamesha theory se jeet jati hai.',
      'High-leverage creative workflows ke liye {topic} ka yeh framework lajawab hai.',
      'Executive summary: Modern creators aur teams {topic} ko kaise scale karte hain.',
      '{topic} ke is session mein production quality barhane ke 3 practical usool.',
      'Data aur strategy ke sath {topic} ka mukammal breakdown.',
      'Digital media studios ke liye {topic} se nikli hui high-signal insight.',
      'System architecture aur workflow optimization par {topic} ka behtareen clip.',
    ],
    emotional: [
      '{topic} ke dauran woh lamha jab baat seedha dil par lagi. Real talk.',
      'Har kamyabi ke peeche woh khamosh mehnat hoti hai jo {topic} mein nazar aayi.',
      '{topic} ki yeh honest guftagu har mehnat karne wale ke liye hai.',
      'Kabhi kabhi {topic} jaisa ek unscripted clip sab kuch keh deta hai.',
      'Zindagi ke utaar charhao par {topic} ka yeh hissa zaroor sunein.',
      'Bina kisi banawat ke {topic} mein dil ki baat — bohot gehra paigham.',
      '30 seconds nikal kar {topic} ke is clip ko mehsoos karein.',
    ],
    motivational: [
      'Motivation aati jati hai, discipline hamesha kaam aata hai — lesson from {topic}.',
      'Ready hone ka intezar mat karein, aaj hi shuru karein. {topic} ka best clip.',
      'Andhere mein ki gayi mehnat hi {topic} jaisi kamyabi banati hai.',
      'Zero excuses, full focus: {topic} se aaj ka mindset shift.',
      'Rozana 1% behtar banein — dekhein {topic} mein process kaise explain hua.',
      'Target chota mat karein, apni koshish barhayein. Key clip from {topic}.',
      'Lagatar mehnat har mushkil ko hara deti hai — {topic} ka inspiring message.',
    ],
    storytelling: [
      '{topic} ki recording bilkul normal shuru hui thi, phir achanak baat ne naya mor liya.',
      '3 saal pehle yeh sirf ek khayal tha — aaj {topic} mein is ka nateeja dekhein.',
      'Har bari kahani ka ek turning point hota hai, {topic} mein woh {timecode} par aaya.',
      'Socho live camera chal raha ho aur {topic} mein aisa sawal samne aa jaye.',
      '{topic} ke peeche ki woh kahani jo pehle kabhi on-air nahi batayi gayi.',
      'Ek choti si shuruat se sab se zyada dekhe jane wale {topic} segment tak ka safar.',
      'Ghaur se sunein kaise {topic} ke is 45-second cut mein poori kahani khulti hai.',
    ],
  },
};

const EMOJI_MAP: Record<CaptionStyle, string> = {
  viral: '🔥⚡',
  funny: '😂💀',
  professional: '📈🎯',
  emotional: '❤️✨',
  motivational: '🚀💪',
  storytelling: '🎬🎙️',
};

export function generateCaptionBatch(params: {
  clipId: string;
  clipTitle: string;
  timecode?: string;
  style: CaptionStyle;
  language: CaptionLanguage;
  length: CaptionLength;
  includeEmojis: boolean;
  includeHashtags: boolean;
  count?: number;
}): CaptionOption[] {
  const {
    clipId,
    clipTitle,
    timecode = '02:14',
    style,
    language,
    length,
    includeEmojis,
    includeHashtags,
    count = 6,
  } = params;

  const boundedCount = Math.min(10, Math.max(5, count));
  const templates = STYLE_TEMPLATES[language][style];
  const emojiPrefix = includeEmojis ? `${EMOJI_MAP[style]} ` : '';

  const baseHashtags = includeHashtags
    ? [
        '#ClipMatrix',
        `#${style.charAt(0).toUpperCase() + style.slice(1)}Clips`,
        language === 'urdu' ? '#اردو_کلپس' : language === 'roman_urdu' ? '#RomanUrdu' : '#CreatorEconomy',
        '#Shorts',
        '#Reels',
      ]
    : [];

  const results: CaptionOption[] = [];

  for (let i = 0; i < boundedCount; i++) {
    const rawTemplate = templates[i % templates.length];
    let body = rawTemplate
      .replace(/\{topic\}/g, clipTitle)
      .replace(/\{timecode\}/g, timecode);

    if (length === 'short') {
      // Keep concise single sentence
      body = `${emojiPrefix}${body}`;
    } else if (length === 'medium') {
      const followUp =
        language === 'urdu'
          ? ' اپنی رائے کمنٹس میں ضرور بتائیں اور مکمل تجزیے کے لیے فالو کریں۔'
          : language === 'roman_urdu'
          ? ' Apni raye comments mein zaroor batayein aur mazeed clips ke liye follow karein.'
          : ' Drop your perspective in the comments and bookmark this cut for reference.';
      body = `${emojiPrefix}${body}${followUp}`;
    } else {
      const deepContext =
        language === 'urdu'
          ? `\n\nاس کلپ میں "${clipTitle}" کے اہم ترین لمحات کو ہائی لائٹ کیا گیا ہے جو (${timecode}) پر ریکارڈ ہوئے۔ آپ کے خیال میں سب سے بہترین نقطہ کون سا تھا؟ کمنٹس میں شیئر کریں۔`
          : language === 'roman_urdu'
          ? `\n\nIs clip mein "${clipTitle}" ke sab se high-impact moment (${timecode}) ko cover kiya gaya hai. Aap ke khayal mein sab se strong point kya tha? Comments mein share karein.`
          : `\n\nExtracted from "${clipTitle}" at timestamp ${timecode}. We isolated the exact turning point so you can apply the core takeaway immediately. Share your verdict below.`;
      body = `${emojiPrefix}${body}${deepContext}`;
    }

    results.push({
      id: `cap-${clipId}-${style}-${language}-${i + 1}`,
      clipId,
      style,
      language,
      length,
      text: body,
      hashtags: baseHashtags,
      hasEmojis: includeEmojis,
      isSaved: i === 0,
      createdAt: 'Just now',
    });
  }

  return results;
}

export function applyApprovalAction(
  clips: GeneratedClip[],
  clipId: string,
  newStatus: ApprovalStatus,
  options?: {
    reviewerNotes?: string;
    scheduledFor?: string;
    captionText?: string;
  }
): GeneratedClip[] {
  return clips.map((clip) => {
    if (clip.id !== clipId) return clip;
    return {
      ...clip,
      approvalStatus: newStatus,
      reviewerNotes: options?.reviewerNotes ?? clip.reviewerNotes,
      scheduledFor: options?.scheduledFor ?? clip.scheduledFor,
      captionText: options?.captionText ?? clip.captionText,
      publishedAt: newStatus === 'published' ? 'Just now' : clip.publishedAt,
    };
  });
}
