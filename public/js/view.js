/**
 * @fileoverview view.js - View Layer (DOM Manipulation)
 * 
 * Strict View layer containing all UI rendering logic and DOM abstractions.
 * Functions here should never directly read or mutate application state. Instead,
 * they accept parameters passed down from the Controller and manipulate the DOM accordingly.
 */

import { AL_GENRES, MAL_GENRES, YEARS } from './config.js';

// ── DOM references (resolved once) ───────────────────────────────────────
export const dom = {
  grid:        () => document.getElementById('grid'),
  empty:       () => document.getElementById('emptyState'),
  count:       () => document.getElementById('countBadge'),
  info:        () => document.getElementById('resultsInfo'),
  pagination:  () => document.getElementById('pagination'),
  pills:       () => document.getElementById('activePills'),
  search:      () => document.getElementById('searchInput'),
  genreMenu:   () => document.getElementById('genreMenu'),
  genreSearch: () => document.getElementById('genreSearch'),
  genreCount:  () => document.getElementById('genreCount'),
  tagMenu:         () => document.getElementById('tagMenu'),
  tagList:         () => document.getElementById('tagList'),
  tagSearch:       () => document.getElementById('tagSearch'),
  tagMinPctSlider: () => document.getElementById('tagMinPctSlider'),
  tagMinPctValue:  () => document.getElementById('tagMinPctValue'),
  tagMinPctClear:  () => document.getElementById('tagMinPctClear'),
  tagCount:        () => document.getElementById('tagCount'),
  yearMenu:    () => document.getElementById('yearMenu'),
  yearCount:   () => document.getElementById('yearCount'),
  yearMinSlider: () => document.getElementById('yearMinSlider'),
  yearMaxSlider: () => document.getElementById('yearMaxSlider'),
  yearSliderFill:() => document.getElementById('yearSliderFill'),
  yearDisplayMin:() => document.getElementById('yearDisplayMin'),
  yearDisplayMax:() => document.getElementById('yearDisplayMax'),
  statusMenu:  () => document.getElementById('statusMenu'),
  modalBody:   () => document.getElementById('modalBody'),
  mlControls:  () => document.getElementById('myListControls'),
  btnClear:    () => document.getElementById('btnClearList'),
  btnHide:     () => document.getElementById('btnHideMyList'),
};

// ── Genre menu ─────────────────────────────────────────────────────────────
export function renderGenreMenu(genresIn, genresEx, filter = '', genreList = AL_GENRES) {
  const menu = dom.genreMenu();

  // Remove all but the search-input <li>
  while (menu.children.length > 1) menu.removeChild(menu.lastChild);

  const lower = filter.toLowerCase();
  genreList.filter(g => g.toLowerCase().includes(lower)).forEach(g => {
    const inActive = genresIn.includes(g);
    const exActive = genresEx.includes(g);

    let icon = '<i class="bi bi-square text-muted"></i>';
    if (inActive) icon = '<i class="bi bi-check-square-fill" style="color:var(--accent2)"></i>';
    if (exActive) icon = '<i class="bi bi-x-square-fill text-danger"></i>';

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="dropdown-item ${inActive || exActive ? 'active-item' : ''}">
        ${icon}
        <span style="${exActive ? 'text-decoration:line-through;opacity:0.6' : ''}">${g}</span>
      </div>`;
    li.dataset.genre = g;
    menu.appendChild(li);
  });
}

// ── Year slider ────────────────────────────────────────────────────────────
export function updateYearSlider(min, max, totalMin, totalMax, isActive) {
  const minSlider = dom.yearMinSlider();
  const maxSlider = dom.yearMaxSlider();
  const fill      = dom.yearSliderFill();
  const dispMin   = dom.yearDisplayMin();
  const dispMax   = dom.yearDisplayMax();

  if (minSlider) minSlider.value = min;
  if (maxSlider) maxSlider.value = max;
  if (dispMin) dispMin.textContent = min;
  if (dispMax) dispMax.textContent = max;

  if (fill && totalMax > totalMin) {
    const minPercent = ((min - totalMin) / (totalMax - totalMin)) * 100;
    const maxPercent = ((max - totalMin) / (totalMax - totalMin)) * 100;
    fill.style.left  = minPercent + '%';
    fill.style.width = (maxPercent - minPercent) + '%';
  }

  const count = dom.yearCount();
  if (count) {
    count.textContent = isActive ? `(${min}-${max})` : '';
  }
}

// ── Status dropdown ────────────────────────────────────────────────────────
export function renderStatusMenu(options, currentStatus) {
  const menu = dom.statusMenu();
  menu.innerHTML = '';

  options.forEach(s => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="dropdown-item ${currentStatus === s.val ? 'active-item' : ''}"
      data-value="${s.val}">${s.label}</span>`;
    menu.appendChild(li);
  });

  // Update toggle label
  const current = options.find(x => x.val === currentStatus);
  const label   = current?.label || 'Status';
  document.getElementById('statusToggle').innerHTML =
    `<i class="bi bi-broadcast"></i> ${label === 'All' ? 'Status' : label}`;
}

