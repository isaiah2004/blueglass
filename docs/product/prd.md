# (Aletheia) Atlas Bible: Master Product Specification Document

| Reviewer Name | Notes | Sign-Off Status |
| Benjamin John |  | Not Started |
| David Amalraj |  | In progress |
| Isaiah |  | Not Started |
| Jeshlin Jeba | Added and resolved comments basis discussion with David uncle | Added Comments |
| Judah Leslie |  | Not Started |
| Samuel Shine |  | Not Started |
| Roshan John |  | Not Started |

Product Name: Aletheia(nickname)/Atlas Bible (Derived from the ancient Greek ἀλήθεια, meaning "unveiling reality" or "truth").
Product Tagline: "See the Context. Hear the Voice. Live the Word."
App Store Subtitle: Your Multimodal Bible Atlas

## 1. Value Proposition
### The Problem
Traditional Bible apps treat scripture like plain text documents. Users read about ancient places, rulers, Greek/Hebrew words, or prophecies, but have to leave the app or search through thick commentary books to understand where, when, and why things happened.
Traditional Bible reading applications like YouVersion excel at daily habit triggers and reading streak retention, but struggle with reader comprehension when faced with dense ancient text. Academic tools like Logos offer depth but possess steep learning curves and overwhelming interfaces.
### The Solution
Atlas Bible is an interactive scripture engine. Instead of forcing users to search for context, the app embeds smart, clickable badges directly inside the verses. As you read, subtle inline pills automatically surface 3D maps, history timelines, word root definitions, manuscript history, and grounded AI insights right at your point of need.
Aletheia bridges this gap by transforming daily Bible study into a bite-sized, 5-minute multi-sensory experience. By anchoring scripture reading in interactive 3D geography, real-time world history timelines, original language root trees, cinematic audio commentary, and NotebookLM-powered grounded studio artifacts, Aletheia reduces cognitive friction and turns passive reading into active contextual discovery.

### The 4 Core Product Pillars
- Pristine Reading Canvas: Zero floating menus or dock clutter over the scripture text.
- Point-of-Need Intelligence: Tap inline badges inside any verse to open focused, half-screen visual sheets.
- Zero-Hallucination AI: An AI assistant (powered by NotebookLM) that answers questions with 100% cited scripture and historical references.
- The 5-Minute Daily Habit Loop: A habit system that combines dual-host audio podcasts, visual exploration, and 1-tap retention quizzes to keep users consistent.

(this image is not reality in UI/UX- just a glimpse, actual UI components in section 3 below)

## 2. Core Target Personas & Use Cases
- The Daily Habit Builder: Wants a meaningful 5-minute morning routine that keeps them engaged and consistent, powered by streak tracking and clear progress indicators.
- The Visual & Spatial Learner: Retains information best through diagrams, infographics, audio resources, and timelines rather than wall-of-text prose.
- The Deep Scripture Student & Small Group Leader: Desires quick access to original Greek/Hebrew root words, cross-references for scriptural context and overarching themes., grounded source Q&A, and historical background without needing a library of heavy commentaries.

