/**
 * @fileoverview server.ts - Deno Backend Server
 * 
 * A lightweight Deno HTTP server for the Anime Browser application.
 * This server fulfills two main roles:
 * 1. **Static File Serving:** Delivers HTML, CSS, JS, and image assets from the `./public/` directory.
 * 2. **API Proxy:** Routes requests to the Jikan (MyAnimeList) and AniList APIs. This circumvents CORS restrictions
 *    enforced by modern browsers and securely structures complex GraphQL payloads for AniList before dispatching.
 * 
 * Execution: `deno run --allow-net --allow-read --watch server.ts`
 */
//const PORT = parseInt(Deno.env.get("PORT") || "8000"); //deployement
const PORT = 8000; //local

// Resolve the project root relative to this script file so the server works
// regardless of which directory `deno run` is executed from.
function resolveRoot(): string {
  // Strategy 1: import.meta.dirname (Deno 1.40+)
  if (import.meta.dirname) return import.meta.dirname;
  // Strategy 2: derive from import.meta.url (all Deno versions)
  if (import.meta.url) {
    return new URL(".", import.meta.url).pathname
      .replace(/^\/([A-Za-z]:)/, "$1")  // Windows: /C:/foo → C:/foo
      .replace(/\/$/, "");              // strip trailing slash
  }
  // Strategy 3: cwd fallback
  return Deno.cwd();
}

const ROOT = resolveRoot();

// ─── CORS ─────────────────────────────────────────────────────────────────
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// ─── Static file server ───────────────────────────────────────────────────
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
};

async function serveStatic(pathname: string): Promise<Response | null> {
  // Map "/" and unknown extensions → "/index.html"
  if (pathname === "/" || pathname === "") pathname = "/index.html";

  // Security: block path traversal
  if (pathname.includes("..")) return null;

  const filePath = `${ROOT}/public${pathname}`;
  try {
    const data = await Deno.readFile(filePath);
    const ext  = pathname.substring(pathname.lastIndexOf(".")) || ".html";
    return new Response(data, {
      headers: { "Content-Type": MIME[ext] ?? "application/octet-stream", ...corsHeaders() },
    });
  } catch {
    return null; // File not found → fall through to API routes / 404
  }
}

// ─── Jikan v4 (MAL) ───────────────────────────────────────────────────────

/**
 * Constructs and executes a REST API call to the Jikan V4 endpoint (api.jikan.moe).
 * Maps custom frontend query parameters into strict Jikan-compatible URLSearchParams.
 * 
 * @param {Object} params - Query parameters from the frontend.
 * @param {string} [params.q] - Search query.
 * @param {string} [params.type] - Anime type (e.g., 'tv', 'movie').
 * @param {string} [params.genres] - Comma-separated list of genre IDs to include.
 * @param {string} [params.genres_exclude] - Comma-separated list of genre IDs to exclude.
 * @param {string} [params.status] - Airing status (e.g., 'airing', 'complete').
 * @param {string} [params.years] - Comma-separated list of years or decades. Parsed into min/max date ranges.
 * @param {string} [params.order_by] - Field to order by.
 * @param {string} [params.sort] - Sort direction ('asc' or 'desc').
 * @param {number} [params.page] - Pagination page number.
 * @param {number} [params.limit] - Number of items per page.
 * @returns {Promise<Response>} The raw Response object from the Jikan API.
 */