// ── Tab / UI state ─────────────────────────────────────────────────────────
export function renderTabUI(source, hasItems) {
  const isMyList = source === 'mylist';
  const isMAL    = source === 'mal';
  dom.mlControls().style.display  = isMyList ? 'flex' : 'none';
  dom.btnClear().style.display    = hasItems ? 'inline-block' : 'none';
  dom.btnHide().style.display     = (!isMyList && hasItems) ? 'inline-flex' : 'none';

  // Tags dropdown: visible for all sources
  const tagDropdown = document.getElementById('tagToggle')?.closest('.dropdown');
  if (tagDropdown) tagDropdown.style.display = '';

  const tagToggle = document.getElementById('tagToggle');
  if (tagToggle) {
    if (isMAL) {
      tagToggle.innerHTML = '<i class="bi bi-tags"></i> Themes <span id="tagCount" style="color:var(--accent);font-weight:700;"></span>';
    } else {
      tagToggle.innerHTML = '<i class="bi bi-bookmark-fill"></i> Tags <span id="tagCount" style="color:var(--accent);font-weight:700;"></span>';
    }
  }

  const pctWrap = document.querySelector('.tag-min-pct-wrap');
  if (pctWrap) {
    pctWrap.style.display = isMAL ? 'none' : 'block';
  }
}

export function renderHideButton(isHiding) {
  const btn = dom.btnHide();
  if (isHiding) {
    btn.style.background  = 'rgba(232,93,38,.15)';
    btn.style.color       = 'var(--accent)';
    btn.style.borderColor = 'var(--accent)';
    btn.innerHTML = '<i class="bi bi-eye-slash-fill"></i> <span>Hiding My Anime</span>';
  } else {
    btn.style.background  = 'var(--bg-input)';
    btn.style.color       = 'var(--muted)';
    btn.style.borderColor = 'var(--border)';
    btn.innerHTML = '<i class="bi bi-eye-slash"></i> <span>Hide My Anime</span>';
  }
}

// ── Skeletons ──────────────────────────────────────────────────────────────
export function renderSkeletons(count = 24) {
  const grid = dom.grid();
  grid.innerHTML = '';
  dom.empty().style.display = 'none';

  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton';
    s.innerHTML = `
      <div class="skeleton-img skeleton"></div>
      <div class="skeleton-text skeleton" style="width:80%"></div>
      <div class="skeleton-text skeleton short"></div>`;
    grid.appendChild(s);
  }
}

// ── Empty / error ──────────────────────────────────────────────────────────
export function renderEmpty() {
  dom.grid().innerHTML      = '';
  dom.empty().style.display = '';
  dom.pagination().innerHTML = '';
}

export function renderError(err) {
  dom.grid().innerHTML = `
    <div class="col-12 text-center py-5 text-danger">
      <i class="bi bi-exclamation-triangle fs-1"></i><br/>
      <small>${escHtml(String(err))}</small>
    </div>`;
}

// ── Result info ────────────────────────────────────────────────────────────
export function renderResultInfo(page, lastPage, total) {
  dom.count().textContent = `${total.toLocaleString()} anime`;
  dom.info().textContent  = `Page ${page} of ${lastPage} · ${total.toLocaleString()} results`;
}

// ── Anime cards ────────────────────────────────────────────────────────────
export function renderMyListCards(items, myAnimeList, onCardClick) {
  if (!items.length) { renderEmpty(); return; }
  dom.empty().style.display = 'none';
  const grid = dom.grid();
  grid.innerHTML = '';

  items.forEach((a, i) => {
    const local      = myAnimeList.find(x => parseInt(x.id) === a.idMal);
    const title      = a.title?.english || a.title?.romaji || 'Unknown';
    const img        = a.coverImage?.large || a.coverImage?.medium || '';
    const globalScore= a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
    const type       = a.format ?? '';
    const year       = a.startDate?.year ?? '';
    const status     = local?.my_status ?? '';
    const watched    = local?.watched   ?? '0';
    const totalEp    = a.episodes || '?';
    const genres     = (a.genres ?? []).slice(0, 3);

    let languages = new Set();
    if (a.characters?.edges) {
      a.characters.edges.forEach(e => {
        e.voiceActors?.forEach(va => {
          if (va.languageV2 === 'Japanese') languages.add('Japanese');
          if (va.languageV2 === 'English') languages.add('English');
        });
      });
    }
    const langArr = ['Japanese', 'English'].filter(l => languages.has(l)).join(', ');
    const langHtml = langArr ? `<span class="genre-tag" style="background:rgba(183,110,255,0.1); border-color:rgba(183,110,255,0.2); color:#b76eff;"><i class="bi bi-mic-fill" style="margin-right:3px;"></i>${langArr}</span>` : '';

    const card = _makeCard(i, title, img, globalScore, type);
    const scoreHtml = globalScore !== '—' ? `<i class="bi bi-star-fill" style="font-size:.8rem;color:#ffd166;margin-right:6px"></i>${globalScore}` : '<span style="color:var(--muted)">—</span>';
    card.querySelector('.card-body').innerHTML = `
      <div class="card-title">${_statusIcon(a.status)}${escHtml(title)}</div>
      <div class="card-meta">
        <span style="color:var(--accent2);font-weight:600">${status}</span>
        <span>${watched} / ${totalEp} ep</span>
        ${year ? `<span>${year}</span>` : ''}
      </div>
      <div class="card-my-score-list">${local?.my_score ? `<i class="bi bi-star-fill" style="font-size:.8rem;color:var(--accent2);margin-right:6px"></i>${local.my_score}` : '<span style="color:var(--muted)">—</span>'}</div>
      <div class="card-score-list">${scoreHtml}</div>
      <div class="card-genres">${langHtml}${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>`;

    card.addEventListener('click', () => onCardClick(a, local));
    grid.appendChild(card);
  });
}

