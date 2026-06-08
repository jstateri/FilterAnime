import { fetchAiringSchedule, fetchAniListById, fetchAniListRecommendations } from './api.js';
import { renderAniListModal, injectRecsPlaceholder, renderRelations, renderRecommendations } from './view.js';

let scheduleData = [];
let myAnimeListStatuses = new Map();
let detailModal = null;
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

// Ensure bootstrap is available globally since it's loaded as a script in HTML
const bootstrap = window.bootstrap;

export async function initSchedule() {
  detailModal = new bootstrap.Modal(document.getElementById('detailModal'));
  document.getElementById('modalBackBtn')?.addEventListener('click', () => {
    if (modalHistory.length > 0) {
      const prevState = modalHistory.pop();
      currentModalState = prevState;
      updateModalBackButton();
      renderAniListModal(prevState.a, prevState.local, detailModal);
      if (prevState.a.id) _fetchExtendedData(prevState.a.id, prevState.local, prevState.nextAiringOverride);
    }
  });
  
  // Load user's MAL list to cross-reference
  try {
    const rawList = localStorage.getItem('myAnimeList');
    if (rawList) {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => myAnimeListStatuses.set(String(item.id), item.my_status));
      }
    }
  } catch (e) {
    console.error("Failed to parse local list", e);
  }

  document.getElementById('myListOnlyToggle').addEventListener('change', applyFiltersAndRender);

  await loadSchedule();
}

async function loadSchedule() {
  const grid = document.getElementById('scheduleGrid');
  const emptyState = document.getElementById('emptyState');
  
  grid.style.display = 'none';
  emptyState.style.display = 'block';

  // Get current timestamp and timestamp for 7 days later
  const now = new Date();
  
  // Start from midnight today to get the full current day
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
  const endTimestamp = startTimestamp + (7 * 24 * 60 * 60); // 7 days later

  try {
    const data = await fetchAiringSchedule(startTimestamp, endTimestamp);
    scheduleData = data;
    
    applyFiltersAndRender();
  } catch (err) {
    console.error(err);
    emptyState.innerHTML = `<h4 class="mt-3 text-danger">Failed to load schedule</h4><p>${err.message}</p>`;
  }
}

function applyFiltersAndRender() {
  const isMyListOnly = document.getElementById('myListOnlyToggle').checked;
  
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const grouped = {};
  
  const todayIndex = startOfDay.getDay();
  for (let i = 0; i < 7; i++) {
    const dayIndex = (todayIndex + i) % 7;
    grouped[days[dayIndex]] = [];
  }

  scheduleData.forEach(item => {
    if (!item.media || item.media.format === 'MANGA' || item.media.format === 'NOVEL' || item.media.isAdult) return;
    
    const status = myAnimeListStatuses.get(String(item.media.idMal));
    const isTracked = !!status;
    if (isMyListOnly && !isTracked) return;
    
    const date = new Date(item.airingAt * 1000);
    const dayName = days[date.getDay()];
    if (grouped[dayName]) {
      grouped[dayName].push(item);
    }
  });

  renderSchedule(grouped);
}

function renderSchedule(grouped) {
  const grid = document.getElementById('scheduleGrid');
  const emptyState = document.getElementById('emptyState');
  
  grid.innerHTML = '';
  emptyState.style.display = 'none';
  grid.style.display = 'grid';

  Object.entries(grouped).forEach(([dayName, items]) => {
    // Sort items by airing time
    items.sort((a, b) => a.airingAt - b.airingAt);
    
    const dayCol = document.createElement('div');
    dayCol.className = 'day-column';
    
    const isToday = Object.keys(grouped)[0] === dayName;
    
    dayCol.innerHTML = `
      <div class="day-header ${isToday ? 'today' : ''}">
        ${dayName} ${isToday ? '<span class="today-badge">Today</span>' : ''}
      </div>
      <div class="day-content">
        ${items.length === 0 ? '<div class="no-anime">No anime scheduled</div>' : ''}
      </div>
    `;
    
    const content = dayCol.querySelector('.day-content');
    
    items.forEach(item => {
      const status = myAnimeListStatuses.get(String(item.media.idMal));
      const card = createScheduleCard(item, status);
      content.appendChild(card);
    });
    
    grid.appendChild(dayCol);
  });
}

