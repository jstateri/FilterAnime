// ── controller.js ─────────────────────────────────────────────────────────
// Controller layer. Handles all user events, calls the Model (api.js),
// then delegates rendering to the View (view.js).

import { state, myAnimeList, setMyAnimeList, clearMyAnimeList,
         getSavedUsername, setSavedUsername } from './state.js';
import { fetchAniList, fetchMAL, importMALByUsername,
         normalizeMalApiItem, normalizeXmlItem,
         fetchAniListRecommendations, fetchMALRecommendations,
         fetchAniListById, fetchAniListTags } from './api.js';
import { STATUS_OPTIONS_GLOBAL, STATUS_OPTIONS_MYLIST, AL_GENRES, MAL_GENRES } from './config.js';
import {
  dom, renderGenreMenu, renderYearMenu, renderStatusMenu, renderTabUI,
  renderHideButton, renderSkeletons, renderEmpty, renderError,
  renderResultInfo, renderPagination, renderPills,
  renderMyListCards, renderAniListCards, renderMALCards,
  renderAniListModal, renderMALModal,
  injectRecsPlaceholder, renderRecommendations, renderRelations,
  renderTagMenu, populateTagCategories, updateTagCount,
  resetDropdown, capitalise,
} from './view.js';
import { initNotifications, refreshNotifications } from './notifications/controller.js'; // Add this line


let detailModal;
let _allTags = {}; // cached { category: [tags] } from /api/tags

// ── Bootstrap ─────────────────────────────────────────────────────────────
export function init() {
  detailModal = new bootstrap.Modal(document.getElementById('detailModal'));

  // Pre-fill saved username
  const savedUser = getSavedUsername();
  if (savedUser) document.getElementById('malUsername').value = savedUser;

  // Build menus
  renderGenreMenu(state.genresIn, state.genresEx, '', _genreListForSource(state.source));
  renderYearMenu(state.years);
  const initOpts = state.source === 'mylist' ? STATUS_OPTIONS_MYLIST : STATUS_OPTIONS_GLOBAL;
  renderStatusMenu(initOpts, state.status);
  renderTabUI(state.source, myAnimeList.length > 0);

  _bindEvents();
  initNotifications(); // <-- Add this line

  // Fetch AniList tags asynchronously — don't block the initial render
  fetchAniListTags()
    .then(grouped => {
      _allTags = grouped;
      populateTagCategories(grouped);
      renderTagMenu(grouped, state.tagsIn, state.tagsEx, '', state.tagMinPct);
    })
    .catch(e => console.warn('Tag fetch failed:', e));

  _fetchAndRender();
}

// ── Helpers ───────────────────────────────────────────────────────────────
function _genreListForSource(source) {
  return source === 'mal' ? MAL_GENRES : AL_GENRES;
}