export function renderAniListCards(items, onCardClick) {
  if (!items.length) { renderEmpty(); return; }
  dom.empty().style.display = 'none';
  const grid = dom.grid();
  grid.innerHTML = '';

  items.forEach((a, i) => {
    const title  = a.title?.english || a.title?.romaji || 'Unknown';
    const img    = a.coverImage?.large || a.coverImage?.medium || '';
    const score  = a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
    const type   = a.format ?? '';
    const year   = a.startDate?.year ?? '';
    const genres = (a.genres ?? []).slice(0, 3);

    let languages = new Set();
    if (a.characters?.edges) {
      a.characters.edges.forEach(e => {
        e.voiceActors?.forEach(va => {
          if (va.languageV2 === 'Japanese') languages.add('Japanese');
          if (va.languageV2 === 'English') languages.add('English');
        });
      });
    }
    const langArr = ['Japanese', 'English'].filter(l => languages.has(l)).join(', ');
    const langHtml = langArr ? `<span class="genre-tag" style="background:rgba(183,110,255,0.1); border-color:rgba(183,110,255,0.2); color:#b76eff;"><i class="bi bi-mic-fill" style="margin-right:3px;"></i>${langArr}</span>` : '';

    const card = _makeCard(i, title, img, score, type);
    const scoreHtml = score !== '—' ? `<i class="bi bi-star-fill" style="font-size:.8rem;color:#ffd166;margin-right:6px"></i>${score}` : '<span style="color:var(--muted)">—</span>';
    card.querySelector('.card-body').innerHTML = `
      <div class="card-title">${_statusIcon(a.status)}${escHtml(title)}</div>
      <div class="card-meta"><span>${year || '<span style="color:var(--muted)">—</span>'}</span></div>
      <div class="card-score-list">${scoreHtml}</div>
      <div class="card-genres">${langHtml}${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>`;

    card.addEventListener('click', () => onCardClick(a));
    grid.appendChild(card);
  });
}

export function renderMALCards(items, onCardClick) {
  if (!items.length) { renderEmpty(); return; }
  dom.empty().style.display = 'none';
  const grid = dom.grid();
  grid.innerHTML = '';

  items.forEach((a, i) => {
    const title  = a.title_english || a.title || 'Unknown';
    const img    = a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || '';
    const score  = a.score ? Number(a.score).toFixed(1) : '—';
    const type   = a.type ?? '';
    const year   = a.aired?.prop?.from?.year ?? '';
    const genres = (a.genres ?? []).slice(0, 3).map(g => g.name);

    const card = _makeCard(i, title, img, score, type);
    const scoreHtml = score !== '—' ? `<i class="bi bi-star-fill" style="font-size:.8rem;color:#ffd166;margin-right:6px"></i>${score}` : '<span style="color:var(--muted)">—</span>';
    card.querySelector('.card-body').innerHTML = `
      <div class="card-title">${_statusIcon(a.status)}${escHtml(title)}</div>
      <div class="card-meta"><span>${year || '<span style="color:var(--muted)">—</span>'}</span></div>
      <div class="card-score-list">${scoreHtml}</div>
      <div class="card-genres">${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>`;

    card.addEventListener('click', () => onCardClick(a));
    grid.appendChild(card);
  });
}

function _makeCard(i, title, img, score, type) {
  const card = document.createElement('div');
  card.className = 'anime-card';
  card.style.animationDelay = `${i * 0.03}s`;
  card.innerHTML = `
    <div class="card-img-wrap">
      ${img
        ? `<img src="${escHtml(img)}" alt="${escHtml(title)}" loading="lazy" />`
        : `<div class="img-placeholder"><i class="bi bi-film"></i></div>`}
      ${score !== '—' ? `<div class="card-score"><i class="bi bi-star-fill" style="font-size:.65rem;color:#ffd166"></i>${score}</div>` : ''}
      ${type ? `<div class="card-type-badge">${type}</div>` : ''}
    </div>
    <div class="card-body"></div>`;
  return card;
}

