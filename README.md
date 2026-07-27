# Beehive Letter Game

A complete local web application for a competitive quiz game played by two teams on three screens simultaneously.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Socket.io with a custom Next.js server (`server.ts`)
- Zustand for game state
- Framer Motion for animations
- `fs` for local JSON data persistence

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open the application screens:**
   - **Main Menu**: [http://localhost:3000](http://localhost:3000)
   - **Board (Wall display)**: [http://localhost:3000/board](http://localhost:3000/board)
   - **Admin (Laptop)**: [http://localhost:3000/admin](http://localhost:3000/admin)
   - **Presenter (Tablet on same WiFi)**: `http://[your-local-ip]:3000/presenter`

## Game Rules
- Two teams compete on a hexagonal grid.
- Team RED tries to connect the LEFT side to the RIGHT side.
- Team BLUE tries to connect the TOP side to the BOTTOM side.
- To claim a hexagon, a team must correctly answer a trivia question whose answer starts with the letter shown in that hexagon.
- Each team has a single "Joker" power-up they can use to force the question category before selecting a letter.
