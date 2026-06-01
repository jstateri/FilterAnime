// ── stats/model.js ────────────────────────────────────────────────────────
// Stats Model layer. Pure data computation — no DOM, no fetch.
// All functions take enriched list items and return plain data objects.

// ── Hero numbers ───────────────────────────────────────────────────────────
export function computeHeroStats(list) {
  const completed    = list.filter(a => a.my_status === 'Completed');
  const scored       = list.filter(a => a.my_score > 0);
  const avgScore     = scored.length
    ? scored.reduce((s, a) => s + a.my_score, 0) / scored.length
    : 0;
  const totalWatched = list.reduce((s, a) => s + (parseInt(a.watched) || 0), 0);
  const totalMinutes = list.reduce((s, a) => s + (parseInt(a.watched) || 0) * 24, 0);
  const daysFrac     = totalMinutes / 60 / 24;
  const uniqGenres   = [...new Set(list.flatMap(a => a.genres || []))];
  const droppedCount = list.filter(a => a.my_status === 'Dropped').length;
  const droppedPct   = list.length ? Math.round(droppedCount / list.length * 100) : 0;
  const compPct      = list.length ? Math.round(completed.length / list.length * 100) : 0;
  const ptwCount     = list.filter(a => a.my_status === 'Plan to Watch').length;

  return {
    total:         list.length,
    completed:     completed.length,
    compPct,
    daysFrac,
    totalMinutes,
    totalWatched,
    avgScore,
    scoredCount:   scored.length,
    uniqGenresCount: uniqGenres.length,
    droppedPct,
    droppedCount,
    ptwCount,
  };
}

// ── Status breakdown ───────────────────────────────────────────────────────
export function computeStatusCounts(list) {
  const counts = {};
  list.forEach(a => {
    counts[a.my_status] = (counts[a.my_status] || 0) + 1;
  });
  return counts;
}

// ── Episodes by status ─────────────────────────────────────────────────────
export function computeEpisodesByStatus(list) {
  const ep = {};
  list.forEach(a => {
    const s = a.my_status || 'Unknown';
    ep[s] = (ep[s] || 0) + (parseInt(a.watched) || 0);
  });
  return ep;
}

// ── Score distribution ─────────────────────────────────────────────────────
export function computeScoreDistribution(list) {
  const dist = {};
  for (let i = 1; i <= 10; i++) dist[i] = 0;
  list.filter(a => a.my_score > 0).forEach(a => {
    if (a.my_score >= 1 && a.my_score <= 10) dist[a.my_score]++;
  });
  return dist;
}

// ── Genre counts ───────────────────────────────────────────────────────────
export function computeGenreCounts(list) {
  const counts = {};
  list.forEach(a => (a.genres || []).forEach(g => {
    counts[g] = (counts[g] || 0) + 1;
  }));
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);
}