// ── Event wiring ───────────────────────────────────────────────────────────
function _bindEvents() {

  // Source tabs
  document.querySelectorAll('.source-tabs .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.source-tabs .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.source  = btn.dataset.source;
      state.page    = 1;
      state.status  = '';
      // Clear genre/tag selections that don't apply to the new source
      state.genresIn  = [];
      state.genresEx  = [];
      if (state.source === 'mal') {
        state.tagsIn    = [];
        state.tagsEx    = [];
        state.tagMinPct = 0;
        const slider  = dom.tagMinPctSlider();
        const display = dom.tagMinPctValue();
        if (slider)  slider.value       = 0;
        if (display) display.textContent = '0';
        updateTagCount(state.tagsIn, state.tagsEx);
      }
      dom.genreCount().textContent = '';
      const opts = state.source === 'mylist' ? STATUS_OPTIONS_MYLIST : STATUS_OPTIONS_GLOBAL;
      renderStatusMenu(opts, state.status);
      renderTabUI(state.source, myAnimeList.length > 0);
      renderGenreMenu(state.genresIn, state.genresEx, '', _genreListForSource(state.source));
      _fetchAndRender();
    });
  });

  // Type dropdown
  document.querySelectorAll('#typeMenu .dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('#typeMenu .dropdown-item').forEach(i => i.classList.remove('active-item'));
      item.classList.add('active-item');
      state.type = item.dataset.value;
      document.getElementById('typeToggle').innerHTML =
        `<i class="bi bi-collection-play"></i> ${state.type ? capitalise(state.type) : 'Type'}`;
      state.page = 1;
    });
  });

  // Sort dropdown
  document.querySelectorAll('#sortMenu .dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('#sortMenu .dropdown-item').forEach(i => i.classList.remove('active-item'));
      item.classList.add('active-item');
      state.sort = item.dataset.value;
      document.getElementById('sortToggle').innerHTML =
        `<i class="bi bi-sort-down"></i> ${item.textContent.trim()}`;
      state.page = 1;
    });
  });

  // Genre menu — delegated listener on the menu container
  dom.genreMenu().addEventListener('click', e => {
    const li = e.target.closest('li[data-genre]');
    if (!li) return;
    e.stopPropagation();
    const g = li.dataset.genre;
    if (state.genresIn.includes(g)) {
      state.genresIn = state.genresIn.filter(x => x !== g);
      state.genresEx.push(g);
    } else if (state.genresEx.includes(g)) {
      state.genresEx = state.genresEx.filter(x => x !== g);
    } else {
      state.genresIn.push(g);
    }
    const total = state.genresIn.length + state.genresEx.length;
    dom.genreCount().textContent = total ? `(${total})` : '';
    dom.genreSearch().value = '';
    renderGenreMenu(state.genresIn, state.genresEx, '', _genreListForSource(state.source));
  });

  // Genre search input
  dom.genreSearch().addEventListener('input', e => {
    renderGenreMenu(state.genresIn, state.genresEx, e.target.value, _genreListForSource(state.source));
  });

  // Tag chips — delegated click: off → include → exclude → off
  document.getElementById('tagList')?.addEventListener('click', e => {
    const chip = e.target.closest('.tag-chip[data-tag]');
    if (!chip) return;
    e.stopPropagation();
    const t = chip.dataset.tag;
    if (state.tagsIn.includes(t)) {
      state.tagsIn = state.tagsIn.filter(x => x !== t);
      state.tagsEx.push(t);
    } else if (state.tagsEx.includes(t)) {
      state.tagsEx = state.tagsEx.filter(x => x !== t);
    } else {
      state.tagsIn.push(t);
    }
    updateTagCount(state.tagsIn, state.tagsEx);
    renderTagMenu(_allTags, state.tagsIn, state.tagsEx,
      dom.tagSearch()?.value || '', state.tagMinPct);
  });

  // Tag search input
  dom.tagSearch()?.addEventListener('input', e => {
    renderTagMenu(_allTags, state.tagsIn, state.tagsEx,
      e.target.value, state.tagMinPct);
  });

  // Minimum tag % slider
  dom.tagMinPctSlider()?.addEventListener('input', e => {
    const val = parseInt(e.target.value);
    state.tagMinPct = val;
    const display = dom.tagMinPctValue();
    if (display) display.textContent = val;
    // Update the track fill via CSS custom property
    e.target.style.setProperty('--pct', val + '%');
    renderTagMenu(_allTags, state.tagsIn, state.tagsEx,
      dom.tagSearch()?.value || '', val);
  });

  // Reset slider
  dom.tagMinPctClear()?.addEventListener('click', e => {
    e.stopPropagation();
    state.tagMinPct = 0;
    const slider  = dom.tagMinPctSlider();
    const display = dom.tagMinPctValue();
    if (slider)  { slider.value = 0; slider.style.setProperty('--pct', '0%'); }
    if (display) display.textContent = '0';
    renderTagMenu(_allTags, state.tagsIn, state.tagsEx,
      dom.tagSearch()?.value || '', 0);
  });

  // Year menu — delegated listener
  dom.yearMenu().addEventListener('change', e => {
    const input = e.target;
    if (input.type !== 'checkbox') return;
    const y = input.value;
    if (input.checked) {
      if (!state.years.includes(y)) state.years.push(y);
    } else {
      state.years = state.years.filter(x => x !== y);
    }
    dom.yearCount().textContent = state.years.length ? `(${state.years.length})` : '';
    renderYearMenu(state.years);
  });

  // Status menu — delegated
  dom.statusMenu().addEventListener('click', e => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    document.querySelectorAll('#statusMenu .dropdown-item').forEach(i => i.classList.remove('active-item'));
    item.classList.add('active-item');
    state.status = item.dataset.value;
    document.getElementById('statusToggle').innerHTML =
      `<i class="bi bi-broadcast"></i> ${item.textContent.trim() === 'All' ? 'Status' : item.textContent.trim()}`;
    state.page = 1;
    _fetchAndRender();
  });

  // Filter button & Enter key — works for all sources
  document.getElementById('btnFilter').addEventListener('click', () => {
    state.q    = dom.search().value.trim();
    state.page = 1;
    _fetchAndRender();
  });
  dom.search().addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      state.q    = dom.search().value.trim();
      state.page = 1;
      _fetchAndRender();
    }
  });


  // Hide my list toggle
  dom.btnHide().addEventListener('click', () => {
    state.hideMyList = !state.hideMyList;
    renderHideButton(state.hideMyList);
    state.page = 1;
    _fetchAndRender();
  });

  // Import by username
  document.getElementById('btnImportUsername').addEventListener('click', _handleImportUsername);

  // Upload XML
  document.getElementById('btnUploadXml').addEventListener('click', () => {
    document.getElementById('xmlUpload').click();
  });
  document.getElementById('xmlUpload').addEventListener('change', _handleXmlUpload);

  // Clear list
  dom.btnClear().addEventListener('click', () => {
    if (!confirm('Are you sure you want to clear your imported anime list?')) return;
    clearMyAnimeList();
    refreshNotifications(); // <-- Add this line
    renderTabUI(state.source, false);
    if (state.source === 'mylist') { state.page = 1; _fetchAndRender(); }
  });

  // Stats page link
  document.getElementById('btnStats')?.addEventListener('click', () => {
    window.location.href = '/stats.html';
  });
}

