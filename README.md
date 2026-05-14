# 🎌 Anime Browser

A fast, dark-themed anime browser that pulls data from **AniList** (GraphQL) and **MyAnimeList** (via Jikan v4 — no API key needed).

## Features
- 🔍 Search by title
- 📺 Filter by Type: TV, Movie, OVA, ONA, Special, Music
- 🏷️ Filter by 40+ genres (Action, Isekai, Mecha, Romance, etc.)
- 📡 Filter by Status: Airing, Completed, Upcoming
- ↕️ Sort by MAL/AniList Score or Release Date
- 📄 Paginated results (24 per page)
- 🪟 Click any card to see full details
- 🔄 Switch between AniList and MyAnimeList sources

## Requirements

- [Deno](https://deno.land/) v1.38+

Install Deno:
```bash
# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex
```

## Run

```bash
deno run --allow-net --allow-read --watch server.ts
```

Then open **http://localhost:8000** in your browser.

## API Endpoints (used internally)

| Endpoint | Description |
|---|---|
| `GET /api/anilist` | AniList GraphQL proxy |
| `GET /api/mal` | MyAnimeList via Jikan v4 |
| `GET /api/genres` | List of all genres |

### Query Parameters (both endpoints)
| Param | Description | Example |
|---|---|---|
| `q` | Search query | `q=attack+on+titan` |
| `type` | Anime type | `type=tv` |
| `genres` | Comma-separated genres | `genres=Action,Mecha` |
| `status` | Airing status | `status=airing` |
| `sort` | Sort order | `sort=score_desc` |
| `page` | Page number | `page=2` |
| `limit` | Results per page (max 25 for MAL) | `limit=24` |

## Notes

- **AniList** data is free, fast, and has rich metadata.
- **MyAnimeList** uses [Jikan v4](https://jikan.moe/) — free, no key needed. Rate-limited to ~3 req/sec.
- No authentication or API keys required for either source.
