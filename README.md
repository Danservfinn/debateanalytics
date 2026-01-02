# Debate Analytics

AI-powered Reddit debate analysis platform that identifies arguments, tracks momentum shifts, and evaluates argument quality in discussion threads.

## Features

### Core Analysis
- **Debate Detection**: AI-powered identification of distinct debates within Reddit threads
- **Argument Classification**: Automatic PRO/CON/Neutral position detection
- **Quality Scoring**: 1-10 argument quality assessment based on evidence, logic, and civility
- **Winner Determination**: AI-evaluated debate outcomes with supporting rationale

### Visualization Components
- **HeroVerdictCard**: Thread-level verdict with animated score ring
- **BattleCard**: Side-by-side PRO vs CON comparison with best arguments
- **DebateThreadCard**: Expandable debate cards with full argument threads
- **MomentumTimeline**: Visual debate progression showing momentum shifts
- **ParticipantCard**: User profiles with debate statistics

### Data Products
- **Thread Analysis**: Deep analysis of Reddit CMV threads
- **User Profiling**: Debate participation history and performance metrics
- **Claim Extraction**: Factual claims identified for fact-checking

## Tech Stack

- **Framework**: Next.js 16.1.1 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **AI**: Claude API for debate analysis
- **Data Fetching**: Reddit JSON API via Python scraper

## Usage

### URL Mode (Local Development)
Enter a Reddit thread URL directly to analyze. Works on localhost where residential IPs are not blocked by Reddit.

### JSON Paste Mode (Production)
Reddit blocks API requests from cloud server IPs (Vercel, AWS, etc.). Use JSON paste mode as a workaround:

1. Go to any Reddit thread in your browser
2. Add `.json` to the end of the URL (e.g., `reddit.com/r/changemyview/comments/abc123/.json`)
3. Press `Ctrl+A` to select all, then `Ctrl+C` to copy
4. Switch to "Paste JSON" mode on the Debate Analytics homepage
5. Enter the original thread URL and paste the JSON data
6. Click "Analyze JSON Data"

## Getting Started

### Prerequisites
- Node.js 18+
- Anthropic API key

### Installation

```bash
# Clone the repository
git clone https://github.com/Danservfinn/debateanalytics.git
cd debate-analytics

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Environment Variables

```env
ANTHROPIC_API_KEY=your_api_key_here
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── analyze-thread/    # Thread analysis endpoint
│   │   └── user/             # User profile endpoints
│   ├── thread/[threadId]/    # Thread detail page
│   └── page.tsx              # Home page
├── components/
│   ├── analysis/          # Analysis visualization components
│   │   ├── BattleCard.tsx
│   │   ├── DebateThreadCard.tsx
│   │   ├── HeroVerdictCard.tsx
│   │   ├── MomentumTimeline.tsx
│   │   └── ParticipantCard.tsx
│   └── ui/                # Shared UI components
├── lib/
│   ├── debate-detection.ts   # AI debate analysis logic
│   └── neo4j.ts              # Database connection
├── types/
│   └── debate.ts            # TypeScript type definitions
└── scripts/
    └── reddit_debate_fetcher.py  # Reddit data scraper
```

## API Endpoints

### `GET /api/analyze-thread`
Analyzes a Reddit thread by fetching data from Reddit API.

**Query Parameters:**
- `url`: Reddit thread URL (required)

**Response:**
```json
{
  "debates": [...],
  "participants": [...],
  "threadMeta": {...}
}
```

### `POST /api/analyze-thread`
Analyzes a Reddit thread using pre-fetched JSON data (for production use).

**Request Body:**
```json
{
  "url": "https://reddit.com/r/changemyview/comments/abc123/...",
  "threadData": [/* Reddit JSON array */]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "debates": [...],
    "participants": [...],
    "threadMeta": {...}
  }
}
```

### `GET /api/user/[username]/status`
Gets user profile and debate history.

## Key Components

### DebateThreadCard
Expandable card showing debate summary with full PRO/CON argument breakdown.

```tsx
<DebateThreadCard
  debate={debate}
  index={0}
  isExpanded={expanded}
  onCollapse={() => setExpanded(false)}
/>
```

### MomentumTimeline
Visual timeline showing debate progression with momentum shifts.

```tsx
<MomentumTimeline debate={selectedDebate} />
```

### BattleCard
Side-by-side comparison of PRO and CON positions.

```tsx
<BattleCard debate={debate} />
```

## Data Types

### DebateThread
```typescript
interface DebateThread {
  id: string
  title: string
  rootArgument: string
  winner: 'pro' | 'con' | 'draw' | 'unresolved'
  heatLevel: number
  keyClash: string
  replies: DebateComment[]
  momentumShifts?: MomentumShift[]
}
```

### DebateComment
```typescript
interface DebateComment {
  id: string
  author: string
  text: string
  position: 'pro' | 'con' | 'neutral'
  qualityScore: number
  claims?: string[]
  createdAt: string
}
```

## Development

```bash
# Run development server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build for production
npm run build
```

## Deployment

The application is deployed on Vercel:
- Production: https://debate-analytics.vercel.app

```bash
# Deploy to Vercel
vercel --prod
```

## Recent Updates

### JSON Paste Mode for Production (Jan 2026)
- Added JSON paste mode to bypass Reddit's IP blocking on cloud servers
- Implemented sessionStorage caching for seamless page transitions
- Added TypeScript Reddit fetcher for local development
- Created in-memory API cache for serverless function optimization

### Phase 3 - Premium UI Components (Jan 2026)
- Added expandable DebateThreadCard with two-column PRO/CON layout
- Fixed MomentumTimeline node clustering with index-based positioning
- Added ArgumentCard component for individual argument display
- Implemented JSON response cleaning for Claude API

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