// ── Import: username ───────────────────────────────────────────────────────
async function _handleImportUsername() {
  const username = document.getElementById('malUsername').value.trim();
  if (!username) { alert('Please enter a MyAnimeList username.'); return; }

  const btn = document.getElementById('btnImportUsername');
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
  btn.disabled  = true;

  try {
    const raw = await importMALByUsername(username);
    if (!raw.length) {
      alert("No anime found. Check the username and make sure the list is public.");
      return;
    }
    const list = raw.map(normalizeMalApiItem);
    setMyAnimeList(list);
    setSavedUsername(username);
    refreshNotifications(); // <-- Add this line
    alert(`Imported ${list.length} anime from ${username}'s list!`);
    renderTabUI(state.source, true);
    if (state.source === 'mylist') { state.page = 1; _fetchAndRender(); }
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.innerHTML = orig;
    btn.disabled  = false;
  }
}

// ── Import: XML ────────────────────────────────────────────────────────────
function _handleXmlUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const xml  = new DOMParser().parseFromString(ev.target.result, 'text/xml');
      const nodes = xml.querySelectorAll('anime');
      if (!nodes.length) { alert('No anime found in XML.'); return; }
      const list = Array.from(nodes).map(normalizeXmlItem);
      setMyAnimeList(list);
      refreshNotifications(); // <-- Add this line
      alert(`Imported ${list.length} anime!`);
      renderTabUI(state.source, true);
      if (state.source === 'mylist') { state.page = 1; _fetchAndRender(); }
    } catch (err) {
      alert('Error parsing XML: ' + err);
    }
  };
  reader.readAsText(file);
}

