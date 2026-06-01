import { fetchWatchingSchedules, getReadNotificationIds, markAsRead } from './model.js';
import { renderBell, renderDropdown, updateBadge, setDropdownVisible } from './view.js';
import { myAnimeList } from '../state.js';

let notifications = [];
let isOpen = false;

export async function initNotifications() {
  renderBell(toggleDropdown);
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !e.target.closest('.notif-container')) {
      isOpen = false;
      setDropdownVisible(false);
    }
  });
  
  await refreshNotifications();
}

export async function refreshNotifications() {
  const watching = myAnimeList.filter(a => a.my_status === 'Watching');
  if (!watching.length) {
    notifications = [];
    _refreshUI();
    return;
  }

  const mediaList = await fetchWatchingSchedules(watching.map(a => a.id));
  const now = Math.floor(Date.now() / 1000);
  
  // ADD THIS LINE: Define lookback period (e.g., 30 days in seconds)
  const LOOKBACK_LIMIT = 120 * 24 * 60 * 60; 
  
  const newNotifs = [];

  mediaList.forEach(media => {
    const local = watching.find(a => parseInt(a.id) === media.idMal);
    if (!local) return;
    const watchedEp = parseInt(local.watched) || 0;

    (media.airingSchedule?.nodes || []).forEach(node => {
      // UPDATED CONDITION: Checks that episode is newer than watched count
      // AND that the air date is within your LOOKBACK_LIMIT
      if (node.episode > watchedEp && 
          node.airingAt <= now && 
          (now - node.airingAt) <= LOOKBACK_LIMIT) {
        
        newNotifs.push({
          id: node.id,
          mediaIdMal: media.idMal,
          title: media.title?.english || media.title?.romaji || 'Unknown',
          cover: media.coverImage?.large,
          episode: node.episode,
          airingAt: node.airingAt,
          siteUrl: media.siteUrl
        });
      }
    });
  });

  notifications = newNotifs.sort((a, b) => b.airingAt - a.airingAt);
  _refreshUI();
}

function _refreshUI() {
  const readIds = getReadNotificationIds();
  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;
  updateBadge(unreadCount);
  renderDropdown(notifications, readIds, handleMarkAsRead);
}

function toggleDropdown() {
  isOpen = !isOpen;
  setDropdownVisible(isOpen);
}

function handleMarkAsRead() {
  const unreadIds = notifications.map(n => n.id);
  markAsRead(unreadIds);
  _refreshUI();
}