function createScheduleCard(item, status) {
  const media = item.media;
  const title = media.title.english || media.title.romaji || 'Unknown';
  const cover = media.coverImage?.medium || '';
  
  const timeStr = formatTime(item.airingAt);
  const realTimeUntil = item.airingAt - Math.floor(Date.now() / 1000);
  
  let countdownHtml = '';
  if (realTimeUntil > 0) {
    const countdown = formatCountdown(realTimeUntil);
    countdownHtml = `
        <span class="schedule-countdown ${realTimeUntil < 86400 ? 'soon' : ''}">
          <i class="bi bi-clock"></i> ${countdown}
        </span>`;
  }
  
  const isTracked = !!status;
  const statusClass = status ? `status-${status.toLowerCase().replace(/ /g, '-')}` : '';
  
  const card = document.createElement('div');
  card.className = `schedule-card ${isTracked ? 'tracked' : ''} ${statusClass}`;
  
  card.innerHTML = `
    <img src="${cover}" class="schedule-cover" alt="cover" loading="lazy" />
    <div class="schedule-info">
      <div class="schedule-time">${timeStr}</div>
      <div class="schedule-title" title="${title}">${title}</div>
      <div class="schedule-meta">
        <span class="schedule-ep">Ep ${item.episode}</span>${countdownHtml}
      </div>
    </div>
  `;
  
  card.addEventListener('click', () => {
    let localData = null;
    if (isTracked) {
      try {
        const rawList = localStorage.getItem('myAnimeList');
        if (rawList) {
          const parsed = JSON.parse(rawList);
          localData = parsed.find(a => String(a.id) === String(media.idMal));
        }
      } catch(e){}
    }

    const nextAiringOverride = realTimeUntil > 0 ? {
      episode: item.episode,
      timeUntilAiring: realTimeUntil
    } : null;
    
    modalHistory = [];
    updateModalBackButton();
    _onModalCardClick(media, localData, nextAiringOverride, true);
  });
  
  return card;
}

async function _onModalCardClick(anime, localData = null, nextAiringOverride = undefined, fromGrid = false) {
  if (!fromGrid && currentModalState) {
    modalHistory.push(currentModalState);
  }

  const modalData = { ...anime };
  if (nextAiringOverride !== undefined) {
    modalData.nextAiringEpisode = nextAiringOverride;
  }
  
  currentModalState = { a: modalData, local: localData, nextAiringOverride };
  updateModalBackButton();

  renderAniListModal(modalData, localData, detailModal);

  if (!anime.id) return;
  _fetchExtendedData(anime.id, localData, nextAiringOverride);
}

async function _fetchExtendedData(id, localData, nextAiringOverride) {
  try {
    injectRecsPlaceholder();

    const [fullAl, { recommendations, relations }] = await Promise.all([
      fetchAniListById(id),
      fetchAniListRecommendations(id)
    ]);

    if (nextAiringOverride !== undefined) {
      fullAl.nextAiringEpisode = nextAiringOverride;
    }

    if (document.getElementById('detailModal')?.classList.contains('show')) {
      if (currentModalState && currentModalState.a.id === id) {
        currentModalState.a = fullAl;
      }
      renderAniListModal(fullAl, localData, detailModal);
      injectRecsPlaceholder(); 
      renderRelations(relations, a => _onModalCardClick(a, null, undefined, false));
      renderRecommendations(recommendations, a => _onModalCardClick(a, null, undefined, false));
    }
  } catch (e) {
    console.warn("Failed to fetch extended modal data:", e);
  }
}

function formatTime(timestamp) {
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatCountdown(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  if (d > 0) {
    return `${d}d ${h}h`;
  }
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}