// ── Main fetch + render cycle ──────────────────────────────────────────────
async function _fetchAndRender() {
  renderSkeletons(state.perPage);
  renderPills(state, _onPillRemove);

  const params = {
    q:              state.q,
    type:           state.type,
    genres:         state.genresIn.join(','),
    genres_exclude: state.genresEx.join(','),
    tags_in:        state.tagsIn.join(','),
    tags_ex:        state.tagsEx.join(','),
    tag_min_pct:    state.tagMinPct || '',
    years:          state.years.join(','),
    sort:           state.sort,
    page:           state.page,
    limit:          state.perPage,
  };

  try {
    let result = { items: [], total: 0, lastPage: 1 };

    if (state.source === 'mylist') {
      result = await _fetchMyList(params);
    } else if (state.source === 'anilist') {
      result = await _fetchAniListSource(params);
    } else {
      result = await _fetchMALSource(params);
    }

    // Only update totals on first page to avoid flickering
    if (state.page === 1) {
      state.total    = result.total;
      state.lastPage = result.lastPage;
    }

    _renderCards(result.items);
    renderResultInfo(state.page, state.lastPage, state.total);
    renderPagination(state.page, state.lastPage, page => {
      state.page = page;
      _fetchAndRender();
    });
  } catch (err) {
    renderError(err);
  }
}

async function _fetchMyList(params) {
  if (!myAnimeList.length) { renderEmpty(); return { items: [], total: 0, lastPage: 1 }; }

  let target = myAnimeList;
  if (state.status) target = target.filter(a => a.my_status === state.status);
  if (!target.length) { renderEmpty(); return { items: [], total: 0, lastPage: 1 }; }

  const ids = target.map(a => a.id).join(',');
  return await fetchAniList(params, ids, null);
}

async function _fetchAniListSource(params) {
  params.status = state.status;
  const excludeIds = (state.hideMyList && myAnimeList.length)
    ? myAnimeList.map(a => a.id).join(',')
    : null;
  return await fetchAniList(params, null, excludeIds);
}

async function _fetchMALSource(params) {
  params.status = state.status;
  const result = await fetchMAL(params);
  if (state.hideMyList && myAnimeList.length) {
    const myIds = new Set(myAnimeList.map(a => parseInt(a.id)));
    result.items = result.items.filter(a => !myIds.has(a.mal_id));
  }
  return result;
}

// ── Card dispatch ──────────────────────────────────────────────────────────
// For AniList/mylist cards: _loadRecommendations handles the full-fetch +
// single modal render internally, so we don't pre-render here.
// For MAL cards: no full-fetch needed so render immediately then load recs.
function _renderCards(items) {
  if (state.source === 'mylist') {
    renderMyListCards(items, myAnimeList, (a, local) => {
      // Show partial data immediately so modal opens without delay
      renderAniListModal(a, local, detailModal);
      // _loadRecommendations will re-render with full data + inject sections
      _loadRecommendations({ source: 'anilist', anilistId: a.id, malId: a.idMal, item: a });
    });
  } else if (state.source === 'anilist') {
    renderAniListCards(items, a => {
      renderAniListModal(a, null, detailModal);
      _loadRecommendations({ source: 'anilist', anilistId: a.id, malId: a.idMal, item: a });
    });
  } else {
    // MAL source — render immediately, no full-fetch needed
    renderMALCards(items, a => {
      renderMALModal(a, detailModal);
      _loadRecommendations({ source: 'mal', malId: a.mal_id, item: a });
    });
  }
}

