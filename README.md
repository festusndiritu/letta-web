# Letta Web Client

Single-page chat client built with React + Vite.

## Codebase Layout

- `src/App.jsx`: app shell, chat workflows, websocket lifecycle, and feature wiring
- `src/config/chat.js`: environment-agnostic chat constants (API/WS endpoints, emoji list, RTC config)
- `src/utils/storage.js`: local storage helpers
- `src/utils/formatters.js`: date/time and avatar formatting helpers
- `src/styles/base.css`: root document sizing
- `src/styles/app.css`: full visual system and responsive layout rules

## UX Layout Rules Implemented

- Desktop: two-column shell with conversation sidebar + active conversation pane
- Mobile: slide-in sidebar drawer and full-screen chat pane
- Sticky composer: message input remains visible at the bottom while scrolling messages
- Scrollable regions: sidebar list and messages each keep independent scrolling

## Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: production build
- `npm run lint`: run ESLint
- `npm run preview`: preview production build
