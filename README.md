# 🎌 Anime Browser & Personal Dashboard

A fast, lightweight, and highly responsive Anime Browser built with a Deno backend and a Vanilla JavaScript frontend. It aggregates data from the AniList GraphQL API and the MyAnimeList (Jikan) REST API, allowing users to discover new shows, import their personal watch lists, track release schedules, and generate rich statistical breakdowns of their viewing habits.

## ✨ Features

* **Unified API Browsing:** Seamlessly toggle between AniList and MyAnimeList data sources within the same UI.
* **Deep Filtering & Search:** Filter by format, airing status, release year, genres (include/exclude), and granular AniList tags (including minimum tag percentages and spoiler toggles).
* **List Synchronization:** Import your personal anime list using your MyAnimeList username or by uploading a standard MAL XML export file.
* **Smart Release Notifications:** A built-in notification engine cross-references your "Watching" list with live AniList broadcast schedules to instantly alert you when new episodes air or are upcoming.
* **Personalized Stats Dashboard:** A dedicated `/stats.html` page uses Chart.js to visualize your viewing habits, including score distributions, genre radar charts, decade breakdowns, and "Hot Takes" (how your scores compare to global averages).
* **Seamless Exploration:** Click on any anime to open a detailed modal featuring synopses, trailers, prequel/sequel relational mapping, and dynamic recommendations—all without leaving the page.

## 🛠️ Architecture & Tech Stack

This project strictly adheres to the **Model-View-Controller (MVC)** design pattern on the frontend to keep data logic, UI rendering, and event handling strictly separated. 

* **Frontend:** Vanilla ES Modules (JavaScript), HTML5, CSS3.
* **UI Libraries:** Bootstrap 5 (for grid and modals), Bootstrap Icons, Chart.js (for data visualization).
* **Backend:** Deno (TypeScript).
* **Data Sources:** AniList GraphQL API, Jikan V4 API.

### Why Deno?
The Deno backend (`server.ts`) serves two primary purposes:
1.  **Static File Serving:** Delivers the frontend HTML, CSS, and JS modules.
2.  **API Proxying:** Routes requests to Jikan and AniList through `/api/mal` and `/api/anilist` endpoints to cleanly bypass browser CORS restrictions and safely aggregate complex queries before sending them to the client.

## 🚀 Getting Started

### Prerequisites
You will need to have [Deno](https://deno.land/) installed on your machine.

### Installation & Execution
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/yourusername/anime-browser.git](https://github.com/yourusername/anime-browser.git)
   cd anime-browser