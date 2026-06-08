/**
 * @fileoverview recs/controller.js - Recommendations Controller Layer
 * 
 * Orchestrates the recommendation engine logic, handles UI toggles, and manages the modal.
 */

import { myAnimeList, getSavedUsername } from '../state.js';
import { computeRecommendations } from './model.js';
import { showLoading, hideLoading, bindExcludeToggle, renderRecCards, dom, showEmpty } from './view.js';
import { renderAniListModal, injectRecsPlaceholder, renderRelations, renderRecommendations } from '../view.js';
import { fetchAniListById, fetchAniListRecommendations } from '../api.js';

import { AL_GENRES, YEARS } from '../config.js';
import { renderGenreMenu, updateYearSlider } from '../view.js';

let allRecommendations = [];
let excludeMyList = true;
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

// Filter state
let activeGenresIn = [];
let activeGenresEx = [];
let genreSearchTerm = '';
let minYear = 1970;
let maxYear = 2027;
let yearActive = false;

export async function init() {
  const user = getSavedUsername();
  const usernameBadge = document.getElementById('usernameBadge');
  if (usernameBadge && user) usernameBadge.textContent = `@${user}`;

  detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
  document.getElementById('modalBackBtn')?.addEventListener('click', () => {
    if (modalHistory.length > 0) {
      const prevState = modalHistory.pop();
      currentModalState = prevState;
      updateModalBackButton();
      renderAniListModal(prevState.a, prevState.local, detailModal);
      if (prevState.a.id) _fetchExtendedData(prevState.a.id, prevState.local);
    }
  });

  bindExcludeToggle((checked) => {
    excludeMyList = checked;
    _applyFilters();
  });

  _initFilters();

  if (!myAnimeList || myAnimeList.length === 0) {
    showEmpty();
    return;
  }

  showLoading();
  
  // 1. Fetch and aggregate
  allRecommendations = await computeRecommendations(myAnimeList);
  
  hideLoading();

  // 2. Initial Render
  _applyFilters();
}

function _initFilters() {
  // Bind genre search
  dom.genreSearch()?.addEventListener('input', (e) => {
    genreSearchTerm = e.target.value.toLowerCase();
    renderGenreMenu(activeGenresIn, activeGenresEx, genreSearchTerm, AL_GENRES);
  });

  // Bind genre toggle
  dom.genreMenu()?.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-genre]');
    if (!li) return;
    e.stopPropagation();
    
    const g = li.dataset.genre;
    if (activeGenresIn.includes(g)) {
      activeGenresIn = activeGenresIn.filter(x => x !== g);
      activeGenresEx.push(g);
    } else if (activeGenresEx.includes(g)) {
      activeGenresEx = activeGenresEx.filter(x => x !== g);
    } else {
      activeGenresIn.push(g);
    }
    
    renderGenreMenu(activeGenresIn, activeGenresEx, genreSearchTerm, AL_GENRES);
    _updateGenreCount();
    _applyFilters();
  });

  renderGenreMenu(activeGenresIn, activeGenresEx, '', AL_GENRES);

  // Bind Year slider
  const updateYear = () => {
    const minSlider = dom.yearMinSlider();
    const maxSlider = dom.yearMaxSlider();
    if (!minSlider || !maxSlider) return;

    let minVal = parseInt(minSlider.value);
    let maxVal = parseInt(maxSlider.value);

    if (minVal > maxVal) {
      if (document.activeElement === minSlider) {
        minVal = maxVal;
        minSlider.value = maxVal;
      } else {
        maxVal = minVal;
        maxSlider.value = minVal;
      }
    }

    minYear = minVal;
    maxYear = maxVal;
    yearActive = (minYear > 1970 || maxYear < 2027);

    updateYearSlider(minYear, maxYear, 1970, 2027, yearActive);
    bootstrap.Dropdown.getInstance(document.getElementById('yearToggle'))?.update();
    _applyFilters();
  };

  const handleYearDisplayInput = (e) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) return;
    if (val < 1970) val = 1970;
    if (val > 2027) val = 2027;

    const minSlider = dom.yearMinSlider();
    const maxSlider = dom.yearMaxSlider();
    if (e.target.id === 'yearDisplayMin') {
      if (maxSlider && val > parseInt(maxSlider.value)) val = parseInt(maxSlider.value);
      if (minSlider) minSlider.value = val;
    } else {
      if (minSlider && val < parseInt(minSlider.value)) val = parseInt(minSlider.value);
      if (maxSlider) maxSlider.value = val;
    }
    
    e.target.value = val;
    updateYear();
  };

  dom.yearDisplayMin()?.addEventListener('change', handleYearDisplayInput);
  dom.yearDisplayMax()?.addEventListener('change', handleYearDisplayInput);

  dom.yearMinSlider()?.addEventListener('input', updateYear);
  dom.yearMaxSlider()?.addEventListener('input', updateYear);
  updateYearSlider(minYear, maxYear, 1970, 2027, false);
}