// ── Pill removal ───────────────────────────────────────────────────────────
function _onPillRemove(type, value) {
  switch (type) {
    case 'q':
      state.q = '';
      dom.search().value = '';
      break;
    case 'type':
      state.type = '';
      resetDropdown('typeMenu', 'typeToggle',
        '<i class="bi bi-collection-play"></i>', 'Type');
      break;
    case 'status':
      state.status = '';
      const opts = state.source === 'mylist' ? STATUS_OPTIONS_MYLIST : STATUS_OPTIONS_GLOBAL;
      renderStatusMenu(opts, '');
      break;
    case 'genreIn':
      state.genresIn = state.genresIn.filter(x => x !== value);
      dom.genreCount().textContent =
        (state.genresIn.length + state.genresEx.length) || '';
      renderGenreMenu(state.genresIn, state.genresEx, '', _genreListForSource(state.source));
      break;
    case 'genreEx':
      state.genresEx = state.genresEx.filter(x => x !== value);
      dom.genreCount().textContent =
        (state.genresIn.length + state.genresEx.length) || '';
      renderGenreMenu(state.genresIn, state.genresEx, '', _genreListForSource(state.source));
      break;
    case 'year':
      state.years = state.years.filter(x => x !== value);
      dom.yearCount().textContent = state.years.length ? `(${state.years.length})` : '';
      renderYearMenu(state.years);
      break;
    case 'tagIn':
      state.tagsIn = state.tagsIn.filter(x => x !== value);
      updateTagCount(state.tagsIn, state.tagsEx);
      renderTagMenu(_allTags, state.tagsIn, state.tagsEx,
        dom.tagSearch()?.value || '', state.tagMinPct);
      break;
    case 'tagEx':
      state.tagsEx = state.tagsEx.filter(x => x !== value);
      updateTagCount(state.tagsIn, state.tagsEx);
      renderTagMenu(_allTags, state.tagsIn, state.tagsEx,
        dom.tagSearch()?.value || '', state.tagMinPct);
      break;
  }
  state.page = 1;
  _fetchAndRender();
}

// ── Recommendations loader ─────────────────────────────────────────────────
// Called after any modal opens. Injects skeleton → fetches → renders cards.
// Clicking a rec card opens its own modal (with nested recommendations).
async function _loadRecommendations({ source, anilistId, malId, item }) {
  // Step 1: fetch full AniList data so we render the modal exactly once.
  // This prevents the double-render race where a background fetchAniListById
  // would wipe the already-injected #recsSection.
  if (source === 'anilist' && anilistId) {
    try {
      const full = await fetchAniListById(anilistId);
      if (document.getElementById('detailModal')?.classList.contains('show')) {
        renderAniListModal(full, null, detailModal);
      }
    } catch (e) {
      console.warn('Full media fetch failed, falling back to partial:', e);
    }
  }

  // Step 2: inject placeholder sections — modal body is now stable
  injectRecsPlaceholder();

  const onAnimeClick = async (entry) => {
    if (entry.id) {
      // Recursively open another entry — _loadRecommendations handles
      // the full-fetch + single-render cycle for the new entry too
      await _loadRecommendations({
        source: 'anilist', anilistId: entry.id, malId: entry.idMal, item: entry,
      });
    } else {
      // MAL stub from Jikan recs — no AniList ID available
      const stub = {
        title:  entry.title,
        images: { jpg: { large_image_url: entry.coverImage } },
        url:    entry.url,
        mal_id: entry.id,
      };
      renderMALModal(stub, detailModal);
      if (entry.id) {
        await _loadRecommendations({ source: 'mal', malId: entry.id, item: stub });
      }
    }
  };

  try {
    if (source === 'anilist' && anilistId) {
      const { recommendations, relations } = await fetchAniListRecommendations(anilistId);
      renderRelations(relations, onAnimeClick);
      renderRecommendations(recommendations, onAnimeClick);

    } else if (malId) {
      renderRelations({ prequel: null, sequel: null, other: [] }, onAnimeClick);
      const recs = await fetchMALRecommendations(malId);
      renderRecommendations(recs, onAnimeClick);

    } else {
      renderRelations({ prequel: null, sequel: null, other: [] }, onAnimeClick);
      renderRecommendations([], onAnimeClick);
    }

  } catch (err) {
    console.warn('Relations/Recommendations failed:', err);
    renderRelations({ prequel: null, sequel: null, other: [] }, onAnimeClick);
    renderRecommendations([], onAnimeClick);
  }
}

