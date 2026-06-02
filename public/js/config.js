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

export const MAL_GENRES = [
  "Action","Adventure","Avant Garde","Award Winning","Boys Love","Comedy","Drama","Fantasy",
  "Girls Love","Gourmet","Horror","Mystery","Romance","Sci-Fi","Slice of Life","Sports",
  "Supernatural","Suspense","Ecchi","Josei","Kids","Seinen","Shoujo","Shounen"
];

export const MAL_THEMES = [
  "Adult Cast","Anthropomorphic","CGDCT","Childcare","Combat Sports","Crossdressing",
  "Delinquents","Detective","Educational","Gag Humor","Gore","Harem","High Stakes Game",
  "Historical","Idols (Female)","Idols (Male)","Isekai","Iyashikei","Love Polygon",
  "Magical Sex Shift","Mahou Shoujo","Martial Arts","Mecha","Medical","Military",
  "Music","Mythology","Organized Crime","Otaku Culture","Parody","Performing Arts",
  "Pets","Psychological","Racing","Reincarnation","Reverse Harem","Love Status Quo",
  "Samurai","School","Showbiz","Space","Strategy Game","Super Power","Survival",
  "Team Sports","Time Travel","Vampire","Video Game","Visual Arts","Workplace",
  "Urban Fantasy","Villainess"
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

