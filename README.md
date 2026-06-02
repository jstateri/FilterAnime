<div align="center">
  <img src="public/favicon.svg" alt="Anime Tracker Logo" width="120" height="120">
  <h1>Anime Tracker & Browser</h1>
  <p><strong>A high-performance, local-first anime discovery engine and personal dashboard.</strong></p>
</div>

<br/>

Anime Tracker & Browser is a lightweight, responsive web application that bridges the gap between the two largest anime databases: **AniList** and **MyAnimeList (MAL)**. It allows users to browse an extensive catalog, import their personal anime lists without authentication, explore advanced viewing statistics, and discover highly-tailored recommendations.

Built with **Deno** on the backend to elegantly bypass CORS restrictions, and completely vanilla **ES Modules** on the frontend, this project is designed for speed, modularity, and frictionless user experience.

## ✨ Key Features

- **Cross-Database Browser:** Instantly search, filter, and sort anime utilizing both the AniList GraphQL API and the Jikan (MAL) REST API.
- **Frictionless Import:** Import your entire MyAnimeList profile seamlessly using just your public username, or upload an exported XML file. No OAuth or passwords required.
- **Advanced Filtering Engine:** Filter your imported lists or the global database by Genres, Themes, highly specific Tags, Year ranges (e.g., 1990-2010), Status, Minimum Scores, and Format. Erotica and Hentai are automatically excluded for a safe browsing experience.
- **Dub/Sub Language Detection:** The AniList integration automatically scans voice actor metadata to display beautifully styled language availability badges (prioritizing Japanese and English) directly on your anime cards and detailed modals.
- **Personalized Schedule Tracker:** View the upcoming airing schedule of your anime, with cards dynamically color-coded to match your personal list status (Watching, Plan to Watch, Dropped, Completed, On-Hold).
- **Deep Recommendations Engine:** A dedicated smart recommendations tab that cross-references your current list with highly-rated AniList and MAL recommendations, strictly filtering out shows you've already seen.
- **Interactive Statistics Dashboard:** Beautiful, interactive visual analytics built with Chart.js. Track your watch time, analyze your score distributions, view your top genres via radar charts, and uncover obscure "hot takes".
- **Responsive & Modern UI:** A sleek, glassmorphic dark-mode design with fluid micro-animations, custom 404 error routing, and fully optimized layouts for both desktop and mobile devices.

## 🛠️ Technology Stack

**Frontend:**
- **Core:** HTML5, CSS3, Vanilla JavaScript (ES Modules)
- **Architecture:** Client-side Model-View-Controller (MVC) pattern
- **Styling:** Custom CSS Custom Properties (Tokens) alongside Bootstrap 5 (for utility grid/modals)
- **Data Visualization:** Chart.js

**Backend:**
- **Runtime:** [Deno](https://deno.com/) (TypeScript)
- **Architecture:** Lightweight HTTP Server & API Proxy
- **APIs Consumed:**
  - [AniList GraphQL API](https://anilist.co/graphiql)
  - [Jikan REST API v4](https://jikan.moe/)

## 🏗️ Architecture Overview

The application follows a clean separation of concerns:

1. **Deno API Proxy (`server.ts`)**: 
   Because modern browsers restrict Cross-Origin Resource Sharing (CORS), querying third-party APIs directly from the client can be unstable. The Deno server acts as a lightning-fast proxy. It securely constructs complex GraphQL queries and forwards REST requests to MAL, then pipes the sanitized JSON responses back to the client. It also acts as the static file server for the application.

2. **Modular Frontend (`public/js/`)**:
   The frontend is completely free of heavy frameworks like React or Vue. Instead, it relies on native ES Modules divided by feature-domain (`/stats`, `/recs`, `/browser`) and follows a strict MVC pattern:
   - `model.js`: Handles data fetching (via the proxy) and complex data aggregation.
   - `view.js`: Handles DOM manipulation, HTML injection, and UI state updates.
   - `controller.js`: Orchestrates the flow of data between the model and the view, managing event listeners and user interactions.
   - `state.js`: A centralized, single source of truth for global application state (filters, pagination, imported lists) utilizing `localStorage` for persistence.

## 🚀 Installation & Running

### Prerequisites
- [Deno](https://deno.land/) (v1.40 or higher recommended)

### Setup Instructions

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jstateri/FilterAnime.git
   cd FilterAnime
   ```

2. **Run the server:**
   The project requires no `npm install` or complex build steps. Simply use the built-in Deno task runner:
   ```bash
   deno task serve
   ```
   *Alternatively, run the explicit command:*
   ```bash
   deno run --allow-net --allow-read --watch server.ts
   ```

3. **Access the application:**
   Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

## 📂 Project Structure

```text
├── deno.json                # Deno configuration and task scripts
├── server.ts                # Deno backend server and API proxy
└── public/                  # Static frontend assets
    ├── index.html           # Main Browser & Library view
    ├── recs.html            # Smart Recommendations view
    ├── stats.html           # Analytics Dashboard view
    ├── schedule.html        # Upcoming Release Schedule view
    ├── 404.html             # Custom Not Found error page
    ├── favicon.svg          # Application icon
    ├── css/
    │   ├── main.css         # Global design system & theme tokens
    │   └── notifications.css# Toast notification styles
    └── js/
        ├── api.js           # Core API networking layer
        ├── state.js         # Centralized state & localStorage manager
        ├── view.js          # Shared UI rendering functions & modals
        ├── controller.js    # Main browser logic
        ├── stats/           # Logic specific to the Stats Dashboard
        │   ├── model.js
        │   ├── view.js
        │   └── controller.js
        └── recs/            # Logic specific to Smart Recommendations
            ├── model.js
            ├── view.js
            └── controller.js
```

## 🧠 Technical Highlights & Design Decisions

- **Zero-Dependency Frontend Build:** By leveraging native browser features like ES Modules (`<script type="module">`) and modern CSS variables, the project entirely skips Webpack/Vite build steps. This results in instant cold starts during development and highly legible source code.
- **Graceful Rate Limiting:** The backend proxies implement intentional delays and chunking algorithms when aggregating large user lists (e.g., fetching extended metadata for 1000+ anime) to respect AniList and Jikan rate limits.
- **Local-First Persistence:** Rather than requiring users to create an account, the app relies on `localStorage` to save imported lists and user preferences. This respects user privacy while providing an instant, personalized experience upon returning.
- **Unified Data Normalization:** Because AniList and MAL use completely different data schemas, the `api.js` layer includes normalization algorithms that map both data sources into a standardized internal schema before handing it off to the UI components.

## 🛡️ Performance, Security, and Scalability

- **Performance:** Bypassing traditional build pipelines (Webpack/Babel) means zero-cost compilation. The app leverages native browser ES Modules, and static assets are cached aggressively. The UI uses hardware-accelerated CSS properties (`transform`, `opacity`) for 60fps micro-animations.
- **Security:** The backend Deno proxy ensures that external APIs are accessed securely from the server side. Because the app uses a Local-First architecture, user data (imported anime lists, custom tags) is stored entirely in the client's `localStorage`. No personal data, passwords, or OAuth tokens are ever transmitted to or stored on our servers.
- **Scalability:** The architecture offloads all heavy lifting (DOM rendering, chart calculations, data sorting) to the client. The Deno backend acts purely as a stateless I/O proxy. This means the server can effortlessly scale to handle thousands of concurrent users with minimal memory footprint. Rate-limiting logic ensures we never flood upstream APIs (AniList/MAL).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! 
If you plan on making significant architectural changes, please open an issue first to discuss your proposed implementation.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).