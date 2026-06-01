/**
 * @fileoverview notifications/controller.js - Notifications Controller
 * 
 * Orchestrates the notification system. Listens for user interactions on the bell icon,
 * fetches schedule data via the model for currently watched anime, and delegates rendering
 * to the view layer.
 */
import { fetchWatchingSchedules, getReadNotificationIds, markAsRead } from './model.js';
import { renderBell, renderDropdown, updateBadge, setDropdownVisible } from './view.js';
import { myAnimeList } from '../state.js';

let notifications = [];
let upcoming = [];
let isOpen = false;
let currentTab = 'new'; // Can be 'new' or 'upcoming'

export async function initNotifications() {
  renderBell(toggleDropdown);
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
    upcoming = [];
    _refreshUI();
    return;
  }

  const mediaList = await fetchWatchingSchedules(watching.map(a => a.id));
  const now = Math.floor(Date.now() / 1000);
  
  const LOOKBACK_LIMIT = 30 * 24 * 60 * 60; // 30 Days past
  const LOOKAHEAD_LIMIT = 8 * 24 * 60 * 60;
  
  const newNotifs = [];
  const upcomingNotifs = [];

  mediaList.forEach(media => {
    const local = watching.find(a => parseInt(a.id) === media.idMal);
    if (!local) return;
    const watchedEp = parseInt(local.watched) || 0;

    (media.airingSchedule?.nodes || []).forEach(node => {
      // Only process episodes we haven't watched yet
      if (node.episode > watchedEp) {
        const item = {
          id: node.id,
          mediaIdMal: media.idMal,
          title: media.title?.english || media.title?.romaji || 'Unknown',
          cover: media.coverImage?.large,
          episode: node.episode,
          airingAt: node.airingAt,
          siteUrl: media.siteUrl
        };

        // If it aired in the past 30 days
        if (node.airingAt <= now && (now - node.airingAt) <= LOOKBACK_LIMIT) {
          newNotifs.push(item);
        } 
        // If it airs in the next 14 days
        else if (node.airingAt > now && (node.airingAt - now) <= LOOKAHEAD_LIMIT) {
          upcomingNotifs.push(item);
        }
      }
    });
  });

  // Sort: Newest missed episodes at the top
  notifications = newNotifs.sort((a, b) => b.airingAt - a.airingAt);
  // Sort: Closest upcoming episodes at the top
  upcoming = upcomingNotifs.sort((a, b) => a.airingAt - b.airingAt);
  
  _refreshUI();
}

function _refreshUI() {
  const readIds = getReadNotificationIds();
  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;
  updateBadge(unreadCount);
  renderDropdown(notifications, upcoming, readIds, handleMarkAsRead, currentTab, handleTabSwitch);
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

function handleTabSwitch(tabName) {
  currentTab = tabName;
  _refreshUI();
}