function _updateGenreCount() {
  const countSpan = dom.genreCount();
  if (!countSpan) return;
  const count = activeGenresIn.length + activeGenresEx.length;
  countSpan.textContent = count > 0 ? `(${count})` : '';
}

function _applyFilters() {
  let filtered = allRecommendations;

  // 1. My List Exclusion Rule
  const myMalMap = new Map();
  myAnimeList.forEach(a => {
    const id = parseInt(a.id);
    if (!isNaN(id)) myMalMap.set(id, a.my_status);
  });

  filtered = filtered.filter(entry => {
    if (!entry.anime.idMal) return true; 
    
    const status = myMalMap.get(entry.anime.idMal);
    
    // If it's not in the user's list at all, allow it.
    if (!status) return true;

    // If it is in the list, the user doesn't want it if toggle is ON
    if (excludeMyList) return false;
    
    // Even if toggle is OFF, ONLY allow 'Plan to Watch'
    if (status === 'Plan to Watch') return true;
    
    // Completely exclude 'Completed', 'Watching', 'Dropped', 'On-Hold'
    return false;
  });

  // 2. Genre Filter
  if (activeGenresIn.length > 0 || activeGenresEx.length > 0) {
    filtered = filtered.filter(entry => {
      const g = entry.anime.genres || [];
      if (activeGenresIn.length > 0 && !activeGenresIn.every(req => g.includes(req))) return false;
      if (activeGenresEx.length > 0 && activeGenresEx.some(exc => g.includes(exc))) return false;
      return true;
    });
  }

  // 3. Year Filter
  if (yearActive) {
    filtered = filtered.filter(entry => {
      const y = entry.anime.startDate?.year;
      if (!y) return false; // Exclude anime without a year if filter is active
      return y >= minYear && y <= maxYear;
    });
  }

  renderRecCards(filtered, (anime) => {
    modalHistory = [];
    currentModalState = { a: anime };
    updateModalBackButton();
    _onCardClick(anime, true);
  });
}

async function _onCardClick(anime, fromGrid = false) {
  if (!fromGrid && currentModalState) {
    modalHistory.push(currentModalState);
  }
  
  const localMatch = myAnimeList.find(a => parseInt(a.id) === anime.idMal);
  const localData = localMatch ? { watched: localMatch.watched, my_status: localMatch.my_status } : null;

  const partialData = {
    ...anime,
    title: { english: anime.title?.english || anime.title?.romaji },
    startDate: anime.startDate,
  };
  currentModalState = { a: partialData, local: localData };
  updateModalBackButton();

  renderAniListModal(partialData, localData, detailModal);

  if (!anime.id) return;
  _fetchExtendedData(anime.id, localData);
}

async function _fetchExtendedData(id, localData) {
  try {
    injectRecsPlaceholder();

    const [fullAl, { recommendations, relations }] = await Promise.all([
      fetchAniListById(id),
      fetchAniListRecommendations(id)
    ]);

    if (document.getElementById('detailModal')?.classList.contains('show')) {
      if (currentModalState && currentModalState.a.id === id) {
        currentModalState.a = fullAl;
      }
      renderAniListModal(fullAl, localData, detailModal);
      injectRecsPlaceholder(); 
      renderRelations(relations, a => _onCardClick(a, false));
      renderRecommendations(recommendations, a => _onCardClick(a, false));
    }
  } catch (e) {
    console.warn("Failed to fetch extended modal data:", e);
  }
}
