/**
 * @fileoverview recs/model.js - Recommendations Model Layer
 * 
 * Implements the recommendation algorithm. Fetches AniList recommendations for the
 * user's top-rated anime, and aggregates them using a weighted multiplier based on
 * the user's score for the source anime.
 */

/**
 * Fetches and aggregates recommendations based on the user's top-rated anime.
 * 
 * @param {Array} myList - The user's anime list.
 * @returns {Promise<Array>} Aggregated, sorted array of recommended anime.
 */
export async function computeRecommendations(myList) {
  // 1. Identify Top Source Anime
  // We prioritize high-scored anime, but if the user has few scored anime, we fallback to completed ones.
  const scored = myList.filter(a => a.my_score >= 7)
                       .sort((a, b) => b.my_score - a.my_score);
  
  const fallback = myList.filter(a => a.my_score < 7 && a.my_status === 'Completed');
  const topSources = [...scored, ...fallback].slice(0, 20);

  if (topSources.length === 0) return [];

  const sourceMalIds = topSources.map(a => parseInt(a.id)).filter(id => !isNaN(id));

  // 2. Fetch Bulk Recommendations via AniList
  const query = `
    query($ids: [Int]) {
      Page(page: 1, perPage: 20) {
        media(idMal_in: $ids) {
          id
          idMal
          title { romaji english native }
          recommendations(sort: RATING_DESC, perPage: 10) {
            nodes {
              rating
              mediaRecommendation {
                id
                idMal
                title { romaji english native }
                coverImage { large medium }
                bannerImage
                format
                type
                isAdult
                averageScore
                episodes
                status
                startDate { year }
                genres
                description(asHtml: false)
                studios(isMain: true) { nodes { name } }
              }
            }
          }
        }
      }
    }
  `;

  let mediaNodes = [];
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { ids: sourceMalIds } })
    });
    const data = await res.json();
    mediaNodes = data?.data?.Page?.media || [];
  } catch (err) {
    console.error("Failed to fetch bulk recommendations:", err);
    return [];
  }

  // 3. Aggregate and Weight Recommendations
  const recMap = new Map(); // idMal -> recommendation data

  mediaNodes.forEach(sourceMedia => {
    // Find the user's score for this source anime (fallback to 7 if unscored)
    const localAnime = myList.find(a => parseInt(a.id) === sourceMedia.idMal);
    const userScore = (localAnime && localAnime.my_score > 0) ? localAnime.my_score : 7;
    const sourceTitle = sourceMedia.title.english || sourceMedia.title.romaji || 'Unknown';

    const recs = sourceMedia.recommendations?.nodes || [];
    recs.forEach(recNode => {
      const recAnime = recNode.mediaRecommendation;
      if (!recAnime || !recAnime.idMal) return;

      // Filter out non-anime and adult content
      if (recAnime.isAdult) return;
      if (recAnime.type !== 'ANIME') return;

      const rating = recNode.rating || 0;
      if (rating <= 0) return; // Ignore negatively rated recs

      // The Magic Multiplier: User Score / 10 * Rating
      const weight = (userScore / 10) * rating;

      if (!recMap.has(recAnime.idMal)) {
        recMap.set(recAnime.idMal, {
          anime: recAnime,
          totalWeight: 0,
          reasons: [] // Array of source anime titles
        });
      }

      const entry = recMap.get(recAnime.idMal);
      entry.totalWeight += weight;
      if (!entry.reasons.includes(sourceTitle)) {
        entry.reasons.push(sourceTitle);
      }
    });
  });

  // 4. Sort by total weight
  const sortedRecs = Array.from(recMap.values()).sort((a, b) => b.totalWeight - a.totalWeight);
  
  return sortedRecs;
}
