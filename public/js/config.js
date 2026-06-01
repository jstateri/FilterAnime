/**
 * @fileoverview config.js - Application Configuration & Constants
 * 
 * Centralized repository for shared system constants, API endpoint targets,
 * and static domain data (e.g., genre lists, status mappings).
 * By isolating constants here, we avoid magic strings throughout the codebase.
 */

export const API_BASE = '';

// AniList's official genre list (used for AniList + My List sources)
export const AL_GENRES = [
  'Action','Adventure','Comedy','Drama','Ecchi','Fantasy',
  'Horror','Mahou Shoujo','Mecha','Music','Mystery',
  'Psychological','Romance','Sci-Fi','Slice of Life',
  'Sports','Supernatural','Thriller',
];

// MAL/Jikan genre list (used for MyAnimeList source only)
export const MAL_GENRES = [
  'Action','Adventure','Avant Garde','Boys Love','Comedy','Demons','Drama',
  'Ecchi','Fantasy','Girls Love','Gourmet','Harem','Horror','Isekai','Iyashikei',
  'Josei','Kids','Magic','Mahou Shoujo','Martial Arts','Mecha','Military',
  'Music','Mystery','Parody','Psychological','Reincarnation','Reverse Harem','Romance','School',
  'Sci-Fi','Seinen','Shoujo','Shounen','Slice of Life','Space','Sports',
  'Super Power','Supernatural','Suspense','Thriller','Vampire',
];

// Keep a GENRES export as alias so nothing else breaks
export const GENRES = AL_GENRES;

export const YEARS = [
  ...Array.from({ length: 27 }, (_, i) => String(2026 - i)),
  ...Array.from({ length: 10 }, (_, i) => `${1990 - i * 10}s`),
];

export const STATUS_OPTIONS_GLOBAL = [
  { val: '',          label: 'All'           },
  { val: 'airing',    label: 'Airing'        },
  { val: 'complete',  label: 'Completed'     },
  { val: 'upcoming',  label: 'Upcoming'      },
];

export const STATUS_OPTIONS_MYLIST = [
  { val: '',               label: 'All'            },
  { val: 'Completed',      label: 'Completed'      },
  { val: 'Plan to Watch',  label: 'Plan to Watch'  },
  { val: 'Watching',       label: 'Watching'       },
  { val: 'On-Hold',        label: 'On-Hold'        },
  { val: 'Dropped',        label: 'Dropped'        },
];

