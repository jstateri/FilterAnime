// ── stats/view.js ─────────────────────────────────────────────────────────
// Stats View layer. All DOM mutations and Chart.js rendering live here.
// Receives pre-computed data from the model; never calls fetch directly.

// ── Chart palette ──────────────────────────────────────────────────────────
export const C = {
  accent:  '#e85d26', accent2: '#2eaaff', green:  '#2ec97e',
  yellow:  '#ffd166', purple:  '#b76eff', pink:   '#ff6eb4',
  muted:   '#6b7a96', card:    '#111c2e', deep:   '#080d16',
  border:  'rgba(255,255,255,.07)', text: '#e8edf5',
};

export const STATUS_COLORS = {
  'Completed':     C.green,
  'Watching':      C.accent2,
  'Plan to Watch': C.purple,
  'On-Hold':       C.yellow,
  'Dropped':       C.accent,
};

// Apply Chart.js global defaults once
export function applyChartDefaults() {
  Chart.defaults.color       = C.muted;
  Chart.defaults.borderColor = C.border;
  Chart.defaults.font.family = "'DM Sans', sans-serif";
}

const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0d1525',
      borderColor: 'rgba(255,255,255,.1)',
      borderWidth: 1,
      titleColor: '#e8edf5',
      bodyColor:  '#6b7a96',
      padding: 10,
      cornerRadius: 8,
    },
  },
};

// ── Loading / empty states ─────────────────────────────────────────────────
export function showLoading()  { document.getElementById('loadingState').style.display = 'flex'; }
export function hideLoading()  { document.getElementById('loadingState').style.display = 'none'; }
export function showEmpty()    { document.getElementById('emptyState').style.display   = 'flex'; }
export function showContent()  { document.getElementById('statsContent').style.display = 'block'; }

// ── Enrichment progress bar ────────────────────────────────────────────────
export function showEnrichProgress(done, total) {
  const prog = document.getElementById('enrichProgress');
  prog.classList.add('show');
  document.getElementById('loadingState').style.display = 'none';
  const pct = Math.min(100, Math.round(done / total * 100));
  document.getElementById('enrichFill').style.width = pct + '%';
  document.getElementById('enrichMsg').textContent   = `Enriching ${done} / ${total} anime…`;
}

export function hideEnrichProgress() {
  document.getElementById('enrichProgress').classList.remove('show');
}

// ── Hero stat cards ────────────────────────────────────────────────────────
export function renderHeroCards(stats) {
  const { total, completed, compPct, daysFrac, totalMinutes,
          totalWatched, avgScore, scoredCount, uniqGenresCount,
          droppedPct, droppedCount, ptwCount } = stats;

  const items = [
    { icon: '🎌', value: total.toLocaleString(),
      label: 'Total Anime',     sub: 'in your list' },
    { icon: '✅', value: completed.toLocaleString(),
      label: 'Completed',       sub: `${compPct}% completion rate`, color: C.green },
    { icon: '⏱️',
      value: daysFrac >= 1
        ? daysFrac.toFixed(1)
        : Math.round(daysFrac * 24).toString(),
      label: daysFrac >= 1 ? 'Days Watched' : 'Hours Watched',
      sub: `${totalWatched.toLocaleString()} episodes` },
    { icon: '⭐', value: avgScore ? avgScore.toFixed(2) : '—',
      label: 'Avg Your Score',  sub: `from ${scoredCount} rated` },
    { icon: '📺', value: totalWatched.toLocaleString(),
      label: 'Episodes Watched',sub: `≈ ${Math.round(totalMinutes / 60)} hours` },
    { icon: '🎭', value: uniqGenresCount,
      label: 'Genres Explored', sub: `out of ${total} anime` },
    { icon: '📉', value: droppedPct + '%',
      label: 'Drop Rate',       sub: `${droppedCount} dropped` },
    { icon: '📋', value: ptwCount.toLocaleString(),
      label: 'Plan to Watch',   sub: 'queued up' },
  ];

  const grid = document.getElementById('heroGrid');
  grid.innerHTML = '';
  items.forEach((h, i) => {
    const el = document.createElement('div');
    el.className = 'hero-card';
    el.style.animationDelay = `${i * 0.05}s`;
    el.innerHTML = `
      <div class="hc-icon">${h.icon}</div>
      <div class="hc-value" ${h.color ? `style="color:${h.color}"` : ''}>${h.value}</div>
      <div class="hc-label">${h.label}</div>
      <div class="hc-sub">${h.sub}</div>`;
    grid.appendChild(el);
  });
}

