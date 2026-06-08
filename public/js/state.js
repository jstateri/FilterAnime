/**
 * @fileoverview state.js - Application State Management
 * 
 * This module acts as the single source of truth for the entire frontend application.
 * By keeping all state (filters, pagination, data source, imported lists) in one centralized object,
 * the controller can easily read current parameter selections and dispatch them to the API layer,
 * and the view can accurately reflect the active UI selections without relying on reading the DOM.
 */
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
  yearMin:    1970,
  yearMax:    2027,
  yearActive: false,
  status:     '',
  sort:       'score_desc',
  minScore:   0,

  // Pagination
  page:       1,
  perPage:    24,
  total:      0,
  lastPage:   1,

  // UI toggle
  hideMyList: false,
  viewMode:   localStorage.getItem('viewMode') || 'grid',
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
  clearEnrichedCache();
}

// ── Username ───────────────────────────────────────────────────────────────
export function getSavedUsername() {
  return localStorage.getItem('malUsername') || '';
}

export function setSavedUsername(username) {
  localStorage.setItem('malUsername', username);
}

// ── Enriched cache (stats page) via IndexedDB ──────────────────────────────
export const ENRICH_KEY = 'animeEnrichedData';
const DB_NAME = 'AnimeBrowserDB';
const STORE_NAME = 'cacheStore';

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getEnrichedCache() {
  try {
    const db = await openIDB();
    const data = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(ENRICH_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (data) return data;

    // Auto-migrate old localStorage data into IndexedDB
    const localDataRaw = localStorage.getItem(ENRICH_KEY);
    if (localDataRaw) {
      try {
        const localData = JSON.parse(localDataRaw);
        await setEnrichedCache(localData);
        localStorage.removeItem(ENRICH_KEY);
        return localData;
      } catch (err) {
        console.warn('Failed to parse old localStorage data during migration', err);
      }
    }

    return null;
  } catch (e) {
    console.warn('IndexedDB read failed, falling back to localStorage:', e);
    try {
      return JSON.parse(localStorage.getItem(ENRICH_KEY) || 'null');
    } catch {
      return null;
    }
  }
}

export async function setEnrichedCache(data) {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, ENRICH_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB write failed, falling back to localStorage:', e);
    try {
      localStorage.setItem(ENRICH_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('localStorage also full, enriched cache not saved:', err);
    }
  }
}

export async function clearEnrichedCache() {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(ENRICH_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('IndexedDB delete failed, clearing localStorage fallback:', e);
  }
  localStorage.removeItem(ENRICH_KEY);
}

// ── Tab Synchronization ────────────────────────────────────────────────────
window.addEventListener('storage', (event) => {
  if (event.key === 'myAnimeList') {
    myAnimeList = JSON.parse(event.newValue || '[]');
    window.dispatchEvent(new CustomEvent('myAnimeListUpdated'));
  } else if (event.key === 'malUsername') {
    window.dispatchEvent(new CustomEvent('malUsernameUpdated'));
  }
});

