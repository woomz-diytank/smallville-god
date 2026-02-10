# Smallville God - 小镇之神

A god simulation game where you influence NPCs through divine oracles.

## Game Concept

You are a newly awakened deity in a small town. Gain the faith of the townspeople by sending divine messages and performing miracles. Each NPC has their own personality - the devout will embrace your words, while the cynical may dismiss them.

**Core Loop**: Faith → Divine Power → Oracle → Influence NPCs → Faith

## Features

- **2 NPCs** with distinct personalities (Elara the Nun, Sly the Vagabond)
- **4 Locations** (Altar, Tavern, Plaza, Forest)
- **50+ specific actions** (praying, brewing ale, hunting, gambling, etc.)
- **Divine Oracles** - Send messages or cast Holy Light
- **LLM Integration** - Gemini API generates dynamic NPC responses
- **Bilingual** - Chinese/English support

## Tech Stack

- Vite + Vanilla JavaScript
- Canvas 2D rendering
- Google Gemini API for narrative generation

## Setup

```bash
# Install dependencies
npm install

# Set your Gemini API key
# Edit .env.local and add:
VITE_GEMINI_API_KEY=your_api_key_here

# Start development server
npm run dev

# Build for production
npm run build
```

## How to Play

1. Click **▶** to start time flowing (24 game hours = 120 real seconds)
2. Watch NPCs go about their daily routines
3. Click an NPC to see their details and inner thoughts
4. Send **Oracle messages** to influence their behavior
5. Use **Holy Light** (☀) for a powerful faith boost
6. Reach 100 global faith to win!

## Project Structure

```
smallville-god/
├── src/
│   ├── main.js              # Entry point
│   ├── style.css            # Styles
│   ├── i18n/                # Translations (zh/en)
│   └── game/
│       ├── GameState.js     # Global state
│       ├── Renderer.js      # Canvas rendering
│       ├── constants.js     # Config
│       ├── entities/        # NPC, Location classes
│       ├── data/            # NPC profiles
│       ├── systems/         # Time, Schedule, Oracle
│       ├── llm/             # Gemini integration
│       └── ui/              # UI panels
```

## Future Plans

- [ ] Add 6 more NPCs
- [ ] Three-layer memory system
- [ ] More oracle skills
- [ ] Time rewind feature
- [ ] NPC-to-NPC influence
- [ ] Visual polish

## License

MIT