// ── Detail modal ───────────────────────────────────────────────────────────
export function renderAniListModal(a, localData, modal) {
  const title   = a.title?.english || a.title?.romaji || 'Unknown';
  const native  = a.title?.native  || '';
  const score   = a.averageScore ? (a.averageScore / 10).toFixed(1) : '—';
  const desc    = (a.description || 'No description available.')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/\n(?:[\s]*\n)+/g, '\n\n');
  const studios = (a.studios?.nodes ?? []).map(s => s.name).join(', ') || '—';
  const episodes = localData
    ? `${localData.watched} / ${a.episodes || '?'}`
    : a.episodes;
  const status   = localData ? localData.my_status : a.status;

  // NEW: Extract Demographic from AniList tags or genres
  const targetDemos = ['Shounen', 'Shoujo', 'Seinen', 'Josei', 'Kids'];
  let demographic = (a.tags || [])
    .filter(t => targetDemos.includes(t.name))
    .map(t => t.name)
    .join(', ');
  
  if (!demographic) {
    demographic = (a.genres || [])
      .filter(g => targetDemos.includes(g))
      .join(', ');
  }

  let languages = new Set();
  if (a.characters?.edges) {
    a.characters.edges.forEach(e => {
      e.voiceActors?.forEach(va => {
        if (va.languageV2) languages.add(va.languageV2);
      });
    });
  }
  const langArray = Array.from(languages);
  langArray.sort((a, b) => {
    if (a === 'Japanese') return -1;
    if (b === 'Japanese') return 1;
    if (a === 'English') return -1;
    if (b === 'English') return 1;
    return a.localeCompare(b);
  });
  const languagesStr = langArray.join(', ');

  dom.modalBody().innerHTML = _detailHTML({
    banner:     a.bannerImage || '',
    cover:      a.coverImage?.large || '',
    title, native, score,
    type:       a.format,
    status,
    episodes,
    year:       a.startDate?.year ?? '—',
    studios,
    genres:     a.genres ?? [],
    tags:       a.tags   ?? [],
    desc,
    demographic,
    languages:  languagesStr,
    nextAiring: a.nextAiringEpisode,
    anilistUrl: a.siteUrl || '',
    malUrl:     a.idMal ? `https://myanimelist.net/anime/${a.idMal}` : '',
  });

  dom.modalBody().scrollTop = 0;
  modal.show();
}

export function renderMALModal(a, modal) {
  const title  = a.title_english || a.title || 'Unknown';

  // NEW: Extract Demographic from MAL's API
  const demographic = (a.demographics || []).map(d => d.name).join(', ');

  dom.modalBody().innerHTML = _detailHTML({
    banner:     a.images?.jpg?.large_image_url || '',
    cover:      a.images?.jpg?.large_image_url || '',
    title,
    native:     a.title_japanese || '',
    score:      a.score ? Number(a.score).toFixed(1) : '—',
    type:       a.type,
    status:     a.status,
    episodes:   a.episodes,
    year:       a.aired?.prop?.from?.year ?? '—',
    studios:    (a.studios ?? []).map(s => s.name).join(', ') || '—',
    genres:     (a.genres ?? []).map(g => g.name),
    tags:       [],
    desc:       (a.synopsis || 'No description available.').replace(/\n(?:[\s]*\n)+/g, '\n\n'),
    demographic, // <-- Pass demographic to the HTML template
    anilistUrl: `https://anilist.co/search/anime?search=${encodeURIComponent(title)}`,
    malUrl:     a.url || '',
  });

  dom.modalBody().scrollTop = 0;
  modal.show();
}

function _detailHTML({ banner, cover, title, native, score, type, status,
    episodes, year, studios, genres, tags, desc, anilistUrl, malUrl, demographic, languages, nextAiring }) {
  // Store tags on the modal body so injectRecsPlaceholder can render them later
  // We use a data attribute to pass them safely without inline script hacks
  _pendingTags = tags || [];

  let nextAiringHTML = '';
  if (nextAiring) {
    const s = nextAiring.timeUntilAiring;
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    let timeStr = [];
    if (d > 0) timeStr.push(`${d}d`);
    if (h > 0 || d > 0) timeStr.push(`${h}h`);
    timeStr.push(`${m}m`);
    
    nextAiringHTML = `
      <div class="mb-3" style="font-size: .85rem;">
        <span style="color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-right: 6px;">Next Episode:</span>
        <span style="color: #4ade80; font-weight: 600;">Ep ${nextAiring.episode} airs in ${timeStr.join(' ')}</span>
      </div>`;
  }

  return `
    ${banner
      ? `<img src="${escHtml(banner)}" class="detail-banner" alt="" />`
      : `<div class="detail-banner-placeholder"></div>`}
    <div class="detail-inner">
      <div class="d-flex gap-3 align-items-flex-start">
        ${cover ? `<img src="${escHtml(cover)}" class="detail-cover" alt="" />` : ''}
        <div class="flex-grow-1 pt-2">
          <h2 class="detail-title">${escHtml(title)}</h2>
          ${native ? `<div class="detail-sub">${escHtml(native)}</div>` : ''}
        </div>
      </div>
      <div class="detail-stats mt-3">
        ${score !== '—' ? _chip('⭐', 'Score',    score)             : ''}
        ${type          ? _chip('📺', 'Type',     capitalise(type))   : ''}
        ${status        ? _chip('📡', 'Status',   capitalise(status)) : ''}
        ${episodes      ? _chip('🎬', 'Episodes', episodes)           : ''}
        ${year !== '—'  ? _chip('📅', 'Year',     year)              : ''}
        ${studios !== '—' ? _chip('🏢', 'Studio', studios)           : ''}
      </div>
      ${genres.length
        ? `<div class="card-genres mb-3">
             ${genres.map(g => `<span class="genre-tag">${escHtml(g)}</span>`).join('')}
           </div>`
        : ''}
      ${demographic ? `
        <div class="mb-3" style="font-size: .85rem;">
          <span style="color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-right: 6px;">Demographic:</span>
          <span style="color: var(--accent2); font-weight: 600;">${escHtml(demographic)}</span>
        </div>
      ` : ''}
      ${languages ? `
        <div class="mb-3" style="font-size: .85rem;">
          <span style="color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-right: 6px;">Languages:</span>
          <span style="color: #b76eff; font-weight: 600;">${escHtml(languages)}</span>
        </div>
      ` : ''}
      ${nextAiringHTML}
        <p class="detail-desc">${escHtml(desc).replace(/\n/g, '<br/>')}</p>
      <div class="d-flex gap-2 flex-wrap mt-3">
        ${anilistUrl ? `<a href="${escHtml(anilistUrl)}" target="_blank" rel="noopener"
            class="ext-link" style="color:#02A9FF;border-color:rgba(2,169,255,.3)">
            <i class="bi bi-box-arrow-up-right"></i> AniList</a>` : ''}
        ${malUrl ? `<a href="${escHtml(malUrl)}" target="_blank" rel="noopener"
            class="ext-link" style="color:#2E51A2;border-color:rgba(46,81,162,.3)">
            <i class="bi bi-box-arrow-up-right"></i> MyAnimeList</a>` : ''}
      </div>
    </div>`;
}

