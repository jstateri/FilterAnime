/**
 * @fileoverview stats/controller.js - Stats Controller Layer
 * 
 * Orchestrates the user's statistics page. Connects the application state to the stats model
 * for data crunching, and then passes the computed analytics to the stats view layer for rendering.
 */
import { myAnimeList, getSavedUsername,
         getEnrichedCache, setEnrichedCache, clearEnrichedCache } from '../state.js';
import { enrichWithAniList, fetchAniListById, fetchAniListRecommendations } from '../api.js';

import {
  computeHeroStats, computeStatusCounts, computeEpisodesByStatus,
  computeScoreDistribution, computeGenreCounts, computeGenreAvgScores,
  computeDecadeCounts, computeFormatCounts, computeScoreEpisodeData,
  computeTopRated, computeTopByEpisodes, computeTopGlobal,
  computeCompletionRings, computeScoringHabits, computeCompletionByStatus,
  computeHotTakes, computeObscure
} from './model.js';

import {
  applyChartDefaults,
  showLoading, hideLoading, showEmpty, showContent,
  showEnrichProgress, hideEnrichProgress,
  renderUsernameBadge, renderHeroCards,
  renderStatusChart, renderScoreBars, renderEpisodesByStatusChart,
  renderGenreBars, renderGenreRadar, renderGenreScoreChart,
  renderDecadeChart, renderFormatChart, renderScoreEpisodeChart,
  renderTopList, renderCompletionRings, renderScoringHabits, renderCompletionChart,
  renderHotTakes, renderObscure
} from './view.js';

import { 
  renderAniListModal, injectRecsPlaceholder, 
  renderRelations, renderRecommendations 
} from '../view.js';

let detailModal;
let modalHistory = [];
let currentModalState = null;

function updateModalBackButton() {
  const btn = document.getElementById('modalBackBtn');
  if (!btn) return;
  if (modalHistory.length > 0) {
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

// ── Entry point ────────────────────────────────────────────────────────────
export async function init() {
  applyChartDefaults();
  renderUsernameBadge(getSavedUsername());
  detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
  document.getElementById('modalBackBtn')?.addEventListener('click', () => {
    if (modalHistory.length > 0) {
      const prevState = modalHistory.pop();
      currentModalState = prevState;
      updateModalBackButton();
      renderAniListModal(prevState.a, prevState.local, detailModal);
      if (prevState.a.id || prevState.a.alId) {
        _fetchExtendedData(prevState.a.id || prevState.a.alId, prevState.local);
      }
    }
  });

  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await clearEnrichedCache();
    window.location.reload();
  });

  window.addEventListener('myAnimeListUpdated', async () => {
    // Automatically clear cache and reload if the list changed in another tab
    await clearEnrichedCache();
    window.location.reload();
  });

  const list = myAnimeList;
  if (!list || list.length === 0) {
    hideLoading();
    showEmpty();
    return;
  }

  // Check cache (now async)
  const cached = await getEnrichedCache();
  if (cached && cached.length > 0) {
    hideLoading();
    showContent();
    _buildAllStats(cached);
    return;
  }

  let enriched = await _runEnrichment(myAnimeList);
  await setEnrichedCache(enriched);

  hideLoading();
  showContent();
  _buildAllStats(enriched);
}

// ── Enrich pipeline ────────────────────────────────────────────────────────
async function _runEnrichment(list) {
  const malIds = list.map(a => parseInt(a.id)).filter(n => !isNaN(n));

  const enrichMap = await enrichWithAniList(malIds, (done, total) => {
    showEnrichProgress(done, total);
  });

  hideEnrichProgress();

  return list.map(a => {
    const al = enrichMap[parseInt(a.id)] || {};
    return {
      ...a,
      alId:        al.id                  || null,
      title:       al.title?.english || al.title?.romaji || a.title || 'Unknown',
      description: al.description         || '',
      bannerImage: al.bannerImage         || '',
      genres:      al.genres              || [],
      format:      al.format              || '',
      globalScore: al.averageScore        || 0,
      popularity:  al.popularity          || 0,
      coverImage:  al.coverImage?.large   || al.coverImage?.medium || '',
      startYear:   al.startDate?.year     || null,
      episodes:    al.episodes            || parseInt(a.episodes)  || 0,
    };
  });
}