// ── Status doughnut chart ──────────────────────────────────────────────────
export function renderStatusChart(statusCounts) {
  const labels = Object.keys(statusCounts);
  const data   = labels.map(s => statusCounts[s]);
  const colors = labels.map(s => STATUS_COLORS[s] || C.muted);
  const total  = data.reduce((a, b) => a + b, 0);

  new Chart(document.getElementById('statusChart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: C.card }] },
    options: {
      ...BASE_OPTS, cutout: '65%',
      plugins: {
        ...BASE_OPTS.plugins,
        tooltip: { ...BASE_OPTS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw / total * 100)}%)` }
        },
      },
    },
  });

  const legend = document.getElementById('statusLegend');
  legend.innerHTML = '';
  labels.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'status-pill';
    el.innerHTML = `<span class="dot" style="background:${colors[i]}"></span>
      ${s} <strong style="color:${C.text};margin-left:3px">${data[i]}</strong>`;
    legend.appendChild(el);
  });
}

// ── Score distribution bars ────────────────────────────────────────────────
export function renderScoreBars(scoreDist) {
  const maxVal = Math.max(...Object.values(scoreDist), 1);
  const totalScored = Object.values(scoreDist).reduce((a, b) => a + b, 0);
  const grad   = ['#ff4444','#ff6633','#ff8822','#ffaa22','#ffcc22',
                  '#ccdd22','#99cc22','#55bb33','#22aa55','#00cc77'];
  const el = document.getElementById('scoreBars');
  el.innerHTML = '';

  for (let s = 10; s >= 1; s--) {
    const cnt = scoreDist[s];
    const barPct = Math.round(cnt / maxVal * 100);
    const overallPct = totalScored ? Math.round((cnt / totalScored) * 100) : 0;
    
    el.innerHTML += `
      <div class="score-bar-row">
        <div class="score-bar-label">${s}</div>
        <div class="score-bar-track">
          <div class="score-bar-fill" data-pct="${barPct}"
            style="background:${grad[s - 1]};width:0%">${cnt > 0 ? cnt : ''}</div>
        </div>
        <div class="score-bar-count" style="width:auto; min-width:45px;">
          ${cnt} <span style="font-size:.65rem; opacity:.6; margin-left:2px;">(${overallPct}%)</span>
        </div>
      </div>`;
  }
  
  el.innerHTML += `
    <div style="text-align: right; font-size: .75rem; color: var(--muted); margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--border);">
      Total scored: <strong style="color:var(--text)">${totalScored.toLocaleString()}</strong> entries
    </div>
  `;
  
  setTimeout(() => {
    el.querySelectorAll('.score-bar-fill').forEach(b => { b.style.width = b.dataset.pct + '%'; });
  }, 200);
}

// ── Episodes by status bar chart ───────────────────────────────────────────
export function renderEpisodesByStatusChart(epByStatus) {
  new Chart(document.getElementById('epStatusChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(epByStatus),
      datasets: [{
        data: Object.values(epByStatus),
        backgroundColor: Object.keys(epByStatus).map(s => STATUS_COLORS[s] || C.muted),
        borderRadius: 6,
      }],
    },
    options: {
      ...BASE_OPTS,
      scales: {
        x: { grid: { display: false }, ticks: { color: C.muted } },
        y: { grid: { color: C.border }, ticks: { color: C.muted } },
      },
    },
  });
}

// ── Genre distribution bars ────────────────────────────────────────────────
export function renderGenreBars(sortedGenres, totalAnime) {
  const topMax = sortedGenres[0]?.[1] || 1;
  const el = document.getElementById('genreBars');
  el.innerHTML = '';

  sortedGenres.slice(0, 20).forEach(([g, cnt]) => {
    const pct    = Math.round(cnt / totalAnime * 100);
    const barPct = Math.round(cnt / topMax * 100);
    el.innerHTML += `
      <div class="genre-bar-row">
        <div class="genre-bar-label" title="${g}">${g}</div>
        <div class="genre-bar-track">
          <div class="genre-bar-fill" data-pct="${barPct}" style="width:0%"></div>
        </div>
        <div class="genre-bar-pct">${pct}%</div>
      </div>`;
  });

  setTimeout(() => {
    el.querySelectorAll('.genre-bar-fill').forEach(b => { b.style.width = b.dataset.pct + '%'; });
  }, 300);
}

// ── Genre radar chart ──────────────────────────────────────────────────────
export function renderGenreRadar(sortedGenres) {
  const top8 = sortedGenres.slice(0, 8);
  new Chart(document.getElementById('genreRadar'), {
    type: 'radar',
    data: {
      labels: top8.map(([g]) => g),
      datasets: [{
        data: top8.map(([, c]) => c),
        backgroundColor: 'rgba(183,110,255,.18)',
        borderColor: C.purple,
        pointBackgroundColor: C.purple,
        pointRadius: 4,
      }],
    },
    options: {
      ...BASE_OPTS,
      scales: {
        r: {
          grid: { color: C.border },
          angleLines: { color: C.border },
          ticks: { display: false },
          pointLabels: { color: C.muted, font: { size: 11 } },
        },
      },
    },
  });
}

// ── Average score by genre horizontal bar ─────────────────────────────────
export function renderGenreScoreChart(genreAvgScores) {
  new Chart(document.getElementById('genreScoreChart'), {
    type: 'bar',
    data: {
      labels: genreAvgScores.map(([g]) => g),
      datasets: [{
        data: genreAvgScores.map(([, s]) => s),
        backgroundColor: genreAvgScores.map(([, s]) =>
          s >= 8 ? C.green : s >= 6 ? C.accent2 : C.accent),
        borderRadius: 5,
      }],
    },
    options: {
      ...BASE_OPTS,
      indexAxis: 'y',
      scales: {
        x: { min: 0, max: 10, grid: { color: C.border }, ticks: { color: C.muted } },
        y: { grid: { display: false }, ticks: { color: C.muted, font: { size: 11 } } },
      },
    },
  });
}

// ── Decade bar chart ───────────────────────────────────────────────────────
export function renderDecadeChart(decadeCounts) {
  const decades    = Object.keys(decadeCounts).sort();
  const maxDecade  = Math.max(...Object.values(decadeCounts), 1);
  const container  = document.getElementById('decadeBars');
  container.innerHTML = '';

  decades.forEach(d => {
    const cnt       = decadeCounts[d];
    const heightPct = Math.round(cnt / maxDecade * 100);
    const col       = document.createElement('div');
    col.className   = 'decade-col';
    col.innerHTML   = `
      <div style="font-size:.7rem;color:var(--muted);margin-bottom:2px">${cnt}</div>
      <div class="decade-bar" data-h="${heightPct}" style="height:3px"></div>
      <div class="decade-label">${d}s</div>`;
    container.appendChild(col);
  });

  setTimeout(() => {
    container.querySelectorAll('.decade-bar').forEach(b => {
      b.style.height = Math.round(parseInt(b.dataset.h) / 100 * 90) + 'px';
    });
  }, 400);
}

// ── Format doughnut chart ──────────────────────────────────────────────────
export function renderFormatChart(formatCounts) {
  const fmtColors = [C.accent, C.accent2, C.green, C.yellow, C.purple, C.pink, C.muted];
  new Chart(document.getElementById('typeChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(formatCounts),
      datasets: [{
        data: Object.values(formatCounts),
        backgroundColor: fmtColors,
        borderWidth: 2,
        borderColor: C.card,
      }],
    },
    options: {
      ...BASE_OPTS, cutout: '55%',
      plugins: {
        ...BASE_OPTS.plugins,
        legend: {
          display: true, position: 'right',
          labels: { color: C.muted, boxWidth: 12, padding: 8, font: { size: 11 } },
        },
      },
    },
  });
}

// ── Score vs episodes scatter ──────────────────────────────────────────────
export function renderScoreEpisodeChart(scatterData) {
  new Chart(document.getElementById('scoreEpChart'), {
    type: 'scatter',
    data: {
      datasets: [{
        data: scatterData,
        backgroundColor: C.accent2 + '88',
        borderColor: C.accent2,
        borderWidth: 1,
        pointRadius: 5,
        pointHoverRadius: 7,
      }],
    },
    options: {
      ...BASE_OPTS,
      scales: {
        x: { title: { display: true, text: 'Episodes', color: C.muted }, grid: { color: C.border }, ticks: { color: C.muted } },
        y: { title: { display: true, text: 'Your Score', color: C.muted }, min: 1, max: 10, grid: { color: C.border }, ticks: { color: C.muted } },
      },
      plugins: {
        ...BASE_OPTS.plugins,
        tooltip: { ...BASE_OPTS.plugins.tooltip,
          callbacks: { label: ctx => ` ${ctx.raw.label}: ${ctx.raw.y}/10 (${ctx.raw.x} ep)` },
        },
      },
    },
  });
}

// ── Top lists ──────────────────────────────────────────────────────────────
export function renderTopList(elId, items, valueFn, onClick) {
  const el     = document.getElementById(elId);
  const ranks  = ['gold', 'silver', 'bronze'];
  
  // Freeze height and enable vertical scrolling
  el.style.maxHeight = '340px';
  el.style.overflowY = 'auto';
  el.style.paddingRight = '6px';
  
  el.innerHTML = '';

  items.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'top-item';
    row.style.cursor = 'pointer';
    row.style.transition = 'background .15s';
    
    row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,.04)');
    row.addEventListener('mouseleave', () => row.style.background = 'transparent');
    row.addEventListener('click', () => onClick(a));

    row.innerHTML = `
      <div class="top-rank ${ranks[i] || ''}">${i + 1}</div>
      ${a.coverImage
        ? `<img class="top-cover" src="${_esc(a.coverImage)}" alt="" loading="lazy" />`
        : `<div class="top-cover" style="background:var(--bg-deep);border-radius:4px"></div>`}
      <div class="top-info">
        <div class="top-name" title="${_esc(a.title)}">${_esc(a.title)}</div>
        <div class="top-meta">${a.my_status || ''}</div>
      </div>
      <div class="top-score">${valueFn(a)}</div>
    `;
    el.appendChild(row);
  });
}

// ── Hot Takes & Hidden Gems ────────────────────────────────────────────────
export function renderHotTakes(takes, onClick) {
  const grid = document.getElementById('hotTakesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const renderCol = (title, items, isLoved) => {
    const col = document.createElement('div');
    col.className = 'take-card';
    const icon = isLoved ? '<i class="bi bi-heart-fill" style="color:var(--accent)"></i>' : '<i class="bi bi-heartbreak-fill" style="color:var(--muted)"></i>';
    col.innerHTML = `<div class="take-header">${icon} ${title}</div>`;

    // Create a scrollable wrapper for the list items so the header stays sticky
    const scrollWrap = document.createElement('div');
    scrollWrap.style.maxHeight = '300px';
    scrollWrap.style.overflowY = 'auto';
    scrollWrap.style.paddingRight = '6px';

    if (!items.length) {
       scrollWrap.innerHTML = `<div style="font-size:.8rem;color:var(--muted);padding:10px 0;">No scored anime found.</div>`;
       col.appendChild(scrollWrap);
       grid.appendChild(col);
       return;
    }

    items.forEach(a => {
      const diffStr = (a.diff > 0 ? '+' : '') + a.diff.toFixed(1);
      const diffColor = a.diff > 0 ? 'var(--green)' : 'var(--accent)';

      const row = document.createElement('div');
      row.className = 'take-row';
      row.style.cursor = 'pointer';
      row.style.padding = '6px';
      row.style.borderRadius = '6px';
      row.style.transition = 'background .15s';

      row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,.04)');
      row.addEventListener('mouseleave', () => row.style.background = 'transparent');
      row.addEventListener('click', () => onClick(a));

      row.innerHTML = `
        ${a.coverImage ? `<img class="take-cover" src="${_esc(a.coverImage)}" alt="" loading="lazy" />` : `<div class="take-cover" style="background:var(--bg-deep)"></div>`}
        <div class="take-info">
          <div class="take-title" title="${_esc(a.title)}">${_esc(a.title)}</div>
          <div class="take-scores">
            <span class="score-badge me" title="Your Score"><i class="bi bi-person-fill"></i> ${a.my_score}</span>
            <span class="score-badge world" title="Global Score"><i class="bi bi-globe"></i> ${(a.globalScore / 10).toFixed(1)}</span>
            <span style="color:${diffColor};font-weight:700;font-size:.7rem;margin-left:auto">${diffStr}</span>
          </div>
        </div>
      `;
      scrollWrap.appendChild(row);
    });
    
    col.appendChild(scrollWrap);
    grid.appendChild(col);
  };

  renderCol('I Loved, They Hated', takes.loved, true);
  renderCol('They Loved, I Hated', takes.hated, false);
}

export function renderObscure(items, onClick) {
  const el = document.getElementById('obscureAnime');
  if (!el) return;

  // Freeze height and enable vertical scrolling
  el.style.maxHeight = '340px';
  el.style.overflowY = 'auto';
  el.style.paddingRight = '6px';

  el.innerHTML = '';

  if (!items.length) {
     el.innerHTML = '<div style="font-size:.8rem;color:var(--muted);">No popularity data found.</div>';
     return;
  }

  items.forEach((a, i) => {
    const row = document.createElement('div');
    row.className = 'top-item';
    row.style.cursor = 'pointer';
    row.style.transition = 'background .15s';

    row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,.04)');
    row.addEventListener('mouseleave', () => row.style.background = 'transparent');
    row.addEventListener('click', () => onClick(a));

    row.innerHTML = `
      <div class="top-rank" style="font-size:1rem;width:20px;">${i + 1}</div>
      ${a.coverImage
        ? `<img class="top-cover" src="${_esc(a.coverImage)}" alt="" loading="lazy" />`
        : `<div class="top-cover" style="background:var(--bg-deep);border-radius:4px"></div>`}
      <div class="top-info">
        <div class="top-name" title="${_esc(a.title)}">${_esc(a.title)}</div>
        <div class="top-meta"><i class="bi bi-people-fill"></i> ${a.popularity.toLocaleString()} members</div>
      </div>
    `;
    el.appendChild(row);
  });
}

// ── Completion rings ───────────────────────────────────────────────────────
export function renderCompletionRings(rings) {
  const container  = document.getElementById('completionRings');
  container.innerHTML = '';

  rings.forEach(r => {
    const size   = 90, stroke = 8, radius = (size - stroke * 2) / 2;
    const circ   = 2 * Math.PI * radius;
    const dash   = circ * r.value / 100;

    const wrap   = document.createElement('div');
    wrap.className = 'progress-ring-wrap';
    wrap.innerHTML = `
      <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${radius}"
          stroke="${r.color}22" stroke-width="${stroke}" />
        <circle cx="${size/2}" cy="${size/2}" r="${radius}"
          stroke="${r.color}" stroke-width="${stroke}"
          stroke-dasharray="0 ${circ}" stroke-linecap="round"
          style="transition:stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" />
      </svg>
      <div style="font-family:var(--font-head);font-size:1.3rem;color:${r.color};letter-spacing:.04em">
        ${r.value}%
      </div>
      <div class="ring-label">${r.label}</div>`;
    container.appendChild(wrap);

    // Animate after paint
    setTimeout(() => {
      wrap.querySelector('circle:last-child')
        .setAttribute('stroke-dasharray', `${dash} ${circ}`);
    }, 400);
  });
}

// ── Scoring habits bars ────────────────────────────────────────────────────
export function renderScoringHabits(habits) {
  const maxVal = Math.max(...habits.map(h => h.val), 1);
  const el     = document.getElementById('scoringHabits');
  el.innerHTML = '';

  habits.forEach(h => {
    const pct = Math.round(h.val / maxVal * 100);
    el.innerHTML += `
      <div class="genre-bar-row" style="margin-bottom:10px">
        <div class="genre-bar-label" style="width:110px">${h.label}</div>
        <div class="genre-bar-track" style="height:18px">
          <div class="genre-bar-fill" data-pct="${pct}"
            style="width:0%;background:${h.color}"></div>
        </div>
        <div class="genre-bar-pct" style="width:32px">${h.val}</div>
      </div>`;
  });

  setTimeout(() => {
    el.querySelectorAll('.genre-bar-fill').forEach(b => { b.style.width = b.dataset.pct + '%'; });
  }, 500);
}

// ── Avg completion by status bar chart ────────────────────────────────────
export function renderCompletionChart(completionData) {
  new Chart(document.getElementById('completionChart'), {
    type: 'bar',
    data: {
      labels: completionData.map(d => d.status),
      datasets: [{
        data: completionData.map(d => d.pct),
        backgroundColor: completionData.map(d => STATUS_COLORS[d.status] || C.muted),
        borderRadius: 6,
      }],
    },
    options: {
      ...BASE_OPTS,
      scales: {
        x: { grid: { display: false }, ticks: { color: C.muted, maxRotation: 20, font: { size: 10 } } },
        y: {
          min: 0, max: 100,
          grid: { color: C.border },
          ticks: { color: C.muted, callback: v => v + '%' },
        },
      },
      plugins: { ...BASE_OPTS.plugins,
        tooltip: { ...BASE_OPTS.plugins.tooltip,
          callbacks: { label: ctx => ` Avg ${ctx.raw}% watched` },
        },
      },
    },
  });
}

// ── Username badge ─────────────────────────────────────────────────────────
export function renderUsernameBadge(username) {
  const el = document.getElementById('usernameBadge');
  if (el && username) el.textContent = `@${username}`;
}

// ── Private helper ─────────────────────────────────────────────────────────
function _esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
