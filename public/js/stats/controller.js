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

// ── Entry point ────────────────────────────────────────────────────────────
export async function init() {
  applyChartDefaults();
  renderUsernameBadge(getSavedUsername());
  detailModal = new bootstrap.Modal(document.getElementById('detailModal'));

  document.getElementById('refreshBtn').addEventListener('click', () => {
    clearEnrichedCache();
    location.reload();
  });

  if (!myAnimeList.length) {
    hideLoading();
    showEmpty();
    return;
  }

  let enriched = getEnrichedCache();
  if (!enriched || enriched.length !== myAnimeList.length) {
    enriched = await _runEnrichment(myAnimeList);
    setEnrichedCache(enriched);
  }

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
  renderTopList('topRated',    computeTopRated(list),       a => `${a.my_score}/10`, _onAnimeClick);
  renderTopList('topEpisodes', computeTopByEpisodes(list),  a => `${parseInt(a.watched) || 0} ep`, _onAnimeClick);
  renderTopList('topGlobal',   computeTopGlobal(list),      a => `${(a.globalScore / 10).toFixed(1)}/10`, _onAnimeClick);

  renderHotTakes(computeHotTakes(list), _onAnimeClick);
  renderObscure(computeObscure(list), _onAnimeClick);

  renderCompletionRings(computeCompletionRings(list));
  renderScoringHabits(computeScoringHabits(list));
  renderCompletionChart(computeCompletionByStatus(list));
}

// ── Modal interaction (List Items) ─────────────────────────────────────────
async function _onAnimeClick(anime) {
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

  renderAniListModal(partialData, localData, detailModal);

  if (!anime.alId) return;

  // 2. Silently fetch the tags and relations in the background
  try {
    injectRecsPlaceholder();

    const [fullAl, { recommendations, relations }] = await Promise.all([
      fetchAniListById(anime.alId),
      fetchAniListRecommendations(anime.alId)
    ]);

    // Update modal body natively if it is still open, linking to the related handler
    if (document.getElementById('detailModal')?.classList.contains('show')) {
      renderAniListModal(fullAl, localData, detailModal);
      injectRecsPlaceholder(); 
      renderRelations(relations, _onRelatedClick);
      renderRecommendations(recommendations, _onRelatedClick);
    }
  } catch (e) {
    console.warn("Failed to fetch extended modal data:", e);
  }
}

// ── Modal interaction (Recommendations/Relations) ──────────────────────────
async function _onRelatedClick(alMedia) {
  // Check if this related anime exists in our personal list to show our local status
  const localMatch = myAnimeList.find(a => parseInt(a.id) === alMedia.idMal);
  const localData = localMatch ? { watched: localMatch.watched, my_status: localMatch.my_status } : null;

  renderAniListModal(alMedia, localData, detailModal);

  if (!alMedia.id) return;

  try {
    injectRecsPlaceholder();
    const [fullAl, { recommendations, relations }] = await Promise.all([
      fetchAniListById(alMedia.id),
      fetchAniListRecommendations(alMedia.id)
    ]);

    if (document.getElementById('detailModal')?.classList.contains('show')) {
      renderAniListModal(fullAl, localData, detailModal);
      injectRecsPlaceholder();
      renderRelations(relations, _onRelatedClick);
      renderRecommendations(recommendations, _onRelatedClick);
    }
  } catch (e) {
    console.warn("Failed to fetch related modal data:", e);
  }
}