// ── Build all stats ────────────────────────────────────────────────────────
function _buildAllStats(list) {
  renderHeroCards(computeHeroStats(list));
  renderStatusChart(computeStatusCounts(list));
  renderScoreBars(computeScoreDistribution(list));
  renderEpisodesByStatusChart(computeEpisodesByStatus(list));

  const sortedGenres = computeGenreCounts(list);
  renderGenreBars(sortedGenres, list.length);
  renderGenreRadar(sortedGenres);
  renderGenreScoreChart(computeGenreAvgScores(list));

  renderDecadeChart(computeDecadeCounts(list));
  renderFormatChart(computeFormatCounts(list));
  renderScoreEpisodeChart(computeScoreEpisodeData(list));

  // Note: We are passing our click handler into the top list renders
  renderTopList('topRated',    computeTopRated(list),       a => `${a.my_score}/10`, a => _onAnimeClick(a, true));
  renderTopList('topEpisodes', computeTopByEpisodes(list),  a => `${parseInt(a.watched) || 0} ep`, a => _onAnimeClick(a, true));
  renderTopList('topGlobal',   computeTopGlobal(list),      a => `${(a.globalScore / 10).toFixed(1)}/10`, a => _onAnimeClick(a, true));

  renderHotTakes(computeHotTakes(list), a => _onAnimeClick(a, true));
  renderObscure(computeObscure(list), a => _onAnimeClick(a, true));

  renderCompletionRings(computeCompletionRings(list));
  renderScoringHabits(computeScoringHabits(list));
  renderCompletionChart(computeCompletionByStatus(list));
}

// ── Modal interaction (List Items) ─────────────────────────────────────────
async function _onAnimeClick(anime, fromGrid = false) {
  if (!fromGrid && currentModalState) {
    modalHistory.push(currentModalState);
  } else if (fromGrid) {
    modalHistory = [];
  }

  // 1. Instantly show the modal with the cached partial data
  const partialData = {
    id: anime.alId,
    idMal: parseInt(anime.id),
    title: { english: anime.title },
    coverImage: { large: anime.coverImage },
    bannerImage: anime.bannerImage,
    format: anime.format,
    genres: anime.genres,
    averageScore: anime.globalScore,
    episodes: anime.episodes,
    startDate: { year: anime.startYear },
    description: anime.description
  };

  const localData = {
    watched: anime.watched,
    my_status: anime.my_status
  };

  currentModalState = { a: partialData, local: localData };
  updateModalBackButton();

  renderAniListModal(partialData, localData, detailModal);

  if (!anime.alId) return;

  _fetchExtendedData(anime.alId, localData);
}

// ── Modal interaction (Recommendations/Relations) ──────────────────────────
async function _onRelatedClick(alMedia) {
  if (currentModalState) {
    modalHistory.push(currentModalState);
  }

  // Check if this related anime exists in our personal list to show our local status
  const localMatch = myAnimeList.find(a => parseInt(a.id) === alMedia.idMal);
  const localData = localMatch ? { watched: localMatch.watched, my_status: localMatch.my_status } : null;

  currentModalState = { a: alMedia, local: localData };
  updateModalBackButton();

  renderAniListModal(alMedia, localData, detailModal);

  if (!alMedia.id) return;
  _fetchExtendedData(alMedia.id, localData);
}

async function _fetchExtendedData(id, localData) {
  try {
    injectRecsPlaceholder();

    const [fullAl, { recommendations, relations }] = await Promise.all([
      fetchAniListById(id),
      fetchAniListRecommendations(id)
    ]);

    // Update modal body natively if it is still open, linking to the related handler
    if (document.getElementById('detailModal')?.classList.contains('show')) {
      if (currentModalState && (currentModalState.a.id === id || currentModalState.a.alId === id)) {
        currentModalState.a = fullAl;
      }
      renderAniListModal(fullAl, localData, detailModal);
      injectRecsPlaceholder(); 
      renderRelations(relations, _onRelatedClick);
      renderRecommendations(recommendations, _onRelatedClick);
    }
  } catch (e) {
    console.warn("Failed to fetch extended modal data:", e);
  }
}