// Module-level pending tags — set by _detailHTML, consumed by injectRecsPlaceholder
let _pendingTags = [];

function _chip(icon, label, val) {
  return `<div class="stat-chip"><span>${icon}</span>
    <div><div class="label">${label}</div><div>${val}</div></div></div>`;
}

// ── Pagination ─────────────────────────────────────────────────────────────
export function renderPagination(page, lastPage, onPageChange) {
  const container = dom.pagination();
  container.innerHTML = '';
  if (lastPage <= 1) return;

  const pages = _pageRange(page, lastPage);

  container.appendChild(_pageBtn('‹', page === 1, () => onPageChange(page - 1)));

  pages.forEach(p => {
    if (p === '…') {
      const el = document.createElement('span');
      el.className = 'page-btn'; el.textContent = '…'; el.style.cursor = 'default';
      container.appendChild(el);
    } else {
      const btn = _pageBtn(p, false, () => onPageChange(p));
      if (p === page) btn.classList.add('active');
      container.appendChild(btn);
    }
  });

  container.appendChild(_pageBtn('›', page >= lastPage, () => onPageChange(page + 1)));
}

function _pageRange(cur, total) {
  const delta = 2, range = [], result = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= cur - delta && i <= cur + delta)) range.push(i);
  }
  let prev;
  for (const i of range) {
    if (prev && i - prev > 1) result.push('…');
    result.push(i);
    prev = i;
  }
  return result;
}

function _pageBtn(label, disabled, onClick) {
  const btn = document.createElement('button');
  btn.className = 'page-btn';
  btn.textContent = label;
  btn.disabled = disabled;
  if (!disabled) btn.addEventListener('click', onClick);
  return btn;
}

// ── Active filter pills ────────────────────────────────────────────────────
export function renderPills(state, onRemove) {
  const container = dom.pills();
  container.innerHTML = '';

  const add = (label, clearFn) => {
    const pill = document.createElement('span');
    pill.className = 'filter-pill';
    pill.innerHTML = `${escHtml(label)} <span class="pill-x">✕</span>`;
    pill.addEventListener('click', () => clearFn());
    container.appendChild(pill);
  };

  if (state.q)
    add(`"${state.q}"`,      () => onRemove('q'));
  if (state.type)
    add(capitalise(state.type),   () => onRemove('type'));
  if (state.status)
    add(capitalise(state.status), () => onRemove('status'));
  if (state.minScore > 0)
    add(`⭐ > ${state.minScore}`, () => onRemove('minScore'));

  state.genresIn.forEach(g => add(`+ ${g}`,      () => onRemove('genreIn', g)));
  state.genresEx.forEach(g => add(`- ${g}`,      () => onRemove('genreEx', g)));
  state.tagsIn.forEach(t   => add(`🏷 + ${t}`,   () => onRemove('tagIn',   t)));
  state.tagsEx.forEach(t   => add(`🏷 - ${t}`,   () => onRemove('tagEx',   t)));
  if (state.yearActive)
    add(`📅 ${state.yearMin} - ${state.yearMax}`, () => onRemove('year'));
}

// ── Reset a single dropdown to its "All" state ─────────────────────────────
export function resetDropdown(menuId, toggleId, icon, label) {
  document.querySelectorAll(`#${menuId} .dropdown-item`).forEach(i => i.classList.remove('active-item'));
  const allItem = document.querySelector(`#${menuId} .dropdown-item[data-value=""]`);
  if (allItem) allItem.classList.add('active-item');
  const toggle = document.getElementById(toggleId);
  if (toggle) toggle.innerHTML = `${icon} ${label}`;
}

// ── Shared helpers ─────────────────────────────────────────────────────────
export function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

