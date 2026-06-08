/**
 * @fileoverview notifications/model.js - Notifications Model Layer
 * 
 * Responsible for fetching airing schedules from AniList and managing
 * read states for notifications in localStorage.
 */

/**
 * Fetches airing schedules from AniList for a list of anime IDs.
 * 
 * @param {number[]} watchingIds - Array of MAL IDs currently being watched.
 * @returns {Promise<Array>} Array of media objects with their airing schedules.
 */
export async function fetchWatchingSchedules(watchingIds) {
  if (!watchingIds || !watchingIds.length) return [];
  const allMedia = [];
  const CHUNK = 50; 

  for (let i = 0; i < watchingIds.length; i += CHUNK) {
    const chunk = watchingIds.slice(i, i + CHUNK).map(Number);
    

    const query = `
      query($malIds: [Int]) {
        Page(page: 1, perPage: 50) {
          media(idMal_in: $malIds, status_in: [RELEASING, NOT_YET_RELEASED, FINISHED]) {
            id
            idMal
            siteUrl
            title { english romaji }
            coverImage { large }
            airingSchedule(perPage: 25) {
              nodes {
                id
                episode
                airingAt
              }
            }
          }
        }
      }
    `;

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { malIds: chunk } })
      });
      const data = await res.json();
      
      if (data.errors) {
        console.error("AniList API Error:", data.errors);
      }
      
      if (data?.data?.Page?.media) allMedia.push(...data.data.Page.media);
    } catch (e) {
      console.warn("Failed to fetch schedules chunk:", e);
    }
  }
  return allMedia;
}

/**
 * Retrieves the set of read notification IDs from localStorage.
 * @returns {number[]} Array of read notification IDs.
 */
export function getReadNotificationIds() {
  try { return JSON.parse(localStorage.getItem('readNotifications') || '[]'); }
  catch { return []; }
}

/**
 * Persists newly read notification IDs to localStorage.
 * @param {number[]} ids - Array of notification IDs to mark as read.
 */
export function markAsRead(ids) {
  const current = new Set(getReadNotificationIds());
  ids.forEach(id => current.add(id));
  localStorage.setItem('readNotifications', JSON.stringify([...current]));
}