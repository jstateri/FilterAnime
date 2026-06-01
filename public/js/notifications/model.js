export async function fetchWatchingSchedules(watchingIds) {
  if (!watchingIds || !watchingIds.length) return [];
  const allMedia = [];
  const CHUNK = 50; 

  for (let i = 0; i < watchingIds.length; i += CHUNK) {
    const chunk = watchingIds.slice(i, i + CHUNK).map(Number);
    
    // FIX: Removed all illegal filtering arguments from 'airingSchedule'. 
    // The API will just give us the nodes, and our JS controller will handle the sorting!
    const query = `
      query($malIds: [Int]) {
        Page(page: 1, perPage: 50) {
          media(idMal_in: $malIds, status_in: [RELEASING, NOT_YET_RELEASED, FINISHED]) {
            idMal
            siteUrl
            title { english romaji }
            coverImage { large }
            airingSchedule {
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

export function getReadNotificationIds() {
  try { return JSON.parse(localStorage.getItem('readNotifications') || '[]'); }
  catch { return []; }
}

export function markAsRead(ids) {
  const current = new Set(getReadNotificationIds());
  ids.forEach(id => current.add(id));
  localStorage.setItem('readNotifications', JSON.stringify([...current]));
}