export function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _statusIcon(status) {
  if (!status) return '';
  const s = status.toLowerCase();
  if (s === 'releasing' || s === 'currently airing')
    return '<i class="bi bi-broadcast" style="color:#4ade80;margin-right:5px" title="Currently Airing"></i>';
  if (s === 'not_yet_released' || s === 'not yet aired')
    return '<i class="bi bi-clock-history" style="color:#facc15;margin-right:5px" title="Not Yet Aired"></i>';
  return '';
}

// ── Recommendations ────────────────────────────────────────────────────────
// Injects the recs skeleton placeholder immediately after modal open,
// then swapped out for real cards via renderRecommendations().

export function injectRecsPlaceholder() {
  const body = dom.modalBody();
  if (body.querySelector('#recsSection')) return;

  // Grab tags that were set by _detailHTML just before this call
  const tags        = _pendingTags || [];
  _pendingTags      = [];
  const safeTags    = tags.filter(t => !t.isMediaSpoiler && !t.isGeneralSpoiler);
  const spoilerTags = tags.filter(t =>  t.isMediaSpoiler ||  t.isGeneralSpoiler);

  const skeletonCard = () => `
    <div style="
      background:linear-gradient(90deg,var(--bg-card) 25%,#162035 50%,var(--bg-card) 75%);
      background-size:200% 100%; animation:shimmer 1.4s infinite;
      border-radius:8px; overflow:hidden;">
      <div style="aspect-ratio:2/3;"></div>
      <div style="padding:6px 8px 8px;">
        <div style="height:10px;background:rgba(255,255,255,.06);border-radius:4px;margin-bottom:5px;"></div>
        <div style="height:10px;background:rgba(255,255,255,.04);border-radius:4px;width:60%;"></div>
      </div>
    </div>`;

  // Merge all tags into one list sorted by rank desc, spoilers flagged
  const allTags = [...safeTags, ...spoilerTags]
    .sort((a, b) => b.rank - a.rank);

  const tagBarHTML = (t) => {
    const isSpoiler = t.isMediaSpoiler || t.isGeneralSpoiler;
    // rank is 0–100 directly from AniList
    const pct   = t.rank;
    // purple for normal, pink for spoiler
    const color = isSpoiler ? '#ff6eb4' : '#b76eff';
    return `
      <div class="tag-bar-row${isSpoiler ? ' tag-spoiler' : ''}"
           style="${isSpoiler ? 'display:none;' : ''}">
        <div class="tag-bar-name" title="${escHtml(t.category || '')}">
          ${isSpoiler ? '<i class="bi bi-eye-slash" style="font-size:.65rem;margin-right:4px;opacity:.6"></i>' : ''}
          ${escHtml(t.name)}
        </div>
        <div class="tag-bar-track">
          <div class="tag-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="tag-bar-pct" style="color:${isSpoiler ? '#ff6eb4' : 'var(--muted)'}">
          ${pct}%
        </div>
      </div>`;
  };

  const tagsHTML = allTags.length ? `
    <div class="section-block tags-section">
      <div class="section-block-header">
        <span class="section-block-title">
          <span style="width:8px;height:8px;border-radius:50%;background:#b76eff;display:inline-block;flex-shrink:0;"></span>
          Tags
          <span style="font-size:.7rem;font-weight:400;color:var(--muted);margin-left:2px">
            (${allTags.length})
          </span>
        </span>
        ${spoilerTags.length ? `
          <button class="spoiler-toggle" id="spoilerToggleBtn"
            data-count="${spoilerTags.length}" data-showing="false">
            <i class="bi bi-eye-slash"></i>
            Show ${spoilerTags.length} spoiler tag${spoilerTags.length > 1 ? 's' : ''}
          </button>` : ''}
      </div>
      <div class="tags-grid" id="allTagsGrid">
        ${allTags.map(tagBarHTML).join('')}
      </div>
    </div>` : '';

  const section = document.createElement('div');
  section.id = 'recsSection';
  section.innerHTML = `

    <!-- 1. Series (prequel / sequel / related) -->
    <div id="relationsSection" style="display:none;">
      <div class="section-block">
        <div class="section-block-header">
          <span class="section-block-title">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--green);display:inline-block;flex-shrink:0;"></span>
            Series
          </span>
        </div>
        <div id="relationsGrid" style="display:flex;flex-wrap:wrap;gap:10px;"></div>
      </div>
    </div>

    <!-- 2. Recommendations -->
    <div class="section-block">
      <div class="section-block-header">
        <span class="section-block-title">
          <span style="width:8px;height:8px;border-radius:50%;background:var(--purple);display:inline-block;flex-shrink:0;"></span>
          Recommendations
        </span>
      </div>
      <div id="recsGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;">
        ${Array.from({ length: 6 }).map(skeletonCard).join('')}
      </div>
    </div>

    <!-- 3. Tags -->
    ${tagsHTML}`;

  body.appendChild(section);

  // Wire spoiler toggle — shows/hides .tag-spoiler rows inline within the sorted list
  const toggleBtn = section.querySelector('#spoilerToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const showing = toggleBtn.dataset.showing === 'true';
      const spoilerRows = section.querySelectorAll('.tag-spoiler');
      const count = parseInt(toggleBtn.dataset.count);

      spoilerRows.forEach(row => {
        row.style.display = showing ? 'none' : 'flex';
      });

      toggleBtn.dataset.showing = showing ? 'false' : 'true';
      toggleBtn.innerHTML = showing
        ? `<i class="bi bi-eye-slash"></i> Show ${count} spoiler tag${count > 1 ? 's' : ''}`
        : `<i class="bi bi-eye"></i> Hide spoiler tags`;
    });
  }
}