// ── Average score by genre ─────────────────────────────────────────────────
export function computeGenreAvgScores(list, minCount = 3) {
  const sums = {}, counts = {};
  list.filter(a => a.my_score > 0).forEach(a => {
    (a.genres || []).forEach(g => {
      sums[g]   = (sums[g]   || 0) + a.my_score;
      counts[g] = (counts[g] || 0) + 1;
    });
  });
  return Object.entries(sums)
    .filter(([g]) => counts[g] >= minCount)
    .map(([g, sum]) => [g, +(sum / counts[g]).toFixed(2)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
}

// ── Decade distribution ────────────────────────────────────────────────────
export function computeDecadeCounts(list) {
  const counts = {};
  list.forEach(a => {
    if (a.startYear) {
      const decade = Math.floor(a.startYear / 10) * 10;
      counts[decade] = (counts[decade] || 0) + 1;
    }
  });
  return counts;
}

// ── Format distribution ────────────────────────────────────────────────────
export function computeFormatCounts(list) {
  const counts = {};
  list.forEach(a => {
    const f = a.format || 'Unknown';
    counts[f] = (counts[f] || 0) + 1;
  });
  return counts;
}

// ── Score vs episodes scatter ──────────────────────────────────────────────
export function computeScoreEpisodeData(list, limit = 200) {
  return list
    .filter(a => a.my_score > 0 && a.episodes > 0)
    .map(a => ({ x: a.episodes, y: a.my_score, label: a.title }))
    .slice(0, limit);
}

// ── Top lists ──────────────────────────────────────────────────────────────
export function computeTopRated(list, n = 50) {
  return [...list]
    .filter(a => a.my_score > 0)
    .sort((a, b) => b.my_score - a.my_score)
    .slice(0, n);
}

export function computeTopByEpisodes(list, n = 50) {
  return [...list]
    .sort((a, b) => (parseInt(b.watched) || 0) - (parseInt(a.watched) || 0))
    .slice(0, n);
}

export function computeTopGlobal(list, n = 50) {
  return [...list]
    .filter(a => a.globalScore > 0)
    .sort((a, b) => b.globalScore - a.globalScore)
    .slice(0, n);
}

// ── Hot Takes & Hidden Gems ────────────────────────────────────────────────
export function computeHotTakes(list, n = 20) {
  const valid = list.filter(a => a.my_score > 0 && a.globalScore > 0);
  const scored = valid.map(a => ({
    ...a,
    diff: a.my_score - (a.globalScore / 10)
  }));

  const loved = [...scored].sort((a, b) => b.diff - a.diff).slice(0, n); 
  const hated = [...scored].sort((a, b) => a.diff - b.diff).slice(0, n); 

  return { loved, hated };
}

export function computeObscure(list, n = 50) {
  return [...list]
    .filter(a => a.popularity > 0 && a.my_status === 'Completed')
    .sort((a, b) => a.popularity - b.popularity)
    .slice(0, n);
}

// ── Completion rates (rings) ───────────────────────────────────────────────
export function computeCompletionRings(list) {
  const total     = list.length;
  const completed = list.filter(a => a.my_status === 'Completed').length;
  const scored    = list.filter(a => a.my_score > 0).length;
  const rewatched = list.filter(a => parseInt(a.watched) > (a.episodes || 0)).length;

  return [
    { label: 'Completion Rate', value: total ? Math.round(completed / total * 100) : 0, color: '#2ec97e' },
    { label: 'Scored',          value: total ? Math.round(scored    / total * 100) : 0, color: '#ffd166' },
    { label: 'Rewatched',       value: total ? Math.round(rewatched / total * 100) : 0, color: '#b76eff' },
  ];
}

// ── Scoring habits ─────────────────────────────────────────────────────────
export function computeScoringHabits(list) {
  const scored   = list.filter(a => a.my_score > 0);
  const unscored = list.length - scored.length;
  return [
    { label: 'Unscored entries', val: unscored,                                  color: '#6b7a96' },
    { label: 'Low  (1–4)',       val: scored.filter(a => a.my_score < 5).length, color: '#e85d26' },
    { label: 'Mid  (5–7)',       val: scored.filter(a => a.my_score >= 5 && a.my_score <= 7).length, color: '#ffd166' },
    { label: 'High (8–10)',      val: scored.filter(a => a.my_score > 7).length, color: '#2ec97e' },
  ];
}

// ── Avg completion % by status ─────────────────────────────────────────────
export function computeCompletionByStatus(list) {
  const statuses = ['Completed', 'Watching', 'On-Hold', 'Dropped', 'Plan to Watch'];
  return statuses.map(s => {
    const items = list.filter(a => a.my_status === s && a.episodes > 0);
    if (!items.length) return { status: s, pct: 0 };
    const avg = items.reduce((sum, a) =>
      sum + Math.min((parseInt(a.watched) || 0) / a.episodes * 100, 100), 0
    ) / items.length;
    return { status: s, pct: Math.round(avg) };
  });
}

