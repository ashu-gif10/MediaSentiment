# MediaSentiment – Real-Time Social Media Sentiment Analysis

A full-stack, multi-model AI analytics platform designed to analyze audience sentiment, detect emotional nuances, extract real emoji trends, identify contextual sarcasm, and generate auditable PDF reports from YouTube video comments on demand.

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement & Objectives](#problem-statement--objectives)
- [Key Features](#key-features)
- [System Architecture & Data Flow](#system-architecture--data-flow)
- [Technology Stack](#technology-stack)
- [Project Folder Structure](#project-folder-structure)
- [Verified API Endpoints](#verified-api-endpoints)
- [Prerequisites](#prerequisites)
- [Local Installation & Setup (Windows)](#local-installation--setup-windows)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Current Limitations](#current-limitations)
- [Security & Data Protection](#security--data-protection)
- [Future Improvements](#future-improvements)
- [Author](#author)

---

## Overview

**MediaSentiment** provides deep qualitative insights into audience discussions by combining fast, rule-based lexicon evaluation (**VADER**) with generative contextual reasoning (**Google Gemini AI**).

Instead of treating sentiment as a single generalized score or guessing emotional intent solely from text, MediaSentiment:
1. Extracts real comments at scale on demand (up to 1,000 comments per video).
2. Performs full-corpus lexical sentiment scoring across all fetched comments using VADER.
3. Isolates actual Unicode emojis used by viewers and measures polarity divergence (**Text–Emoji Conflict Detection**).
4. Employs Gemini AI in managed batches to uncover cultural idioms, irony, and **Contextual Sarcasm**.
5. Persists comprehensive historical audits in **MongoDB Atlas**.
6. Produces downloadable, vector-rendered **PDF reports** directly in the browser without third-party converters.

---

## Problem Statement & Objectives

### The Problem
Traditional sentiment analysis tools often fail on social media for three main reasons:
- **Sarcasm and Mock Praise**: Lexical engines incorrectly mark sarcastic insults (e.g., *"Waah kya acting hai, Oscar pakka milega 😂"*) as overwhelmingly positive.
- **Text-Emoji Divergence**: Viewers frequently contrast negative critique with laughing or heart emojis, creating emotional conflicts that single-score models flatten.
- **API and Rate Constraints**: Sending thousands of raw comments in a single large LLM prompt leads to context overflows, rate-limit failures, and excessive latency.

### The Objectives
- Implement a **hybrid dual-engine architecture**: VADER for high-throughput rule evaluation across all comments, and Gemini AI for nuanced contextual interpretation on sampled batches.
- Maintain independent tracks for **Text-Emoji Conflict** vs. **Contextual Sarcasm Detection** (polarity mismatch alone does not prove sarcasm).
- Ensure zero loss of core functionality: the platform runs normally even if the database is temporarily disconnected.
- Provide a persistent **Analysis History** and exportable **PDF reporting** for offline reviews and audits.

---

## Key Features

### 1. YouTube Comment Extraction
- Integrates Python's `youtube-comment-downloader` library to fetch up to 1,000 comments per video (configurable between 10 and 2,000) without hitting strict YouTube Data API quota ceilings.
- Features automatic fallback to the official **YouTube Data API v3** if the Python scraper fails, provided `YOUTUBE_API_KEY` is configured in `server/.env`.
- Normalizes video metadata (title, creator channel, view count, like count, published date, thumbnail).

### 2. Dual Sentiment Classification (VADER + Gemini AI)
- **VADER Sentiment Engine**: Analyzes 100% of fetched comments; assigns compound valence scores, positive/negative/neutral proportions, and categorical classifications.
- **Gemini AI Contextual Engine**: Analyzes comments in controlled batches (e.g., 50–100 samples) to detect colloquial expressions, Hinglish phrasing, and nuanced intent.
- **Model Agreement Metric**: Reconciles classifications between VADER and Gemini on comments analyzed by both models, clearly categorized as model agreement rate rather than ground-truth accuracy.

### 3. Emoji Analytics & Text–Emoji Conflict Detection
- Extracts authentic Unicode emojis present in comments using Python's `emoji` library.
- Maps emoji frequencies, sentiment trends, and sentiment shares.
- Distinguishes **Positive Reinforcement** (praise text with praise emojis) from **Text–Emoji Conflict** (negative textual words paired with laughing or positive emojis).

### 4. Contextual Sarcasm Detection
- Analyzes comment text and emoji context using Gemini AI.
- Assigns clear verdicts: **Sarcastic**, **Non-Sarcastic**, or **Uncertain**.
- Generates a concise, auditable contextual explanation for each sarcastic prediction.
- Comments outside LLM batch thresholds remain labeled as *Uncertain* (evaluated by VADER rule engine; requires contextual AI reasoning) to avoid fabricated data.

### 5. Interactive Dark-Theme Dashboard
- Built with React 18, Vite, and Tailwind CSS 3.4.17.
- Visualizes sentiment breakdowns with **Recharts** interactive pie charts and topic bar charts.
- Provides real-time comment filtering by sentiment category, sarcasm verdict, text-emoji conflict, or critical feedback.
- Includes a live backend health check badge and non-blocking database status indicator.

### 6. MongoDB Atlas Analysis History
- Automatically persists successful analyses to MongoDB Atlas under the `media_sentiment` database.
- Dedicated **Analysis History** page with search filters, summary counters, and date sorting.
- Efficient query projection: history list excludes large comment arrays (`.select('-comments')`) for rapid loading.
- Instant reload: clicking *"View Results"* opens the saved historical analysis with all original charts and comment cards.
- Individual record deletion with confirmation and ID validation.

### 7. Downloadable PDF Reports
- Generates vector-quality, multi-page PDF reports client-side using `jspdf` and `jspdf-autotable`.
- Available on both the active Dashboard and historical saved analysis cards.
- Includes executive summary tables, dual-model comparison matrices, emoji distributions, sarcasm breakdowns, representative sample comments, and formal methodology notes.
- Generates automated file names: `MediaSentiment_[Video_Title]_[Date].pdf`.

---

## System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client ["Frontend (React 18 + Vite + Tailwind)"]
        UI[Dashboard / Analysis History]
        PDF[Client-Side jsPDF Generator]
    end

    subgraph Backend ["Backend (Node.js + Express)"]
        Server[Express Server :5000]
        Routes["API Routes (/api/analyze, /api/history)"]
        Subprocess[Python Subprocess Runner]
        GeminiService[Gemini AI Service Client]
    end

    subgraph Python ["Python 3 NLP Engine"]
        Downloader[youtube-comment-downloader]
        VaderEng[vaderSentiment Analyzer]
        EmojiEng[emoji Library Extractor]
    end

    subgraph External ["External Services & Storage"]
        YT[YouTube Video & Comments]
        GeminiAPI[Google Gemini Generative AI API]
        Atlas[(MongoDB Atlas Database)]
    end

    UI -->|Submit YouTube URL| Server
    Server --> Routes
    Routes --> Subprocess
    Subprocess -->|Download Comments| Downloader --> YT
    Subprocess -->|Rule-based Sentiment| VaderEng
    Subprocess -->|Emoji Polarity & Conflicts| EmojiEng
    Subprocess -->|Structured JSON| Routes
    Routes -->|Batched Contextual Prompts| GeminiService --> GeminiAPI
    GeminiService -->|Sarcasm & Nuance Results| Routes
    Routes -->|Persist Complete Document| Atlas
    Routes -->|Deliver Analysis Response| UI
    UI -->|Export Report| PDF
    Atlas -->|Retrieve History Records| Routes
```

---

## Technology Stack

### Frontend
- **React 18** (`react`, `react-dom`): Component-based user interface.
- **Vite 5**: Fast frontend tooling and production bundler.
- **Tailwind CSS 3.4.17**: Custom dark-theme styling, responsive layouts, and utilities.
- **Recharts**: Responsive SVG-based pie charts and bar charts.
- **Lucide React**: Iconography for cards, indicators, and controls.
- **jsPDF & jspdf-autotable**: Client-side vector PDF generation and tabular pagination.
- **Axios**: HTTP client for REST communication with backend services.

### Backend
- **Node.js** (v18+ or v20+): JavaScript server runtime.
- **Express 4.21**: REST API routing, JSON body parsing, and request handling.
- **Mongoose 8.9**: Object Data Modeling (ODM) library for MongoDB.
- **Morgan**: HTTP request logging for development.
- **CORS**: Cross-Origin Resource Sharing middleware with port allowlists.
- **Dotenv**: Environment variable loader.
- **jsonwebtoken & bcryptjs**: Installed security and authentication primitives.
- **express-rate-limit**: Installed rate limiting middleware.

### AI & Natural Language Processing
- **Google Gemini API** (`@google/generative-ai`): Contextual sentiment reasoning, Hinglish interpretation, and contextual sarcasm detection.
- **Python 3**: Subprocess runtime for comment acquisition and lexical analysis.
- **vaderSentiment**: Rule-based sentiment analysis tuned for social media text and slang.
- **emoji**: Unicode emoji parsing, extraction, and descriptive naming.
- **youtube-comment-downloader**: High-capacity YouTube comment scraper.

### Database & Infrastructure
- **MongoDB Atlas**: Managed cloud database storing analysis documents in the `media_sentiment` database.
- **Git**: Distributed version control.

---

## Project Folder Structure

```text
MediaSentiment/
├── .env.example               # Root environment variable template
├── .gitignore                  # Git exclusion rules for secrets, builds, and node_modules
├── README.md                   # Project documentation
│
├── client/                     # Frontend Application (React 18 + Vite)
│   ├── .env.example            # Frontend environment variable template
│   ├── .gitignore              # Frontend Git exclusion rules
│   ├── index.html              # HTML entry point
│   ├── package.json            # Frontend dependencies and build scripts
│   ├── postcss.config.js       # PostCSS configuration for Tailwind
│   ├── tailwind.config.js      # Tailwind CSS theme and palette configuration
│   ├── vite.config.js          # Vite build tool configuration
│   └── src/
│       ├── main.jsx            # React root application mount
│       ├── App.jsx             # Top-level view routing (Dashboard vs. History)
│       ├── index.css           # Global Tailwind directives and base styles
│       ├── components/
│       │   ├── HealthCheckBadge.jsx   # Live backend connectivity pill
│       │   ├── KeywordBarChart.jsx    # Top topics/keywords bar chart
│       │   ├── SentimentPieChart.jsx  # VADER & Gemini sentiment pie charts
│       │   ├── Sidebar.jsx            # Navigation sidebar and brand header
│       │   ├── StatCard.jsx           # Reusable metric statistic card
│       │   └── YouTubeInputCard.jsx   # URL input and batch configuration controls
│       ├── pages/
│       │   ├── Dashboard.jsx          # Primary analytics dashboard & comment inspector
│       │   └── AnalysisHistory.jsx    # Saved MongoDB history browser & PDF exporter
│       ├── services/
│       │   ├── api.js                 # Axios API calls to Express backend
│       │   └── reportGenerator.js     # jsPDF multi-page report generator
│       └── utils/
│           └── youtubeValidator.js    # Client-side YouTube URL parser
│
└── server/                     # Backend Application (Node.js + Express + Python)
    ├── .env.example            # Backend environment variable template
    ├── .gitignore              # Backend Git exclusion rules
    ├── package.json            # Backend dependencies and scripts
    └── src/
        ├── server.js           # Express app setup, CORS, and route mounts
        ├── config/
        │   └── db.js           # Mongoose connection with sanitized logging & error handling
        ├── controllers/
        │   ├── analysisController.js # Multi-model pipeline orchestration & auto-save
        │   └── historyController.js  # History listing, retrieval by ID, and deletion
        ├── models/
        │   └── Analysis.js     # Mongoose schema for saved analysis records
        ├── routes/
        │   ├── analysisRoutes.js # /api/analyze routes
        │   └── historyRoutes.js  # /api/history routes
        ├── scripts/
        │   ├── download_comments.py     # Python YouTube comment scraper
        │   ├── vader_analyzer.py        # Python VADER lexical analysis script
        │   ├── emoji_analyzer.py        # Python emoji extraction and conflict detector
        │   └── verify_emoji_analytics.py# Quality audit script for emoji metrics
        ├── services/
        │   ├── geminiService.js         # Batched Gemini API requests & prompt engineering
        │   ├── pythonDownloaderService.js# Node child_process bridge to Python scraper
        │   ├── vaderService.js          # Node child_process bridge to VADER analyzer
        │   └── youtubeService.js        # Official YouTube Data API v3 client
        └── utils/
            └── youtubeValidator.js      # Video ID regex extractor and normalizer
```

---

## Verified API Endpoints

All endpoints have been tested against the live server:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check, timestamp, environment, and database connectivity. |
| `GET` | `/api/db/status` | Current MongoDB Atlas connection state (`connected`, `readyState`, `databaseName`). |
| `POST` | `/api/analyze/youtube` | Executes complete dual-model analysis pipeline (VADER, Emojis, Gemini, Sarcasm) and auto-saves to MongoDB. |
| `POST` | `/api/analyze/python` | Explicit Python-engine analysis route. |
| `POST` | `/api/validate-url` | Validates a YouTube URL or video ID and returns the extracted ID. |
| `POST` | `/api/analyze/validate-url` | Secondary validation route mounted on `/api/analyze`. |
| `GET` | `/api/history` | Returns paginated list of saved analyses (omits comment arrays for fast response). |
| `GET` | `/api/history/:id` | Retrieves complete document by MongoDB ObjectId, including all comment objects. |
| `DELETE`| `/api/history/:id` | Deletes a saved analysis by MongoDB ObjectId. |

---

## Prerequisites

Before setting up MediaSentiment locally, ensure the following software is installed on your Windows machine:

1. **Node.js**: Version `18.x` or `20.x` (LTS recommended). Check with:
   ```powershell
   node -v
   npm -v
   ```
2. **Python**: Version `3.10+` or `3.11+`. Check with:
   ```powershell
   python --version
   pip --version
   ```
3. **Git**: Version `2.x`. Check with:
   ```powershell
   git --version
   ```
4. **Google Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).
5. **MongoDB Atlas Account**: A free cloud cluster from [MongoDB Atlas](https://www.mongodb.com/atlas).
6. **YouTube Data API v3 Key** *(Optional)*: Obtainable from [Google Cloud Console](https://console.cloud.google.com/) if using the API engine instead of the Python downloader.

---

## Local Installation & Setup (Windows)

### Step 1: Clone the Repository
Open PowerShell or Command Prompt:
```powershell
git clone https://github.com/ashu-gif10/MediaSentiment.git
cd MediaSentiment
```

### Step 2: Install Python Dependencies
Install the required NLP and scraping libraries globally or in your virtual environment:
```powershell
pip install youtube-comment-downloader vaderSentiment emoji
```

### Step 3: Install Backend Dependencies
Navigate to the `server` directory and install the Node.js packages:
```powershell
cd server
npm install
cd ..
```

### Step 4: Install Frontend Dependencies
Navigate to the `client` directory and install the React packages:
```powershell
cd client
npm install
cd ..
```

---

## Environment Configuration

MediaSentiment keeps all secret credentials in local `.env` files that are strictly excluded from Git.

### 1. Backend Environment Setup
In the `server/` directory, create a `.env` file by copying `server/.env.example`:

**PowerShell:**
```powershell
Copy-Item server/.env.example server/.env
```

**Command Prompt (cmd):**
```cmd
copy server\.env.example server\.env
```

Open `server/.env` in your text editor and configure your variables:
```env
PORT=5000
NODE_ENV=development

# Replace with your MongoDB Atlas connection string
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority

# JWT secret for authentication sessions
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# Google Gemini API Key from Google AI Studio
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Google Cloud YouTube Data API v3 Key
YOUTUBE_API_KEY=your_youtube_api_key_here

# Client URL allowlist for CORS
CLIENT_URL=http://localhost:5173
```

> **Important Notes on MongoDB Atlas:**
> - Ensure your database user has **Read and write to any database** privileges.
> - In Atlas **Network Access**, ensure your public IP address (or `0.0.0.0/0` for development) is added to the IP Access List.
> - If your database password contains special characters (`@`, `:`, `/`, `#`), ensure they are URL-encoded.

### 2. Frontend Environment Setup
In the `client/` directory, create a `.env` file by copying `client/.env.example`:

**PowerShell:**
```powershell
Copy-Item client/.env.example client/.env
```

**Command Prompt (cmd):**
```cmd
copy client\.env.example client\.env
```

The file contains the backend API base path:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Running the Application

To run MediaSentiment, start the backend and frontend servers in separate terminal windows.

### Terminal 1: Start Backend Server
From the project root:
```powershell
cd server
npm start
```
*For active development with auto-reload, run:*
```powershell
npm run dev
```
The server will start on `http://localhost:5000`. You will see startup logs confirming Gemini API configuration and MongoDB Atlas connection status:
```text
===============================================
🚀 Server successfully started on port: 5000
📡 Health Check URL: http://localhost:5000/api/health
🔑 YouTube API Key: Configured ✅
🤖 Gemini API Key: Configured ✅
💾 MongoDB Atlas: Connecting ⏳
===============================================
✅ [MongoDB] Atlas Connected: ac-xxxxx.mongodb.net (media_sentiment)
```

### Terminal 2: Start Frontend Application
From the project root:
```powershell
cd client
npm run dev
```
Vite will start the development server at:
```text
  VITE v5.4.11  ready in 450 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open your browser and navigate to `http://localhost:5173`.

---

## Current Limitations

1. **On-Demand Processing**: Analysis is executed on demand when a user submits a YouTube URL or video ID; it does not continuously monitor or stream live social media feeds in the background.
2. **API Dependency & Quotas**: Contextual sarcasm detection and semantic summaries require an active Google Gemini API key. If the Gemini API key is missing or quota is exhausted, the application gracefully continues in VADER-only evaluation mode.
3. **Probabilistic AI Predictions**: Sarcasm classifications and sentiment interpretations are generated by probabilistic machine learning models and are not guaranteed to be 100% accurate. The model agreement metric reflects classification consensus between VADER and Gemini, not absolute human ground truth.
4. **Batch Limits**: To prevent timeout errors and respect LLM rate limits, full comment collections (up to 1,000) are analyzed by VADER, while a representative batch (e.g., 50–100 comments) is processed by Gemini AI.

---

## Security & Data Protection

- **Zero Credential Exposure**: Real credentials, passwords, and API keys are stored solely in `.env` files and are excluded by the root [.gitignore](file:///c:/Users/User/Desktop/MediaSentiment/.gitignore).
- **Sanitized Logging**: The database connection module ([db.js](file:///c:/Users/User/Desktop/MediaSentiment/server/src/config/db.js)) automatically strips username and password fields (`mongodb+srv://***:***@...`) before logging connection attempts to the terminal or server logs.
- **Controlled CORS**: Express CORS configuration restricts browser requests to configured development ports and explicit origin domains.
- **Client-Side PDF Compilation**: Report generation runs locally inside the browser using `jspdf`, eliminating the need to transmit analyzed comments to third-party rendering APIs.

---

## Future Improvements

- **Multi-Platform Support**: Extend comment scrapers to Twitter/X, Reddit, and Instagram posts.
- **WebSocket Streaming**: Stream real-time progress updates for large comment downloads directly to the dashboard progress bar.
- **Ground-Truth Benchmarks**: Integrate human-annotated Hindi/Hinglish sarcasm datasets for formal F1-score evaluation.
- **Export Formats**: Add CSV, Excel, and JSON batch export alongside the existing PDF generator.

---

## Author

- **Author**: Ashu Patel
- **GitHub**: [@ashu-gif10](https://github.com/ashu-gif10)
- **Repository**: [https://github.com/ashu-gif10/MediaSentiment](https://github.com/ashu-gif10/MediaSentiment)
