# ClipMatrix — AI-Powered Video Clipping & Publishing Studio (Phase 1 Foundation)

ClipMatrix is a personal AI video clipping, livestream monitoring, multi-language captioning, and social publishing studio. This repository contains the **Phase 1 Project Foundation**, engineered for clean modularity, strict TypeScript domain contracts, and seamless Phase 2 backend integration.

---

## 1. Framework & Environment Documentation (Vite + React vs. Next.js)

- **Runtime Stack Used**: **React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons**.
- **Architectural Note on Next.js**: The AI Studio container environment comes pre-configured with a Vite + React SPA runtime (`vite.config.ts`, `index.html`, `src/main.tsx`). Per the Phase 1 specification (*"If the environment does not support Next.js, use its supported React framework and clearly document the difference. Do not break the project trying to force an unsupported framework"*), all 13 studio routes are implemented as modular page components under `src/pages/` with client-side route state, zero-reload transitions, and clean separation between UI components, business logic (`src/utils/clipLogic.ts`), sample data (`src/data/sampleData.ts`), and typed backend service contracts (`src/services/apiContracts.ts`).

---

## 2. Project Structure

```text
/
├── index.html                           # Entry HTML with Plus Jakarta Sans, DM Sans & JetBrains Mono
├── metadata.json                        # Application metadata
├── package.json                         # Scripts and dependencies
├── src/
│   ├── main.tsx                         # React DOM root
│   ├── index.css                        # Tailwind CSS v4 + dark theme & tabular numeral rules
│   ├── App.tsx                          # Root studio shell & 13-page state orchestrator
│   ├── types/
│   │   └── clipmatrix.ts                # Core TypeScript domain models & PostgreSQL-ready types
│   ├── services/
│   │   └── apiContracts.ts              # Prepared service interfaces (FastAPI, PostgreSQL, Gemini, Whisper, FFmpeg, Redis/Celery)
│   ├── data/
│   │   └── sampleData.ts                # Clearly separated Phase 1 sample datasets
│   ├── utils/
│   │   ├── clipLogic.ts                 # Pure logic for stats, validation, filtering & multi-language captions
│   │   └── clipLogic.test.ts            # Node built-in unit test suite (node:test)
│   ├── components/
│   │   ├── brand/
│   │   │   └── ClipMatrixLogo.tsx       # Custom filmstrip + play-button vector logo
│   │   ├── common/
│   │   │   └── VideoPreviewFrame.tsx    # Interactive 9:16, 16:9 & 1:1 studio canvas with face-tracking & subtitles
│   │   └── layout/
│   │       ├── Sidebar.tsx              # Collapsible 13-route sidebar + mobile drawer
│   │       └── TopNavbar.tsx            # Global search dropdown, notifications & profile menu
│   └── pages/
│       ├── OverviewPage.tsx             # 1. Overview Dashboard (6 KPIs, recent projects/clips, streamers, activity)
│       ├── LiveStreamsPage.tsx          # 2. Live Streams (rolling buffer & spike extraction)
│       ├── MyStreamersPage.tsx          # 3. My Streamers (LIVE/OFFLINE roster, pause/remove, notifications)
│       ├── LongVideoToClipsPage.tsx     # 4. Long Video to Clips (Local, YouTube, Drive, VODs; 15/30/45/60s/Custom; 9:16, 16:9, 1:1)
│       ├── PodcastClipsPage.tsx         # 5. Podcast Clips (Speaker diarization & 9:16 split-screen framing)
│       ├── AIEditingStudioPage.tsx      # 6. AI Editing Studio (Subtitles, reframing, face tracking, zoom, music/SFX, thumbnails)
│       ├── GeneratedClipsPage.tsx       # 7. Generated Clips (Filterable asset library)
│       ├── CaptionStudioPage.tsx        # 8. Caption Studio (5–10 options, 6 styles, English/Urdu/Roman Urdu, emoji/hashtag controls)
│       ├── ContentCalendarPage.tsx      # 9. Content Calendar (Release scheduling across YouTube, Instagram, TikTok)
│       ├── SocialAccountsPage.tsx       # 10. Social Accounts (Connected channel stubs & approval enforcement rules)
│       ├── UploadApprovalPage.tsx       # 11. Upload Approval (Approve, Reject, Edit, Schedule & Publish human gate)
│       ├── AnalyticsPage.tsx            # 12. Analytics (Views, Likes, Comments, Engagement & platform breakdown)
│       └── SettingsPage.tsx             # 13. Settings (Studio defaults, FastAPI/PostgreSQL/FFmpeg/Whisper specs)
```

---

## 3. How to Run the Application

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the development server (Port 3000)**:
   ```bash
   npm run dev
   ```
3. **Run unit tests**:
   ```bash
   npx --yes tsx --test src/utils/clipLogic.test.ts
   ```
4. **Build for production**:
   ```bash
   npm run build
   ```

---

## 4. Dependencies

- `react` (`^19.0.1`) & `react-dom` (`^19.0.1`)
- `tailwindcss` (`^4.3.3`) & `@tailwindcss/vite`
- `lucide-react` (`^0.546.0`)
- `typescript` (`^7.0.2`) & `vite` (`^8.3.0`)

---

## 5. Current Implemented Features (Phase 1)

- **Brand Identity & Dark SaaS Design**: Custom `ClipMatrixLogo` (filmstrip + play prism), near-black/charcoal surfaces (`#090A0F` / `#10131E`), purple-to-electric-blue gradient accents, `Plus Jakarta Sans` + `DM Sans` + `JetBrains Mono` typography, and responsive desktop/tablet/mobile layouts.
- **Full 13-Page Navigation Architecture**: Every sidebar item opens its own dedicated page with interactive state and zero dead links.
- **Overview Dashboard**: Displays Total Videos, Generated Clips, Pending Approval, Published Clips, Active Live Streams, and Scheduled Posts, alongside Recent Projects, Recently Generated Clips, Active Streamers, Recent Publishing Activity, and Quick Actions.
- **Multi-Source Video & Podcast Workflows**: Form validation and interactive job creation for Local uploads, YouTube links, Google Drive links, Livestream recordings, and multi-speaker Podcasts.
- **Caption Studio**: Generates 5–10 localized captions across 6 styles (`Viral`, `Funny`, `Professional`, `Emotional`, `Motivational`, `Storytelling`) in **English**, **Urdu (اردو)**, and **Roman Urdu**, with Short/Medium/Long lengths, emoji/hashtag toggles, inline editing, copying, and saving.
- **Upload Approval Workflow**: Human-in-the-loop review queue allowing users to inspect, edit captions/notes, approve, reject, schedule, or publish clips.

---

## 6. Features Reserved for Future Phases (Phase 2+)

- **Python FastAPI & PostgreSQL Persistence**: Connecting `src/services/apiContracts.ts` to live FastAPI endpoints and PostgreSQL tables (`video_projects`, `generated_clips`, `streamer_monitors`, `caption_variants`).
- **FFmpeg & Whisper Local Worker Pipeline**: Running Celery + Redis workers for real MP4 transcoding, MediaPipe active-speaker crop, and local `faster-whisper` word-level transcription.
- **Live Gemini API & OAuth Publishing**: Server-side Gemini API highlight scoring and live YouTube Data API / Instagram Graph API / TikTok Content Posting API uploads.
