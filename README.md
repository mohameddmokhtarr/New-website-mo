# Daily Tracker

Personal accountability tracker. Built with React + Vite.

## Local development

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the repository
4. Framework preset: **Vite**
5. Click Deploy

No environment variables needed. All data is stored in the browser's localStorage.

## Project structure

```
tracker/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx       # Entry point
    └── App.jsx        # Full app
```

## Notes

- Data persists in localStorage — it stays on the device/browser you use
- Export button downloads a JSON backup you can keep safe
- Streak resets and grace days are in Settings (tap the streak number)
