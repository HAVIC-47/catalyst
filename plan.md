**Role & Objective**
You are an expert full-stack software engineer and UI/UX designer. Your task is to help me build a comprehensive Mood and Money Management web app. This application correlates daily financial cash flow with daily emotional states to provide deep, predictive personal analytics. 

**UI/UX & Design Language**
*   **Theme:** Strict minimalist dark mode. Use deep charcoal and obsidian backgrounds.
*   **Elements:** Frosted glassmorphism cards for data segmentation.
*   **Accents:** Sharp neon cyan and purple for data visualizations (line graphs, highlights) to make trends pop against the dark interface.
*   **Vibe:** Sleek, high-end, and slightly moody (incorporating a "Main Character" aesthetic).

**Tech Stack Requirements**
*   **Deployment:** Vercel (Zero-cost tier, `.vercel.app` domain).
*   **Frontend:** Next.js (React) with Tailwind CSS for rapid styling.
*   **Data Visualization:** Recharts (for complex dual-axis graphs).
*   **Backend:** Python (FastAPI) utilizing Vercel's serverless functions, OR Next.js API Routes (TypeScript) depending on the logic complexity.
*   **Database:** Serverless PostgreSQL (Vercel Postgres or Supabase).

**Core Features to Implement**
1.  **Frictionless Dual-Entry System:** A highly optimized quick-entry widget (under three taps or a command-line style `Ctrl + K` input) to simultaneously log a monetary transaction and select a mood using minimalist iconography.
2.  **Impulse vs. Intentional Tagging:** A binary toggle on the transaction entry schema to separate planned expenses from spontaneous ones.
3.  **Contextual Variable Tagging:** Allow secondary metadata alongside entries (e.g., "Sleep: 5hrs", "Workload: High").

**Analytics & Dashboard Features**
1.  **The "Main Character" Dashboard:** A highly visual landing page dominating the UI.
2.  **Dual-Axis Trend Mapping:** A chart overlaying daily net financial cash flow against a numerical mood index over 7, 30, and 90-day windows.
3.  **Color-Blocked Heatmaps:** A monthly calendar view using stark, contrasting colors to instantly highlight problematic days (e.g., high spending + low mood) without needing to read numbers.
4.  **Categorized Mood-to-Expense Heatmaps:** A matrix breaking down spending categories (Dining, Tech, etc.) against logged emotional states.

**Advanced & Behavioral Features**
1.  **Authoritative Alerts ("Villain Arc" Mode):** An optional "strict mode" that sends demanding, authoritative push notifications when approaching budget limits (e.g., “Absolute authority required over today's spending.”).
2.  **Predictive Sentiment Modeling:** A background worker analyzing historical data to predict high-risk spending days based on cyclical mood patterns.
3.  **"Buyer's Remorse" Retrospective Tracker:** A background job prompting the user 48-72 hours post-expense to re-rate their mood, measuring if "retail therapy" yielded sustained positive sentiment or a crash.
4.  **Emotional Friction Triggers:** If a highly negative mood is logged, the app introduces UI friction (confirmation modals, countdowns) before allowing a new non-essential expense to be logged.

**First Task**
Based on this PRD, please provide the initial PostgreSQL database schema required to handle the users, transactions, mood logs, and contextual metadata.

mood-money-app/
├── src/
│   ├── app/                          # Next.js 14+ App Router
│   │   ├── (auth)/                   # Grouped auth routes (login, register)
│   │   ├── dashboard/                # The "Main Character" Dashboard
│   │   │   ├── page.tsx              # Main dashboard view
│   │   │   └── layout.tsx            # Dashboard-specific layout wrapper
│   │   ├── api/                      # Next.js API Routes (if using TypeScript backend)
│   │   │   ├── entries/              # Frictionless dual-entry endpoints
│   │   │   └── analytics/            # Predictive modeling & heatmaps
│   │   ├── layout.tsx                # Root layout (Dark mode/Obsidian wrapper)
│   │   └── page.tsx                  # Landing page
│   │
│   ├── components/
│   │   ├── ui/                       # Reusable micro-components
│   │   │   ├── glass-card.tsx        # Frosted glassmorphism containers
│   │   │   ├── neon-button.tsx       # Buttons with cyan/purple accents
│   │   │   └── command-k.tsx         # Keyboard-driven fast-logging modal
│   │   ├── charts/                   # Recharts data visualizations
│   │   │   ├── dual-axis-trend.tsx   # Cash flow vs. mood index graph
│   │   │   └── category-heatmap.tsx  # Color-blocked calendar views
│   │   └── features/                 # Complex domain-specific components
│   │       ├── entry-form.tsx        # Includes the Impulse/Intentional toggle
│   │       └── villain-alert.tsx     # Authoritative budget push notifications
│   │
│   ├── lib/                          # Utility functions and configurations
│   │   ├── db.ts                     # Postgres connection (Vercel Postgres/Supabase)
│   │   ├── utils.ts                  # Tailwind class merging (clsx/tailwind-merge)
│   │   └── math.ts                   # Client-side correlation calculations
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-debounce.ts           
│   │   └── use-sentiment-model.ts    # Hook fetching predictive sentiment data
│   │
│   └── types/                        # TypeScript definitions
│       └── index.ts                  # Database schemas and component prop types
│
├── api/                              # Python Backend (Vercel Serverless Option)
│   ├── index.py                      # FastAPI application entry point
│   ├── requirements.txt              # Python dependencies
│   └── routers/                      # Python route handlers
│
├── public/                           # Static assets (fonts, custom iconography)
├── tailwind.config.ts                # Strict dark mode and neon color palettes
├── tsconfig.json                     # TypeScript configuration
└── package.json                      # Node dependencies and scripts