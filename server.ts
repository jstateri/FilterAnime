// Anime Browser — Deno Backend
// Proxies MyAnimeList (Jikan v4) and AniList (GraphQL) APIs
// Run: deno run --allow-net --allow-read server.ts

const PORT = parseInt(Deno.env.get("PORT") || "8000");

// ─── CORS helper ─────────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// ─── MAL via Jikan v4 (no API key required) ──────────────────────────────────
async function fetchMALAnime(params: {
  q?: string; type?: string; genres?: string; genres_exclude?: string;
  status?: string; years?: string; order_by?: string; sort?: string;
  page?: number; limit?: number;
}) {
  const base = "https://api.jikan.moe/v4/anime";
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.type) query.set("type", params.type);
  if (params.genres) query.set("genres", params.genres);
  if (params.genres_exclude) query.set("genres_exclude", params.genres_exclude);
  if (params.status) query.set("status", params.status);
  
  if (params.years) {
    const yearList: number[] = [];
    for (const y of params.years.split(',')) {
      if (y.endsWith('s')) {
        const decade = parseInt(y);
        for (let i = 0; i < 10; i++) yearList.push(decade + i);
      } else {
        yearList.push(parseInt(y));
      }
    }
    if (yearList.length > 0) {
      query.set("start_date", `${Math.min(...yearList)}-01-01`);
      query.set("end_date", `${Math.max(...yearList)}-12-31`);
    }
  }

  if (params.order_by) query.set("order_by", params.order_by);
  if (params.sort) query.set("sort", params.sort);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 24));
  query.set("sfw", "false");

  const res = await fetch(`${base}?${query}`);
  if (!res.ok) throw new Error(`Jikan ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ─── AniList via GraphQL ──────────────────────────────────────────────────────
async function fetchAniListAnime(params: {
  search?: string; type?: string; 
  genres?: string[]; genresExclude?: string[]; 
  tags?: string[]; tagsExclude?: string[];
  year?: number; startDateGreater?: number; startDateLesser?: number;
  status?: string; sort?: string[]; page?: number; perPage?: number;
  idMalIn?: number[]; 
  idMalNotIn?: number[]; // For hiding user's anime
}) {
  const query = `
    query ($page: Int, $perPage: Int, $search: String, $type: MediaFormat,
           $genres: [String], $genresExclude: [String], 
           $tags: [String], $tagsExclude: [String],
           $year: Int, $startDateGreater: FuzzyDateInt, $startDateLesser: FuzzyDateInt,
           $status: MediaStatus, $sort: [MediaSort], $idMalIn: [Int], $idMalNotIn: [Int]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(
          search: $search, format: $type, 
          genre_in: $genres, genre_not_in: $genresExclude, 
          tag_in: $tags, tag_not_in: $tagsExclude,
          seasonYear: $year, 
          startDate_greater: $startDateGreater, 
          startDate_lesser: $startDateLesser,
          status: $status, sort: $sort, type: ANIME,
          idMal_in: $idMalIn,
          idMal_not_in: $idMalNotIn
        ) {
          id
          idMal
          title { romaji english native }
          coverImage { large medium color }
          bannerImage
          format
          status
          episodes
          duration
          genres
          averageScore
          popularity
          startDate { year month day }
          endDate   { year month day }
          season
          seasonYear
          studios(isMain: true) { nodes { name } }
          description(asHtml: false)
          siteUrl
          externalLinks { site url }
        }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    page: params.page ?? 1, perPage: params.perPage ?? 24,
  };
  if (params.search) variables.search = params.search;
  if (params.type) variables.type = params.type;
  if (params.genres?.length) variables.genres = params.genres;
  if (params.genresExclude?.length) variables.genresExclude = params.genresExclude;
  if (params.tags?.length) variables.tags = params.tags;
  if (params.tagsExclude?.length) variables.tagsExclude = params.tagsExclude;
  if (params.year) variables.year = params.year;
  if (params.startDateGreater) variables.startDateGreater = params.startDateGreater;
  if (params.startDateLesser) variables.startDateLesser = params.startDateLesser;
  if (params.status) variables.status = params.status;
  if (params.sort?.length) variables.sort = params.sort;
  if (params.idMalIn?.length) variables.idMalIn = params.idMalIn;
  if (params.idMalNotIn?.length) variables.idMalNotIn = params.idMalNotIn;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ─── Genre map (AniList name → Jikan ID) ────────────────────────────────────
const GENRE_MAP: Record<string, number> = {
  "Action": 1, "Adventure": 2, "Avant Garde": 5, "Boys Love": 28,
  "Comedy": 4, "Demons": 6, "Drama": 8, "Ecchi": 9, "Fantasy": 10,
  "Girls Love": 26, "Gourmet": 47, "Harem": 35, "Horror": 14,
  "Isekai": 62, "Iyashikei": 63, "Josei": 43, "Kids": 15,
  "Magic": 16, "Mahou Shoujo": 64, "Martial Arts": 17, "Mecha": 18,
  "Military": 38, "Music": 19, "Mystery": 7, "Parody": 20,
  "Psychological": 40, "Reincarnation": 73, "Reverse Harem": 56, "Romance": 22, "School": 23,
  "Sci-Fi": 24, "Seinen": 42, "Shoujo": 25, "Shounen": 27,
  "Slice of Life": 36, "Space": 29, "Sports": 30, "Super Power": 31,
  "Supernatural": 37, "Suspense": 41, "Thriller": 41, "Vampire": 32,
};

// AniList strictly only allows these 18 genres. Everything else must be passed as a Tag.
const AL_CORE_GENRES = new Set([
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", 
  "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", 
  "Psychological", "Romance", "Sci-Fi", "Slice of Life", 
  "Sports", "Supernatural", "Thriller"
]);

// ─── Router ──────────────────────────────────────────────────────────────────
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, { headers: { "Content-Type": "text/html", ...corsHeaders() } });
    } catch {
      return new Response("index.html not found", { status: 404 });
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  // ── /api/import-mal (NEW: Fetch List by Username) ──────────────────────────
  if (url.pathname === "/api/import-mal") {
    try {
      const username = url.searchParams.get("username");
      if (!username) return json({ error: "Username required" }, 400);

      const allAnime = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await fetch(`https://myanimelist.net/animelist/${username}/load.json?offset=${offset}&status=7`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (!res.ok) throw new Error(`MAL responded with ${res.status}. Profile might be private or username is incorrect.`);
        
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          hasMore = false;
        } else {
          allAnime.push(...data);
          offset += 300;
          if (offset >= 10000) hasMore = false; // Failsafe cap
        }
      }

      return json(allAnime);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // ── /api/mal ────────────────────────────────────────────────────────────────
  if (url.pathname === "/api/mal") {
    try {
      const p = url.searchParams;
      const genreNames = p.get("genres")?.split(",").filter(Boolean) ?? [];
      const genreIds = genreNames.map((g) => GENRE_MAP[g]).filter(Boolean).join(",");
      
      const excludeNames = p.get("genres_exclude")?.split(",").filter(Boolean) ?? [];
      const excludeIds = excludeNames.map((g) => GENRE_MAP[g]).filter(Boolean).join(",");

      const sortRaw = p.get("sort") ?? "score_desc";
      let order_by = "score", sort = "desc";
      if (sortRaw === "score_asc") { order_by = "score"; sort = "asc"; }
      if (sortRaw === "date_asc") { order_by = "start_date"; sort = "asc"; }
      if (sortRaw === "date_desc") { order_by = "start_date"; sort = "desc"; }

      const data = await fetchMALAnime({
        q: p.get("q") ?? undefined, type: p.get("type") ?? undefined, status: p.get("status") ?? undefined,
        genres: genreIds || undefined, genres_exclude: excludeIds || undefined,
        years: p.get("years") ?? undefined,
        order_by, sort,
        page: parseInt(p.get("page") ?? "1"), limit: parseInt(p.get("limit") ?? "24"),
      });
      return json(data);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // ── /api/anilist ─────────────────────────────────────────────────────────────
  if (url.pathname === "/api/anilist") {
    try {
      let p: URLSearchParams;
      let idsRaw: string | undefined;
      let excludeIdsRaw: string | undefined;

      // Handle massive ID arrays via POST
      if (req.method === "POST") {
        const body = await req.json();
        p = new URLSearchParams(body.params || "");
        idsRaw = body.ids;
        excludeIdsRaw = body.exclude_ids;
      } else {
        p = url.searchParams;
        idsRaw = p.get("ids") ?? undefined;
        excludeIdsRaw = p.get("exclude_ids") ?? undefined;
      }

      const rawGenres = p.get("genres")?.split(",").filter(Boolean) ?? [];
      const rawExcludes = p.get("genres_exclude")?.split(",").filter(Boolean) ?? [];
      
      const idMalIn = idsRaw ? idsRaw.split(",").map(Number).filter(n => !isNaN(n)) : undefined;
      const idMalNotIn = excludeIdsRaw ? excludeIdsRaw.split(",").map(Number).filter(n => !isNaN(n)) : undefined;

      // Clean AniList specific spelling quirks
      const cleanTag = (t: string) => {
        if (t === "Boys Love") return "Boys' Love";
        if (t === "Girls Love") return "Girls' Love";
        return t;
      };

      // Split into strict Genres vs Tags
      const alGenres: string[] = [];
      const alTags: string[] = [];
      rawGenres.forEach(g => AL_CORE_GENRES.has(g) ? alGenres.push(g) : alTags.push(cleanTag(g)));

      const alGenresExclude: string[] = [];
      const alTagsExclude: string[] = [];
      rawExcludes.forEach(g => AL_CORE_GENRES.has(g) ? alGenresExclude.push(g) : alTagsExclude.push(cleanTag(g)));

      const typeMap: Record<string, string> = { tv: "TV", movie: "MOVIE", ova: "OVA", ona: "ONA", special: "SPECIAL", music: "MUSIC" };
      const alType = typeMap[(p.get("type") ?? "").toLowerCase()] ?? undefined;

      const statusMap: Record<string, string> = { airing: "RELEASING", complete: "FINISHED", upcoming: "NOT_YET_RELEASED" };
      const alStatus = statusMap[(p.get("status") ?? "").toLowerCase()] ?? undefined;

      const sortRaw = p.get("sort") ?? "score_desc";
      const sortMap: Record<string, string[]> = { score_desc: ["SCORE_DESC"], score_asc: ["SCORE"], date_desc: ["START_DATE_DESC"], date_asc: ["START_DATE"] };

      const yearList: number[] = [];
      const yearsParam = p.get("years");
      if (yearsParam) {
        for (const y of yearsParam.split(',')) {
          if (y.endsWith('s')) {
            const decade = parseInt(y);
            for (let i = 0; i < 10; i++) yearList.push(decade + i);
          } else {
            yearList.push(parseInt(y));
          }
        }
      }

      let year: number | undefined;
      let startDateGreater: number | undefined;
      let startDateLesser: number | undefined;

      if (yearList.length === 1) {
        year = yearList[0];
      } else if (yearList.length > 1) {
        const min = Math.min(...yearList);
        const max = Math.max(...yearList);
        startDateGreater = min * 10000;
        startDateLesser = max * 10000 + 1231;
      }

      const data = await fetchAniListAnime({
        search: p.get("q") ?? undefined, type: alType,
        genres: alGenres.length ? alGenres : undefined,
        genresExclude: alGenresExclude.length ? alGenresExclude : undefined,
        tags: alTags.length ? alTags : undefined,
        tagsExclude: alTagsExclude.length ? alTagsExclude : undefined,
        year, startDateGreater, startDateLesser,
        status: alStatus, sort: sortMap[sortRaw] ?? ["SCORE_DESC"],
        page: parseInt(p.get("page") ?? "1"), perPage: parseInt(p.get("limit") ?? "24"),
        idMalIn,
        idMalNotIn
      });
      return json(data);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // ── /api/genres ──────────────────────────────────────────────────────────────
  if (url.pathname === "/api/genres") {
    return json({ genres: Object.keys(GENRE_MAP) });
  }

  return new Response("Not found", { status: 404 });
}

console.log(`🎌 Anime Browser running → http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handler);
