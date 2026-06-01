# 🎌 Anime Browser — MVC Edition

## Project Structure

```
anime-browser/
├── server.ts               # Deno backend — API proxy + static file server
├── deno.json               # Task runner config
└── public/                 # All frontend files (served as static assets)
    ├── index.html          # Browser page — pure HTML shell
    ├── stats.html          # Stats page  — pure HTML shell
    ├── css/
    │   └── main.css        # Shared styles
    └── js/
        ├── config.js       # Shared constants (GENRES, API_BASE, etc.)
        ├── state.js        # App state + localStorage helpers
        ├── api.js          # Model — all fetch/network calls
        ├── view.js         # View  — all DOM rendering for browser page
        ├── controller.js   # Controller — events, wires api → view
        └── stats/
            ├── model.js    # Stats model — pure data computation
            ├── view.js     # Stats view  — Chart.js rendering
            └── controller.js # Stats controller — orchestrates stats page
```

## MVC Responsibilities

| Layer | File(s) | Does |
|---|---|---|
| **Model** | `js/api.js`, `js/stats/model.js` | Fetch data, transform data — zero DOM access |
| **View** | `js/view.js`, `js/stats/view.js`, `css/main.css` | Render DOM, draw charts — zero fetch/state writes |
| **Controller** | `js/controller.js`, `js/stats/controller.js` | Handle events, call Model, pass results to View |
| **State** | `js/state.js` | Single source of truth, localStorage sync |
| **Config** | `js/config.js` | Constants shared across all modules |

## Run

```bash
deno task serve
```

Then open **http://localhost:8000**

## Features
- 🔍 Search, filter by Type / Genre / Year / Status, sort by score or date
- 🏷️ Include (`+`) and exclude (`-`) genres simultaneously
- 📺 Browse AniList, MyAnimeList (Jikan v4), or your imported list
- 👁️ Hide anime you've already watched from global results
- 📥 Import list via MAL username or XML export
- 📊 Stats page — score distribution, genre radar, decade timeline, completion rings, and more
