// ── state.js ──────────────────────────────────────────────────────────────
// Single source of truth for all app state.
// Keeps localStorage in sync automatically via the `set()` helper.

export const state = {
  // Data source
  source:     'mylist',    // 'anilist' | 'mal' | 'mylist'

  // Filter params
  q:          '',
  type:       '',
  genresIn:   [],          // genres to include
  genresEx:   [],          // genres to exclude
  tagsIn:     [],          // tags to include
  tagsEx:     [],          // tags to exclude
  tagMinPct:  0,           // minimum tag rank % (0 = no filter)
  years:      [],
  status:     '',
  sort:       'score_desc',

  // Pagination
  page:       1,
  perPage:    24,
  total:      0,
  lastPage:   1,

  // UI toggle
  hideMyList: false,
};

// ── User anime list (persisted) ────────────────────────────────────────────
export let myAnimeList = JSON.parse(localStorage.getItem('myAnimeList') || '[]');

export function setMyAnimeList(list) {
  myAnimeList = list;
  try {
    localStorage.setItem('myAnimeList', JSON.stringify(list));
  } catch (e) {
    console.warn('localStorage full, could not persist list:', e);
  }
}

export function clearMyAnimeList() {
  myAnimeList = [];
  localStorage.removeItem('myAnimeList');
}

// ── Username ───────────────────────────────────────────────────────────────
export function getSavedUsername() {
  return localStorage.getItem('malUsername') || '';
}

export function setSavedUsername(username) {
  localStorage.setItem('malUsername', username);
}

// ── Enriched cache (stats page) ────────────────────────────────────────────
export const ENRICH_KEY = 'animeEnrichedData';

export function getEnrichedCache() {
  try {
    return JSON.parse(localStorage.getItem(ENRICH_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setEnrichedCache(data) {
  try {
    localStorage.setItem(ENRICH_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage full, enriched cache not saved:', e);
  }
}

export function clearEnrichedCache() {
  localStorage.removeItem(ENRICH_KEY);
}

