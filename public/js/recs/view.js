/**
 * @fileoverview recs/view.js - Recommendations View Layer
 * 
 * Handles DOM manipulation and rendering for the recommendations page.
 */

export const dom = {
  grid:           () => document.getElementById('mainRecsGrid'),
  loading:        () => document.getElementById('loadingState'),
  empty:          () => document.getElementById('emptyState'),
  excludeBtn:     () => document.getElementById('excludeToggle'),
  genreMenu:      () => document.getElementById('genreMenu'),
  genreSearch:    () => document.getElementById('genreSearch'),
  genreCount:     () => document.getElementById('genreCount'),
  yearMenu:       () => document.getElementById('yearMenu'),
  yearCount:      () => document.getElementById('yearCount'),
  yearMinSlider:  () => document.getElementById('yearMinSlider'),
  yearMaxSlider:  () => document.getElementById('yearMaxSlider'),
  yearSliderFill: () => document.getElementById('yearSliderFill'),
  yearDisplayMin: () => document.getElementById('yearDisplayMin'),
  yearDisplayMax: () => document.getElementById('yearDisplayMax'),
};

export function showLoading() {
  dom.loading().style.display = 'flex';
  dom.grid().innerHTML = '';
  dom.empty().style.display = 'none';
}

export function hideLoading() {
  dom.loading().style.display = 'none';
}

export function showEmpty() {
  dom.empty().style.display = 'flex';
  dom.grid().innerHTML = '';
}

export function bindExcludeToggle(onToggle) {
  const btn = dom.excludeBtn();
  if (btn) {
    btn.addEventListener('change', (e) => {
      onToggle(e.target.checked);
    });
  }
}

export function renderRecCards(items, onCardClick) {
  const grid = dom.grid();
  grid.innerHTML = '';
  
  if (items.length === 0) {
    showEmpty();
    return;
  }

  items.forEach((entry, i) => {
    const a = entry.anime;
    const title  = a.title?.english || a.title?.romaji || 'Unknown';
    const img    = a.coverImage?.large || a.coverImage?.medium || '';
    const score  = a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
    const type   = a.format ?? '';
    const year   = a.startDate?.year ?? '';
    const genres = (a.genres ?? []).slice(0, 3);
    
    // Formatting the reason string
    const reasonsStr = entry.reasons.length > 2 
      ? `Because you liked ${entry.reasons.slice(0, 2).join(' & ')}...`
      : `Because you liked ${entry.reasons.join(' & ')}`;

    const card = document.createElement('div');
    card.className = 'anime-card';
    card.style.animationDelay = `${i * 0.03}s`;
    card.style.height = 'auto'; // allow expansion for reasons

    card.innerHTML = `
      <div class="card-img-wrap">
        ${img
          ? `<img src="${_esc(img)}" alt="${_esc(title)}" loading="lazy" />`
          : `<div class="img-placeholder"><i class="bi bi-film"></i></div>`}
        ${score !== '—' ? `<div class="card-score"><i class="bi bi-star-fill" style="font-size:.65rem;color:#ffd166"></i>${score}</div>` : ''}
        ${type ? `<div class="card-type-badge">${type}</div>` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${_esc(title)}</div>
        <div class="card-meta"><span>${year}</span></div>
        <div class="card-genres">${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>
        <div style="font-size: 0.72rem; color: var(--accent2); margin-top: 8px; line-height: 1.3; font-weight: 500;">
          <i class="bi bi-stars"></i> ${reasonsStr}
        </div>
      </div>
    `;

    card.addEventListener('click', () => onCardClick(a));
    grid.appendChild(card);
  });
}

function _esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