## 3.1. Onboarding & Personalization Flow
Step 1: Learning Style Identification: Prompt: "Where would you like to start your interactive Bible Devotion?-> choose Testament, Book, Chapter etc." (All media rolled into one UI flow (options to turn off certain features : Visual/Spatial, Historical, Audio-First, Analytical).
Step 2: Interactive "Aha!" Moment: Immediately present a 10-second interactive infographic, illustration & other media types  (map inside illustration if needed) (e.g., Moses crossing the Red Sea or Paul's Shipwreck) prior to sign-up to demonstrate core value. User chooses all / few off the media options to accompany their chapter-wise devotion time.
Step 3: Daily Routine Selection: Configure a daily morning or evening notification trigger time (e.g., 7:30 AM Daily Drop)(optional).

## 3.2. Complete Screen-by-Screen Product Experience
### Tab 1: The Daily Home Canvas (Habit & Streak Hub)
The home screen serves as the launchpad for the user's daily study habit, heavily leaning on proven habit-formation triggers:
- Goal: Get the user into a daily chapterstudy routine and maintain their reading streak.
- Header Bar:
  - App Logo + Brand Title (ATLAS BIBLE)
  - Tagline directly underneath: SEE. HEAR. UNDERSTAND.
  - User Profile Picture Avatar (opens profile/settings upon tapping)
  - Active Streak Pill (🔥 14-Day Streak)
- Hero Card: "Today's Drop" featuring today's passage (e.g., Acts 16) with infographic, illustration & audio explanantions (▶ Play 90s Preview).
- 3-Step Habit Checklist:
  - Step 1: Listen to Audio Overview (AI Podcast + Music).
  - Step 2: Explore Visual Context (infographic / Timeline).
  - Step 3: Complete Reflection.
- Quick Access Media Tools: part of the main UIAI Podcast, Chapter Briefs, and Flashcard Decks.
- Milestone Rewards Drawer: Badgeswhen reaching 7, 30, and 100-day streak

### Tab 2: The (Multimodal?) Reader Canvas
The reading screen maintains a clean, reader-first aesthetic similar to YouVersion, but embeds interactive context triggers directly into the scripture text:
- Inline Context Chips: Subtle badges appear adjacent to key locations, historical figures, or unique terms (e.g., "setting sail from Troas [🗺️ Map]..."). Tapping a chip slides up a non-intrusive contextual sheet.
- Bottom Multimodal Dock: A persistent bottom tab bar allowing the user to toggle between 10 Embedded Feature Badges: Small, glowing inline pills sit directly next to specific words:
  - [🗺️ Route] / [🏛️ 3D City] → Appears next to location names (Troas, Philippi).
  - [⏳ History] → Appears next to historical rulers or laws (Roman Colony, Caesar).
  - [🗣️ Root] → Appears next to key original language words (Worshiper, Apostle).
  - [🧬 Lineage] → Appears next to biblical figures (David, Abraham).
  - [📜 Manuscript] → Appears next to famous textual variants (Mark 16, John 8).
  - [🎯 Cross-Ref] → Appears next to Old Testament quotes or fulfilled prophecies.
  - [🌳 Structure] → Appears next to poetic chiasms, Psalms, and Proverbs.
  - [⚖️ Cultural] → Appears next to ancient Near East / Greco-Roman customs.
  - [🎙️ Context] → Appears next to verses needing historical background (Purple Cloth).
  - [🧘 Meditate] → Appears next to high-impact devotional or command verses.

Dynamic In-Context Sheets (Triggered by Embedded Badges)
When a user taps an inline badge inside the scripture text, a translucent glass sheet smoothly slides up covering the bottom half of the screen:
Plaintext
+-----------------------------------------------------------+
| 11 So, setting sail from Troas [🗺️ Route], we made a       |
| direct run to Samothrace, and the following day           |
| to Neapolis [🏛️ 3D City]...                               |
|===========================================================|
| [=== Slide-Up Glassmorphic Sheet ===]                     |
|                                                           |
| 🗺️ 3D MAPBOX VOYAGE FLYTHROUGH                             |
| Cinematic dark 3D terrain panning Troas -> Philippi       |
| Distance: 125 Miles | Duration: 2 Days                    |
+-----------------------------------------------------------+
- Focus Audio Player Sheet: Real-time synchronized glowing lyrics with an Atmosphere Mixer (independent volume sliders for Narrator Voice vs. Ambient Background Music).
- Spatial Sheet ([🗺️ Route] / [🏛️ 3D City]): Embedded 3D Mapbox map panning over terrain with glowing blue route lines and golden city pins.
- History Sheet ([⏳ History]): Dual-axis timeline graph showing biblical events on top and parallel Roman/world history on the bottom.
- Word Root Sheet ([🗣️ Root]): Original Greek/Hebrew word, Strong's concordance number (e.g., G4576), native audio pronunciation, and a [ Save Flashcard] button.
- Lineage Sheet ([🧬 Lineage]): 3D family tree node graph connecting biblical figures to messianic prophecies.
- Manuscript Sheet ([📜 Manuscript]): High-res photos of ancient codices (e.g., Codex Sinaiticus) alongside translation comparison cards.
- Poetic Chiasm Sheet ([🌳 Structure]): Color-coded node graph showing literary symmetry ($A \rightarrow B \rightarrow C \rightarrow B' \rightarrow A'$).
- Studio Context Sheet ([🎙️ Context]): 90s dual-host podcast player + grounded chat box giving cited AI answers with blue source badges like [Source: Acts 16:14].

### Tab 3: Discover (3D Map & Timeline Explorer)
- Goal: A full-screen sandbox for users to freely explore world history and geography outside of reading mode.
- Header Bar: Brand logo, tagline SEE. HEAR. UNDERSTAND., user avatar, and an interactive search bar.
- 3 Main Interactive Cards:
  - 3D Travel Routes: Free-roam 3D map showing Paul's Missionary Journeys across the Mediterranean.
  - Empire Timeline: A dual-axis timeline comparing Roman Emperors with New Testament events.
  - Literary Patterns: Interactive node tree showing Gospel synoptics and prophetic patterns.
- Cross-App Link: Tapping any city, emperor, or node opens the Bible Tab at that exact verse.

### Tab 4: Studio (Central AI & NotebookLM Workspace)
Goal: A full research desk where users manage all generated AI study tools.
Header Bar: Brand header with toggle options for Grounded Chat and Custom Notebooks.
Hero Audio Card: Dual-host AI podcast overview player with active golden audio waveforms.
2x2 Artifact Grid:
- 📊 Executive Briefings: Chapter executive summaries.
- 🖼️ Visual Slide Decks: Presentation slides breaking down chapter themes.
- 🎴 Root Flashcards: Spaced-repetition flashcards saved from reading sessions.
- ❓ Daily Quizzes: Retention checks to test biblical knowledge.

### Tab 5: Journal
Goal: A reflective space to track personal progress and celebrate streak achievements.
Header Section: Weekly calendar streak tracker (7/7 Days Complete) and an Unlocked Milestone Reward showing a 3D mini-model of ancient Jerusalem (Unlocked at 30 Days).
Main Reflection Feed: Personal notes written in serif text, tagged with verse badges (e.g., [Acts 16:14 - Note on Lydia]).
Saved Artifacts Drawer: Easy access to all saved word root flashcard decks.

## 5. Gamification & Retention Mechanics
Aletheia turns scripture reading into a sustainable daily habit through a multi-tiered habit loop:
### Completion Criteria
Requires completing the 3-Step Daily Drop (Listen, Explore, Reflect/Quiz) to increment the daily streak. Upon completion, a daily fire animation triggers with haptic feedback.

### Grace Savers (Streak Protection)
Users earn up to 2 "Grace Savers" per month through consistent engagement. If a day is missed due to travel or busy schedules, a Grace Saver automatically protects the streak, preventing frustration and abandonment.
### Milestone Rewards Drawer
Unlocks visual 3D asset packs (e.g., "Unlocked: 3D Tour of Solomonic Jerusalem") at 7, 30, and 100-day streaks.

## 7. Go-To-Market with Licensing Strategy
- MVP Phase (Public Domain & Open Licenses): Launch the 30-day Book of Acts MVP using the Berean Standard Bible (BSB) or World English Bible (WEB), both open for commercial AI and software processing.
- Phase 2 Publisher Licensing: Secure formal licensing agreements for modern protected translations:
  - ESV (Crossway)
  - NIV (Zondervan / Biblica)
  - NLT (Tyndale House)
## Launch Roadmap
- Build Your Generic Playbook
- Phase 1: The "Book of Acts" MVP: Launch a 30-day interactive journey through the Book of Acts.
- Phase 2: Creator & Church Partnerships: Partner with faith content creators and church leaders to distribute custom multimodal reading plans.
- Phase 3: Subscription Rollout: Roll out Atlas Pro subscriptions for advanced 3D terrain, custom audio mixing, and interlinear root trees.

## 8. Key Performance Indicators (KPIs) & Success Metrics
- D7 & D30 Retention Rate: Target > 35% D30 retention driven by streak mechanics.
- Streak Completion Rate: % of active users completing the full 3-step loop daily.
- DAU / MAU Ratio: Target > 40% indicating daily habit integration.
- Modality Tap Depth: Average number of multimodal dock interactions per session.

## 9. Security, Privacy, & Theological Guardrails
- Strict Source Grounding: AI commentary and reflection prompts must strictly ground in validated historical and scriptural context without speculating or projecting denominational bias.
- Data Privacy: Personal user notes and reflection journals are encrypted at rest and strictly excluded from general AI model training datasets.

## 11. Data Preservation Strategy
To ensure fast load times and eliminate real-time AI rendering costs, Aletheia utilizes a Pre-computed Data Pipeline for structured reading plans. Below is the JSON schema structure used to power the multimodal layers for each passage:

{
  "passage_id": "ACTS_16_11_15",
  "book": "Acts",
  "chapter": 16,
  "verses": "11-15",
  "spatial_data": {
    "camera_center": [25.9254, 40.8351],
    "zoom_level": 8.5,
    "locations": [
      { "name": "Troas", "coordinates": [26.1553, 39.7428], "type": "departure" },
      { "name": "Samothrace", "coordinates": [25.5283, 40.4633], "type": "island" },
      { "name": "Philippi", "coordinates": [24.2833, 41.0133], "type": "destination", "has_3d_reconstruction": true }
    ]
  },
  "temporal_data": {
    "year_approx": "50 AD",
    "roman_emperor": "Claudius",
    "cultural_context_note": "Philippi was a Roman military retirement colony with a small Jewish population."
  },
  "structural_data": {
    "literary_type": "Historical Narrative",
    "key_chiastic_nodes": ["A: Vision at Troas", "B: Voyage across Aegean", "B': Arrival at Philippi", "A': Conversion of Lydia"]
  }
}

## 14. Capital Strategy & Fundraising Roadmap (Non-Subscription at least in phase 1 & 2 of launch)
To maintain a 100% free experience for end users while sustaining infrastructure and content generation costs, Atlas Bible operates on a multi-channeled non-profit & sponsorship capital model (similar to YouVersion and The Bible Project).
Phase 1: Bootstrapping & Grants ($25K - $100K)
└── Pre-compute Book of Acts MVP → Build 3D Mapbox/Skia Prototypes → Apply for Kingdom Impact Grants

Phase 2: Church & Creator Partnerships
└── Pre-release app "Visual Reading Plans" to 3–5 Churches & Faith Podcasters

Phase 3: Philanthropic & Donor Scaling
└── Secure Foundation Grants & Patron Supporter Subscriptions for continuous 3D asset pipeline expansion

### A. Core Funding Channels
- Church & Creator Sponsored Reading Plans:
  - Model: Partner with churches, Christian podcasters, and digital ministries to co-create branded visual reading journeys (e.g., "The 30-Day Acts Journey presented by [Church Name]").
  - Value Exchange: Organizations fund the pre-computed 3D mapping and audio production for specific biblical books in exchange for reach, engagement analytics, and distribution to their congregations.
- Philanthropic Kingdom Impact Grants:
  - Target Foundations: Sovereign’s Capital Foundation, Praxis Mutuals, The Generous Giving Network, and faith-focused family foundations.
  - Grant Alignment: Funding is tied directly to advancing biblical literacy through open-access education, technology, and 3D visual historical preservation.
- Hybrid C-Corp / 501(c)(3) Foundation Structure:
  - Technology Entity (C-Corp): Owns and builds the underlying software IP, mobile apps, rendering engine, and code base.
  - Foundation Arm (501(c)(3)): Accepts tax-deductible donor contributions and grants earmarked specifically for open-source translation licensing (e.g., BSB) and 3D historical asset creation.
- Patron / Supporter Community ("Pay-It-Forward"):
  - Model: Users can voluntarily back the platform with recurring monthly micro-donations ($5 or $10/month) to "sponsor 3D maps for the next 100 readers."
  - Psychology: Frictionless core app access creates high goodwill, prompting power users to support the mission voluntarily without paywalls.
### B. Unit Economics & Cost Mitigation

| Cost Center | Cost Drivers | Mitigation Strategy |
| Server Rendering & Map Tile Usage | Mapbox GL API vector tiles & camera transitions. | Pre-Computed Schema Caching: Offline vector tile packages cached locally on client devices to keep tile requests <0.005$ per session. |
| Audio Voice Synthesis | AI voice generation via ElevenLabs API. | Pre-Rendered Audio CDN: Audio is generated once during editorial pipeline build and served via static S3/Cloudfront CDN rather than live API calls. |
| 3D Asset Creation | Procedural 3D city reconstructions & terrain models. | Modular 3D asset libraries built using reusable historical architecture packages in React Native Skia. |


