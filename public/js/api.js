/**
 * @fileoverview api.js - Model Layer (API Communications)
 * 
 * Handles all network requests to the Deno backend (which proxies Jikan and AniList).
 * This layer is strictly responsible for data fetching, shaping, and normalization.
 * It does not access the DOM or rely on the UI.
 */
import { API_BASE } from './config.js';

// ── Browse: AniList ────────────────────────────────────────────────────────
/**
 * Fetches anime from AniList (via the backend proxy).
 * 
 * @param {Object} paramsObj - Frontend state parameters (e.g. year, genre, sort).
 * @param {string|null} ids - Comma-separated MAL IDs to explicitly include.
 * @param {string|null} excludeIds - Comma-separated MAL IDs to explicitly exclude.
 * @returns {Promise<{items: Array, total: number, lastPage: number}>} Normalized pagination and data payload.
 */
export async function fetchAniList(paramsObj, ids = null, excludeIds = null) {
  const pString = new URLSearchParams(paramsObj).toString();

  const body = { params: pString };
  if (ids)        body.ids         = ids;
  if (excludeIds) body.exclude_ids = excludeIds;

  const res = await fetch(`${API_BASE}/api/anilist`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await res.json();
  const page = data?.data?.Page;
  if (!page) throw new Error(data?.errors?.[0]?.message || JSON.stringify(data));

  return {
    items:    page.media        ?? [],
    total:    page.pageInfo?.total    ?? 0,
    lastPage: page.pageInfo?.lastPage ?? 1,
  };
}


// ── Fetch single anime by AniList ID ──────────────────────────────────────
// Used when opening a relation/recommendation modal to guarantee all fields
// are present — identical to what the main browse query returns.
export async function fetchAniListById(anilistId) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME, isAdult: false) {
        id idMal
        title { romaji english native }
        coverImage { large medium color }
        bannerImage
        format status episodes duration
        genres averageScore popularity
        startDate { year month day }
        endDate   { year month day }
        season seasonYear
        studios(isMain: true) { nodes { name } }
        tags { name rank isMediaSpoiler isGeneralSpoiler category }
        description(asHtml: false)
        siteUrl
        externalLinks { site url }
      }
    }`;

  const res = await fetch('https://graphql.anilist.co', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query, variables: { id: anilistId } }),
  });
  if (!res.ok) throw new Error(`AniList fetch ${res.status}`);
  const data = await res.json();
  const media = data?.data?.Media;
  if (!media) throw new Error('Media not found');
  return media;
}

// ── Browse: MyAnimeList (Jikan) ───────────────────────────────────────────
export async function fetchMAL(paramsObj) {
  const pString = new URLSearchParams(paramsObj).toString();
  const res  = await fetch(`${API_BASE}/api/mal?${pString}`);
  const data = await res.json();

  return {
    items:    data?.data                          ?? [],
    total:    data?.pagination?.items?.total      ?? 0,
    lastPage: data?.pagination?.last_visible_page ?? 1,
  };
}

// ── Import: MAL list by username ──────────────────────────────────────────
export async function importMALByUsername(username) {
  const res  = await fetch(`${API_BASE}/api/import-mal?username=${encodeURIComponent(username)}`);
  const data = await res.json();

  if (data.error || !Array.isArray(data)) {
    throw new Error(data.error || 'Failed to fetch list. The profile might be private.');
  }
  return data;
}

// ── Enrich: batch-fetch AniList data for a list of MAL IDs ───────────────
export async function enrichWithAniList(malIds, onProgress) {
  const CHUNK   = 50;
  const enrichMap = {};

  for (let i = 0; i < malIds.length; i += CHUNK) {
    const chunk = malIds.slice(i, i + CHUNK);

    try {
      const res = await fetch(`${API_BASE}/api/anilist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ params: 'page=1&limit=50', ids: chunk.join(',') }),
      });
      const data = await res.json();
      const media = data?.data?.Page?.media ?? [];
      media.forEach(m => { if (m.idMal) enrichMap[m.idMal] = m; });
    } catch (e) {
      console.warn('Enrich chunk failed:', e);
    }

    onProgress?.(Math.min(i + CHUNK, malIds.length), malIds.length);
    await new Promise(r => setTimeout(r, 80)); // rate-limit buffer
  }

  return enrichMap;
}

// ── Helpers ───────────────────────────────────────────────────────────────
export function parseMalStatus(statusInt) {
  switch (statusInt) {
    case 1:  return 'Watching';
    case 2:  return 'Completed';
    case 3:  return 'On-Hold';
    case 4:  return 'Dropped';
    case 6:  return 'Plan to Watch';
    default: return 'Unknown';
  }
}

/**
 * Normalizes raw anime payload from the MyAnimeList user list API.
 * Maps keys to a standardized internal format so the UI components can render
 * items consistently regardless of the source.
 * 
 * @param {Object} item - Raw JSON object from the MAL API.
 * @returns {Object} A standardized anime metadata object.
 */