async function fetchMALAnime(params: {
  q?: string; type?: string; genres?: string; genres_exclude?: string;
  status?: string; years?: string; order_by?: string; sort?: string;
  page?: number; limit?: number; min_score?: number;
}) {
  const query = new URLSearchParams();
  if (params.q)              query.set("q",      params.q);
  if (params.type)           query.set("type",   params.type);
  if (params.genres)         query.set("genres", params.genres);
  if (params.genres_exclude) query.set("genres_exclude", params.genres_exclude);
  if (params.status)         query.set("status", params.status);

  if (params.years) {
    const yearList: number[] = [];
    for (const y of params.years.split(",")) {
      if (y.endsWith("s")) {
        const decade = parseInt(y);
        for (let i = 0; i < 10; i++) yearList.push(decade + i);
      } else {
        yearList.push(parseInt(y));
      }
    }
    if (yearList.length) {
      query.set("start_date", `${Math.min(...yearList)}-01-01`);
      query.set("end_date",   `${Math.max(...yearList)}-12-31`);
    }
  }

  if (params.order_by) query.set("order_by", params.order_by);
  if (params.sort)     query.set("sort",     params.sort);
  if (params.min_score) query.set("min_score", String(params.min_score));
  query.set("page",  String(params.page  ?? 1));
  query.set("limit", String(params.limit ?? 24));
  query.set("sfw", "false");

  const res = await fetch(`https://api.jikan.moe/v4/anime?${query}`);
  if (!res.ok) throw new Error(`Jikan ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ─── AniList (GraphQL) ────────────────────────────────────────────────────
const AL_CORE_GENRES = new Set([
  "Action","Adventure","Comedy","Drama","Ecchi","Fantasy",
  "Horror","Mahou Shoujo","Mecha","Music","Mystery",
  "Psychological","Romance","Sci-Fi","Slice of Life",
  "Sports","Supernatural","Thriller",
]);

const GENRE_MAP: Record<string, number> = {
  "Action": 1, "Adventure": 2, "Avant Garde": 5, "Award Winning": 46, "Boys Love": 28,
  "Comedy": 4, "Drama": 8, "Fantasy": 10, "Girls Love": 26, "Gourmet": 47, "Horror": 14,
  "Mystery": 7, "Romance": 22, "Sci-Fi": 24, "Slice of Life": 36, "Sports": 30,
  "Supernatural": 37, "Suspense": 41, "Ecchi": 9, "Erotica": 49, "Hentai": 12,
  "Josei": 43, "Kids": 15, "Seinen": 42, "Shoujo": 25, "Shounen": 27, "Adult Cast": 50,
  "Anthropomorphic": 51, "CGDCT": 52, "Childcare": 53, "Combat Sports": 54,
  "Crossdressing": 81, "Delinquents": 55, "Detective": 39, "Educational": 56,
  "Gag Humor": 57, "Gore": 58, "Harem": 35, "High Stakes Game": 59, "Historical": 13,
  "Idols (Female)": 60, "Idols (Male)": 61, "Isekai": 62, "Iyashikei": 63,
  "Love Polygon": 64, "Magical Sex Shift": 65, "Mahou Shoujo": 66, "Martial Arts": 17,
  "Mecha": 18, "Medical": 67, "Military": 38, "Music": 19, "Mythology": 6,
  "Organized Crime": 68, "Otaku Culture": 69, "Parody": 20, "Performing Arts": 70,
  "Pets": 71, "Psychological": 40, "Racing": 3, "Reincarnation": 72, "Reverse Harem": 73,
  "Love Status Quo": 74, "Samurai": 21, "School": 23, "Showbiz": 75, "Space": 29,
  "Strategy Game": 11, "Super Power": 31, "Survival": 76, "Team Sports": 77,
  "Time Travel": 78, "Vampire": 32, "Video Game": 79, "Visual Arts": 80,
  "Workplace": 48, "Urban Fantasy": 82, "Villainess": 83
};

function cleanAniListTag(t: string): string {
  if (t === "Boys Love")  return "Boys' Love";
  if (t === "Girls Love") return "Girls' Love";
  return t;
}

async function fetchAniListAnime(vars: Record<string, unknown>) {
  const query = `
    query ($page:Int,$perPage:Int,$search:String,$type:MediaFormat,
           $genres:[String],$genresExclude:[String],$tags:[String],$tagsExclude:[String],
           $year:Int,$startDateGreater:FuzzyDateInt,$startDateLesser:FuzzyDateInt,
           $status:MediaStatus,$sort:[MediaSort],$idMalIn:[Int],$idMalNotIn:[Int],
           $minimumTagRank:Int,$averageScoreGreater:Int) {
      Page(page:$page,perPage:$perPage) {
        pageInfo { total currentPage lastPage hasNextPage perPage }
        media(
          search:$search, format:$type,
          genre_in:$genres, genre_not_in:$genresExclude,
          tag_in:$tags, tag_not_in:$tagsExclude,
          seasonYear:$year,
          startDate_greater:$startDateGreater, startDate_lesser:$startDateLesser,
          status:$status, sort:$sort, type:ANIME,
          isAdult:false,
          minimumTagRank:$minimumTagRank,
          averageScore_greater:$averageScoreGreater,
          idMal_in:$idMalIn, idMal_not_in:$idMalNotIn
        ) {
          id idMal
          title { romaji english native }
          coverImage { large medium color }
          bannerImage format status episodes duration genres averageScore popularity
          startDate { year month day } endDate { year month day }
          season seasonYear
          studios(isMain:true) { nodes { name } }
          tags { name rank isMediaSpoiler isGeneralSpoiler category }
          characters(perPage: 3, sort: ROLE) {
            edges {
              node { id }
              voiceActors {
                languageV2
              }
            }
          }
          description(asHtml:false) siteUrl
          externalLinks { site url }
        }
      }
    }`;

  const res = await fetch("https://graphql.anilist.co", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ query, variables: vars }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ─── Build AniList variables from URLSearchParams ─────────────────────────
/**
 * Translates HTTP URL query parameters into strongly typed GraphQL variables for the AniList API.
 * This function also performs semantic splitting between "Genres" and "Tags", as AniList
 * treats them as two separate schema fields, unlike MyAnimeList.
 * 
 * @param {URLSearchParams} p - The query parameters parsed from the HTTP request URL.
 * @param {string} [idsRaw] - Comma-separated MAL IDs to explicitly include (for "My List" filtering).
 * @param {string} [excludeIdsRaw] - Comma-separated MAL IDs to explicitly exclude.
 * @returns {Record<string, unknown>} A dictionary of GraphQL variables mapped to the AniList schema.
 */
function buildAniListVars(
  p: URLSearchParams,
  idsRaw?: string,
  excludeIdsRaw?: string,
): Record<string, unknown> {
  const rawGenres   = p.get("genres")?.split(",").filter(Boolean)          ?? [];
  const rawExcludes = p.get("genres_exclude")?.split(",").filter(Boolean)  ?? [];
  // Dedicated tag params (separate from genres so no genre/tag routing ambiguity)
  const rawTagsIn   = p.get("tags_in")?.split(",").filter(Boolean)          ?? [];
  const rawTagsEx   = p.get("tags_ex")?.split(",").filter(Boolean)          ?? [];

  const alGenres:        string[] = [];
  const alTags:          string[] = [];
  const alGenresExclude: string[] = [];
  const alTagsExclude:   string[] = [];

  rawGenres.forEach(g =>
    AL_CORE_GENRES.has(g) ? alGenres.push(g) : alTags.push(cleanAniListTag(g)));
  rawExcludes.forEach(g =>
    AL_CORE_GENRES.has(g) ? alGenresExclude.push(g) : alTagsExclude.push(cleanAniListTag(g)));

  // Merge dedicated tag params directly into the tag arrays
  rawTagsIn.forEach(t => { if (!alTags.includes(t))        alTags.push(t); });
  rawTagsEx.forEach(t => { if (!alTagsExclude.includes(t)) alTagsExclude.push(t); });

  const minTagRank = parseInt(p.get("tag_min_pct") ?? "0") || 0;

  const typeMap: Record<string, string> = {
    tv:"TV", movie:"MOVIE", ova:"OVA", ona:"ONA", special:"SPECIAL", music:"MUSIC",
  };
  const statusMap: Record<string, string> = {
    airing:"RELEASING", complete:"FINISHED", upcoming:"NOT_YET_RELEASED",
  };
  const sortMap: Record<string, string[]> = {
    score_desc:["SCORE_DESC"], score_asc:["SCORE"],
    date_desc:["START_DATE_DESC"], date_asc:["START_DATE"],
    popularity_desc:["POPULARITY_DESC"], popularity_asc:["POPULARITY"],
  };

  // Year / decade range
  const yearList: number[] = [];
  const yearsParam = p.get("years");
  if (yearsParam) {
    for (const y of yearsParam.split(",")) {
      if (y.endsWith("s")) {
        const d = parseInt(y);
        for (let i = 0; i < 10; i++) yearList.push(d + i);
      } else {
        yearList.push(parseInt(y));
      }
    }
  }

  const vars: Record<string, unknown> = {
    page:    parseInt(p.get("page")  ?? "1"),
    perPage: parseInt(p.get("limit") ?? "24"),
  };

  if (p.get("q"))                   vars.search        = p.get("q");
  if (typeMap[p.get("type") ?? ""]) vars.type          = typeMap[p.get("type")!.toLowerCase()];
  if (statusMap[p.get("status") ?? ""]) vars.status    = statusMap[p.get("status")!.toLowerCase()];
  if (alGenres.length)              vars.genres        = alGenres;
  if (alGenresExclude.length)       vars.genresExclude = alGenresExclude;
  if (alTags.length)                vars.tags          = alTags;
  if (alTagsExclude.length)         vars.tagsExclude   = alTagsExclude;

  vars.sort = sortMap[p.get("sort") ?? "score_desc"] ?? ["SCORE_DESC"];
  if (minTagRank > 0) vars.minimumTagRank = minTagRank;
  const minScore = parseFloat(p.get("min_score") ?? "0") || 0;
  if (minScore > 0) vars.averageScoreGreater = Math.round(minScore * 10);

  if (yearList.length === 1) {
    vars.year = yearList[0];
  } else if (yearList.length > 1) {
    vars.startDateGreater = Math.min(...yearList) * 10000;
    vars.startDateLesser  = Math.max(...yearList) * 10000 + 1231;
  }

  if (idsRaw) {
    const ids = idsRaw.split(",").map(Number).filter(n => !isNaN(n));
    if (ids.length) vars.idMalIn = ids;
  }
  if (excludeIdsRaw) {
    const ids = excludeIdsRaw.split(",").map(Number).filter(n => !isNaN(n));
    if (ids.length) vars.idMalNotIn = ids;
  }

  return vars;
}

// ─── Request handler ──────────────────────────────────────────────────────
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Preflight
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  // ── /api/anilist ─────────────────────────────────────────────────────────
  if (url.pathname === "/api/anilist") {
    try {
      let p: URLSearchParams;
      let idsRaw: string | undefined;
      let excludeIdsRaw: string | undefined;

      if (req.method === "POST") {
        const body    = await req.json();
        p             = new URLSearchParams(body.params ?? "");
        idsRaw        = body.ids;
        excludeIdsRaw = body.exclude_ids;
      } else {
        p             = url.searchParams;
        idsRaw        = p.get("ids")         ?? undefined;
        excludeIdsRaw = p.get("exclude_ids") ?? undefined;
      }

      const vars = buildAniListVars(p, idsRaw, excludeIdsRaw);
      return jsonResponse(await fetchAniListAnime(vars));
    } catch (e) {
      return jsonResponse({ error: String(e) }, 500);
    }
  }

  // ── /api/mal ─────────────────────────────────────────────────────────────
  if (url.pathname === "/api/mal") {
    try {
      const p    = url.searchParams;
      const gList = [
        ...(p.get("genres")?.split(",") ?? []),
        ...(p.get("tags_in")?.split(",") ?? [])
      ].filter(Boolean);
      
      const exList = [
        ...(p.get("genres_exclude")?.split(",") ?? []),
        ...(p.get("tags_ex")?.split(",") ?? []),
        "Erotica", "Hentai"
      ].filter(Boolean);

      const gIds = gList.map(g => GENRE_MAP[g]).filter(Boolean).join(",");
      const exIds = exList.map(g => GENRE_MAP[g]).filter(Boolean).join(",");

      const sortRaw  = p.get("sort") ?? "score_desc";
      const orderMap: Record<string, { order_by: string; sort: string }> = {
        score_asc:  { order_by: "score",      sort: "asc"  },
        score_desc: { order_by: "score",      sort: "desc" },
        date_asc:   { order_by: "start_date", sort: "asc"  },
        date_desc:  { order_by: "start_date", sort: "desc" },
        popularity_asc:  { order_by: "members", sort: "asc"  },
        popularity_desc: { order_by: "members", sort: "desc" },
      };
      const { order_by, sort } = orderMap[sortRaw] ?? { order_by: "score", sort: "desc" };

      return jsonResponse(await fetchMALAnime({
        q:              p.get("q")      ?? undefined,
        type:           p.get("type")   ?? undefined,
        status:         p.get("status") ?? undefined,
        years:          p.get("years")  ?? undefined,
        genres:         gIds  || undefined,
        genres_exclude: exIds || undefined,
        order_by, sort,
        page:  parseInt(p.get("page")  ?? "1"),
        limit: parseInt(p.get("limit") ?? "24"),
        min_score: p.get("min_score") ? parseFloat(p.get("min_score") as string) : undefined,
      }));
    } catch (e) {
      return jsonResponse({ error: String(e) }, 500);
    }
  }

  // ── /api/import-mal ───────────────────────────────────────────────────────
  if (url.pathname === "/api/import-mal") {
    try {
      const username = url.searchParams.get("username");
      if (!username) return jsonResponse({ error: "Username required" }, 400);

      const all: unknown[] = [];
      let offset = 0;

      while (true) {
        const res = await fetch(
          `https://myanimelist.net/animelist/${username}/load.json?offset=${offset}&status=7`,
          { headers: { "User-Agent": "Mozilla/5.0" } },
        );
        if (!res.ok) throw new Error(`MAL responded with ${res.status}. Profile may be private.`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;
        all.push(...data);
        offset += 300;
        if (offset >= 10000) break;
      }

      return jsonResponse(all);
    } catch (e) {
      return jsonResponse({ error: String(e) }, 500);
    }
  }

  // ── /api/recommendations/mal/:id ─────────────────────────────────────────
  const recMatch = url.pathname.match(/^\/api\/recommendations\/mal\/(\d+)$/);
  if (recMatch) {
    try {
      const malId = recMatch[1];
      const res   = await fetch(`https://api.jikan.moe/v4/anime/${malId}/recommendations`);
      if (!res.ok) throw new Error(`Jikan recs ${res.status}`);
      const data  = await res.json();
      return jsonResponse(data);
    } catch (e) {
      return jsonResponse({ error: String(e) }, 500);
    }
  }

  // ── /api/genres ───────────────────────────────────────────────────────────
  if (url.pathname === "/api/genres") {
    return jsonResponse({ genres: Object.keys(GENRE_MAP) });
  }

  // ── /api/tags ─────────────────────────────────────────────────────────────
  // Returns all AniList tags grouped by category, sorted as AniList does.
  if (url.pathname === "/api/tags") {
    try {
      const query = `
        query {
          MediaTagCollection {
            name
            category
            isAdult
            isGeneralSpoiler
            description
          }
        }`;
      const res  = await fetch("https://graphql.anilist.co", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`AniList tags ${res.status}`);
      const data = await res.json();
      const tags = (data?.data?.MediaTagCollection ?? [])
        .filter((t: { isAdult: boolean }) => !t.isAdult);
      return jsonResponse({ tags });
    } catch (e) {
      return jsonResponse({ error: String(e) }, 500);
    }
  }

  // ── Static files ──────────────────────────────────────────────────────────
  const staticRes = await serveStatic(url.pathname);
  if (staticRes) return staticRes;

  try {
    const data = await Deno.readFile(`${ROOT}/public/404.html`);
    return new Response(data, {
      status: 404,
      headers: { "Content-Type": "text/html", ...corsHeaders() },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

console.log(`🎌 Anime Browser (MVC) → http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handler);