// ── Relations (prequel / sequel / other) ───────────────────────────────────
export function renderRelations(relations, onRelationClick) {
  const section = document.getElementById('relationsSection');
  const grid    = document.getElementById('relationsGrid');
  if (!section || !grid) return;

  const { prequel, sequel, other } = relations;
  const hasAny = prequel || sequel || other.length > 0;
  if (!hasAny) { section.style.display = 'none'; return; }

  section.style.display = 'block';
  grid.innerHTML = '';

  // Build ordered list: prequel first, sequel second, then others
  const entries = [
    ...(prequel ? [prequel] : []),
    ...(sequel  ? [sequel]  : []),
    ...other,
  ];

  entries.forEach(entry => {
    const title = entry.title?.english || entry.title?.romaji || 'Unknown';
    const img   = entry.coverImage?.large || entry.coverImage?.medium || '';
    const type  = entry.relationType;
    const year  = entry.startDate?.year || '';

    // Color-code the relation badge
    const badgeColor = type === 'PREQUEL'    ? '#2ec97e'
                     : type === 'SEQUEL'     ? '#2eaaff'
                     : type === 'PARENT'     ? '#ffd166'
                     : type === 'SIDE_STORY' ? '#b76eff'
                     : '#6b7a96';

    const card = document.createElement('div');
    card.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 14px 10px 10px;
      cursor: pointer;
      transition: border-color .18s, transform .18s, box-shadow .18s;
      min-width: 200px;
      flex: 1 1 200px;
      max-width: 320px;
    `;
    card.innerHTML = `
      <div style="position:relative; flex-shrink:0;">
        <div style="
          position:absolute; top:-6px; left:50%; transform:translateX(-50%);
          background:${badgeColor}; color:${type === 'SEQUEL' ? '#000' : '#fff'};
          font-size:.6rem; font-weight:800; padding:2px 7px; border-radius:10px;
          letter-spacing:.05em; text-transform:uppercase; white-space:nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,.4);
        ">${escHtml(entry.relationLabel || type)}</div>
        ${img
          ? `<img src="${escHtml(img)}" alt="${escHtml(title)}"
               style="width:48px;height:68px;object-fit:cover;border-radius:6px;display:block;margin-top:6px;"
               loading="lazy"/>`
          : `<div style="width:48px;height:68px;border-radius:6px;background:var(--bg-deep);
               display:flex;align-items:center;justify-content:center;margin-top:6px;
               color:var(--muted)"><i class="bi bi-film"></i></div>`}
      </div>
      <div style="min-width:0; flex:1;">
        <div style="
          font-size:.84rem; font-weight:700; line-height:1.3; margin-bottom:4px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        " title="${escHtml(title)}">${escHtml(title)}</div>
        <div style="font-size:.72rem; color:var(--muted); margin-bottom:6px;">${year}${year && entry.format ? ' · ' : ''}${entry.format || ''}</div>
        <div style="
          display:inline-flex; align-items:center; gap:5px;
          background:${badgeColor}22; border:1px solid ${badgeColor}55;
          color:${badgeColor}; font-size:.7rem; font-weight:700;
          padding:3px 10px; border-radius:20px;
        ">
          <i class="bi bi-arrow-${type === 'PREQUEL' ? 'left' : type === 'SEQUEL' ? 'right' : 'return-right'}-circle"></i>
          ${escHtml(entry.relationLabel || type)}
        </div>
      </div>`;

    card.addEventListener('mouseenter', () => {
      card.style.borderColor = badgeColor;
      card.style.transform   = 'translateY(-2px)';
      card.style.boxShadow   = `0 8px 24px rgba(0,0,0,.35), 0 0 0 1px ${badgeColor}`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = 'var(--border)';
      card.style.transform   = '';
      card.style.boxShadow   = '';
    });
    card.addEventListener('click', () => onRelationClick(entry));

    grid.appendChild(card);
  });
}

export function renderRecommendations(recs, onRecClick) {
  const grid = document.getElementById('recsGrid');
  if (!grid) return;

  if (!recs.length) {
    grid.innerHTML = `
      <div style="
        grid-column:1/-1; text-align:center; padding:24px;
        color:var(--muted); font-size:.84rem;
      ">
        <i class="bi bi-emoji-neutral" style="font-size:1.6rem;opacity:.4;display:block;margin-bottom:8px"></i>
        No recommendations found
      </div>`;
    return;
  }

  grid.innerHTML = '';
  recs.forEach((r, i) => {
    const title = r.title?.english || r.title?.romaji || r.title || 'Unknown';
    const img   = r.coverImage?.large || r.coverImage?.medium || r.coverImage || '';
    const score = r.averageScore ? (r.averageScore / 10).toFixed(1) : null;
    const year  = r.startDate?.year || '';
    const type  = r.format || '';
    const votes = r.recommendationRating || r.votes || 0;

    const card = document.createElement('div');
    card.style.cssText = `
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: transform .2s, border-color .2s, box-shadow .2s;
      animation: fadeUp .3s ease both;
      animation-delay: ${i * 0.04}s;
    `;
    card.innerHTML = `
      <div style="position:relative; aspect-ratio:2/3; overflow:hidden; background:#0a1828;">
        ${img
          ? `<img src="${escHtml(img)}" alt="${escHtml(title)}" loading="lazy"
               style="width:100%;height:100%;object-fit:cover;transition:transform .3s"/>`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:1.5rem"><i class="bi bi-film"></i></div>`}
        ${score ? `
          <div style="
            position:absolute; top:5px; left:5px;
            background:rgba(0,0,0,.8); backdrop-filter:blur(4px);
            border:1px solid rgba(255,255,255,.1); border-radius:5px;
            font-size:.68rem; font-weight:700; padding:2px 5px;
            color:#ffd166; display:flex; align-items:center; gap:2px;
          ">
            <i class="bi bi-star-fill" style="font-size:.55rem"></i>${score}
          </div>` : ''}
        ${type ? `
          <div style="
            position:absolute; top:5px; right:5px;
            background:var(--accent); border-radius:4px;
            font-size:.6rem; font-weight:700; padding:1px 5px;
            letter-spacing:.04em; text-transform:uppercase; color:#fff;
          ">${type}</div>` : ''}
        ${votes > 0 ? `
          <div style="
            position:absolute; bottom:5px; right:5px;
            background:rgba(0,0,0,.8); backdrop-filter:blur(4px);
            border:1px solid rgba(255,255,255,.1); border-radius:5px;
            font-size:.65rem; font-weight:700; padding:2px 5px;
            color:var(--accent2); display:flex; align-items:center; gap:3px;
          ">
            <i class="bi bi-hand-thumbs-up-fill" style="font-size:.55rem"></i>${votes}
          </div>` : ''}
      </div>
      <div style="padding:7px 8px 9px;">
        <div style="
          font-size:.76rem; font-weight:600; line-height:1.3;
          display:-webkit-box; -webkit-line-clamp:2;
          -webkit-box-orient:vertical; overflow:hidden;
          margin-bottom:3px;
        ">${escHtml(title)}</div>
        <div style="font-size:.68rem; color:var(--muted);">${year}</div>
      </div>`;

    card.addEventListener('mouseenter', () => {
      card.style.transform    = 'translateY(-3px)';
      card.style.borderColor  = 'var(--purple)';
      card.style.boxShadow    = '0 8px 24px rgba(0,0,0,.4), 0 0 0 1px var(--purple)';
      const img = card.querySelector('img');
      if (img) img.style.transform = 'scale(1.06)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform    = '';
      card.style.borderColor  = 'var(--border)';
      card.style.boxShadow    = '';
      const img = card.querySelector('img');
      if (img) img.style.transform = '';
    });
    card.addEventListener('click', () => onRecClick(r));

    grid.appendChild(card);
  });
}

// ── Tag menu ───────────────────────────────────────────────────────────────
// groupedTags : { "Category / Sub": [{ name, rank, isGeneralSpoiler }] }
// tagsIn/Ex   : selected tag names
// filterText  : search string
// minPct      : 0–100 minimum rank to show
export function renderTagMenu(groupedTags, tagsIn, tagsEx, filterText = '', minPct = 0) {
  const list = dom.tagList();
  if (!list) return;
  list.innerHTML = '';

  const lower = filterText.toLowerCase();
  let anyVisible = false;

  Object.entries(groupedTags).forEach(([category, tags]) => {
    // Filter: search text + minimum percentage
    const visible = tags.filter(t =>
      (!filterText || t.name.toLowerCase().includes(lower))
    );
    if (!visible.length) return;

    // Category heading — use the raw AniList category name (already "Cast / Main Cast" etc)
    const heading = document.createElement('div');
    heading.className = 'tag-category-heading';
    heading.textContent = category;
    list.appendChild(heading);

    // Chip container
    const chips = document.createElement('div');
    chips.className = 'tag-chips';
    list.appendChild(chips);

    visible.forEach(tag => {
      const inActive = tagsIn.includes(tag.name);
      const exActive = tagsEx.includes(tag.name);

      const chip = document.createElement('div');
      chip.className = 'tag-chip'
        + (inActive ? ' tag-chip-in'  : '')
        + (exActive ? ' tag-chip-ex'  : '')
        + (tag.isGeneralSpoiler ? ' tag-chip-spoiler' : '');
      chip.dataset.tag = tag.name;
      chip.title = tag.isGeneralSpoiler ? `${tag.name} (spoiler)` : tag.name;
      chip.textContent = tag.name;
      chips.appendChild(chip);
    });

    anyVisible = true;
  });

  if (!anyVisible) {
    list.innerHTML = `<div style="color:var(--muted);font-size:.82rem;padding:10px 0;text-align:center">
      No tags found</div>`;
  }
}

// No-op kept for compatibility — category filter replaced by section headings
export function populateTagCategories(_groupedTags) {}

export function updateTagCount(tagsIn, tagsEx) {
  const el = dom.tagCount();
  if (!el) return;
  const total = tagsIn.length + tagsEx.length;
  el.textContent = total ? ` (${total})` : '';
}