export function normalizeMalApiItem(item) {
  return {
    id:        String(item.anime_id),
    title:     item.anime_title,
    type:      item.anime_media_type_string || '',
    episodes:  String(item.anime_num_episodes),
    watched:   String(item.num_watched_episodes),
    my_score:  item.score,
    my_status: parseMalStatus(item.status),
    image:     item.anime_image_path
                 ? item.anime_image_path.replace(/\/r\/\d+x\d+\//, '/')
                 : '',
  };
}

export function normalizeXmlItem(node) {
  return {
    id:        node.querySelector('series_animedb_id')?.textContent || '',
    title:     node.querySelector('series_title')?.textContent      || 'Unknown',
    type:      node.querySelector('series_type')?.textContent       || '',
    episodes:  node.querySelector('series_episodes')?.textContent   || '0',
    watched:   node.querySelector('my_watched_episodes')?.textContent || '0',
    my_score:  parseInt(node.querySelector('my_score')?.textContent || '0'),
    my_status: node.querySelector('my_status')?.textContent         || '',
    image:     node.querySelector('series_image')?.textContent      || '',
  };
}

// ── Recommendations: AniList ───────────────────────────────────────────────
// Fetches AniList recommendations AND prequel/sequel relations in one call.
// Returns { recommendations: [...], relations: { prequel, sequel, other[] } }
export async function fetchAniListRecommendations(anilistId) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME, isAdult: false) {
        relations {
          edges {
            relationType(version: 2)
            node {
              id idMal
              title { romaji english native }
              coverImage { large medium }
              bannerImage
              format
              averageScore
              startDate { year }
              episodes
              status
              siteUrl
              genres
              description(asHtml: false)
              studios(isMain: true) { nodes { name } }
              tags { name rank isMediaSpoiler isGeneralSpoiler category }
            }
          }
        }
        recommendations(perPage: 12, sort: RATING_DESC) {
          nodes {
            rating
            mediaRecommendation {
              id idMal
              title { romaji english native }
              coverImage { large medium }
              bannerImage
              format
              averageScore
              genres
              startDate { year }
              episodes
              status
              siteUrl
              description(asHtml: false)
              studios(isMain: true) { nodes { name } }
              tags { name rank isMediaSpoiler isGeneralSpoiler category }
            }
          }
        }
      }
    }`;

  const res = await fetch('https://graphql.anilist.co', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query, variables: { id: anilistId } }),
  });
  if (!res.ok) throw new Error(`AniList recs ${res.status}`);
  const data = await res.json();
  const media = data?.data?.Media;

  // Parse relations — separate prequel/sequel from side stories/other
  const relationEdges = media?.relations?.edges ?? [];
  const relations = {
    prequel: null,
    sequel:  null,
    other:   [],
  };

  const RELATION_LABELS = {
    PREQUEL:         'Prequel',
    SEQUEL:          'Sequel',
    PARENT:          'Parent',
    SIDE_STORY:      'Side Story',
    SPIN_OFF:        'Spin-off',
    ALTERNATIVE:     'Alternative',
    SUMMARY:         'Summary',
    CHARACTER:       'Character',
    COMPILATION:     'Compilation',
    CONTAINS:        'Contains',
  };

  // Formats that are NOT anime — always exclude from the Series section
  const NON_ANIME_FORMATS = new Set([
    'MANGA', 'NOVEL', 'ONE_SHOT', 'MANHWA', 'MANHUA',
    'DOUJIN', 'LIGHT_NOVEL',
  ]);

  relationEdges.forEach(edge => {
    if (!edge.node) return;
    // Skip anything that isn't an anime format
    if (NON_ANIME_FORMATS.has(edge.node.format)) return;
    const type  = edge.relationType;
    const entry = { ...edge.node, relationType: type, relationLabel: RELATION_LABELS[type] || type };
    if (type === 'PREQUEL') relations.prequel = entry;
    else if (type === 'SEQUEL') relations.sequel = entry;
    else relations.other.push(entry);
  });

  const recommendations = (media?.recommendations?.nodes ?? [])
    .filter(n => n.mediaRecommendation)
    .map(n => {
      const rec = n.mediaRecommendation;
      rec.recommendationRating = n.rating;
      return rec;
    });

  return { recommendations, relations };
}

// ── Recommendations: Jikan (MAL) ──────────────────────────────────────────
// Fetches MAL's recommendations via our Deno proxy (avoids CORS).
export async function fetchMALRecommendations(malId) {
  const res = await fetch(
    `${API_BASE}/api/recommendations/mal/${malId}`
  );
  if (!res.ok) throw new Error(`Jikan recs ${res.status}`);
  const data = await res.json();

  return (data?.data ?? []).slice(0, 12).map(r => ({
    id:           r.entry?.mal_id,
    title:        r.entry?.title || 'Unknown',
    coverImage:   r.entry?.images?.jpg?.large_image_url || r.entry?.images?.jpg?.image_url || '',
    votes:        r.votes ?? 0,
    url:          r.entry?.url || '',
  }));
}

// ── Fetch all AniList tags ────────────────────────────────────────────────
// Returns tags grouped by category in the same order AniList uses.
export async function fetchAniListTags() {
  const res  = await fetch(`${API_BASE}/api/tags`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  // Group by category, preserving AniList's order within each group
  const grouped = {};
  for (const tag of (data.tags ?? [])) {
    const cat = tag.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(tag);
  }

  // Sort categories alphabetically (matches AniList's UI order)
  const sorted = {};
  Object.keys(grouped).sort().forEach(cat => {
    sorted[cat] = grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
  });

  return sorted; // { "Cast – Protagonist": [...], "Setting – Universe": [...], ... }
}

