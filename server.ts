// ── server.ts ─────────────────────────────────────────────────────────────
// Deno backend for Anime Browser (MVC edition).
// Serves static files from ./public/ and proxies AniList + Jikan APIs.
//
// Run:  deno run --allow-net --allow-read --watch server.ts

const PORT = parseInt(Deno.env.get("PORT") || "8000"); //deployement
//const PORT = 8000; //local

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
async function fetchMALAnime(params: {
  q?: string; type?: string; genres?: string; genres_exclude?: string;
  status?: string; years?: string; order_by?: string; sort?: string;
  page?: number; limit?: number;
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
  "Action":1,"Adventure":2,"Avant Garde":5,"Boys Love":28,"Comedy":4,
  "Demons":6,"Drama":8,"Ecchi":9,"Fantasy":10,"Girls Love":26,"Gourmet":47,
  "Harem":35,"Horror":14,"Isekai":62,"Iyashikei":63,"Josei":43,"Kids":15,
  "Magic":16,"Mahou Shoujo":64,"Martial Arts":17,"Mecha":18,"Military":38,
  "Music":19,"Mystery":7,"Parody":20,"Psychological":40,"Reincarnation":73,
  "Reverse Harem":56,"Romance":22,"School":23,"Sci-Fi":24,"Seinen":42,
  "Shoujo":25,"Shounen":27,"Slice of Life":36,"Space":29,"Sports":30,
  "Super Power":31,"Supernatural":37,"Suspense":41,"Thriller":41,"Vampire":32,
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
           $minimumTagRank:Int) {
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
      const gIds = (p.get("genres")?.split(",").filter(Boolean) ?? [])
        .map(g => GENRE_MAP[g]).filter(Boolean).join(",");
      const exIds = (p.get("genres_exclude")?.split(",").filter(Boolean) ?? [])
        .map(g => GENRE_MAP[g]).filter(Boolean).join(",");

      const sortRaw  = p.get("sort") ?? "score_desc";
      const orderMap: Record<string, { order_by: string; sort: string }> = {
        score_asc:  { order_by: "score",      sort: "asc"  },
        score_desc: { order_by: "score",      sort: "desc" },
        date_asc:   { order_by: "start_date", sort: "asc"  },
        date_desc:  { order_by: "start_date", sort: "desc" },
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

  return new Response("Not found", { status: 404 });
}

console.log(`🎌 Anime Browser (MVC) → http://localhost:${PORT}`);
Deno.serve({ port: PORT }, handler);

