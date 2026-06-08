/**
 * @fileoverview notifications/view.js - Notifications View Layer
 * 
 * Handles DOM manipulation and rendering for the notifications dropdown.
 * Operates strictly on data provided by the controller.
 */
import { escHtml } from '../view.js';
export function renderBell(onToggle) {
  // Inject the bell container into the topbar next to the tabs
  const container = document.createElement('div');
  container.className = 'notif-container';
  container.innerHTML = `
    <button class="notif-bell-btn" id="notifBellBtn">
      <i class="bi bi-bell-fill"></i>
      <span class="notif-badge" id="notifBadge" style="display:none">0</span>
    </button>
    <div class="notif-dropdown" id="notifDropdown"></div>
  `;
  const target = document.querySelector('#topbar .d-flex.align-items-center.gap-2');
  if (target) target.insertBefore(container, target.firstChild);

  document.getElementById('notifBellBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    onToggle();
  });
}

export function setDropdownVisible(isVisible) {
  const dd = document.getElementById('notifDropdown');
  if (dd) isVisible ? dd.classList.add('show') : dd.classList.remove('show');
}

export function updateBadge(unreadCount) {
  const badge = document.getElementById('notifBadge');
  const btn = document.getElementById('notifBellBtn');
  if (!badge || !btn) return;

  if (unreadCount > 0) {
    badge.style.display = 'block';
    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    btn.classList.add('has-unread');
  } else {
    badge.style.display = 'none';
    btn.classList.remove('has-unread');
  }
}

export function renderDropdown(notifications, upcoming, readIds, onMarkAsRead, currentTab, onTabSwitch, onNotificationClick) {
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;

  const activeList = currentTab === 'new' ? notifications : upcoming;
  const isNewTab = currentTab === 'new';

  let html = `
    <div class="notif-header">
      <div class="notif-tabs-container">
        <button class="notif-tab-btn ${isNewTab ? 'active' : ''}" id="tabNew">
          New <span class="notif-count-pill">${notifications.length}</span>
        </button>
        <button class="notif-tab-btn ${!isNewTab ? 'active' : ''}" id="tabUpcoming">
          Upcoming <span class="notif-count-pill">${upcoming.length}</span>
        </button>
      </div>
      ${isNewTab ? `
        <div class="notif-mark-read" id="btnMarkRead">
          <i class="bi bi-check-circle-fill"></i> Mark as read
        </div>
      ` : ''}
    </div>
    <div class="notif-list">
  `;

  if (activeList.length === 0) {
    html += `<div class="notif-empty">No ${isNewTab ? 'new' : 'upcoming'} episodes.</div>`;
  } else {
    activeList.forEach(n => {
      // Only highlight unread if we are in the 'new' tab
      const isUnread = isNewTab && !readIds.includes(n.id);
      const timeStr = isNewTab ? _timeAgo(n.airingAt) : _timeUntil(n.airingAt);
      const actionText = isNewTab ? "Available!" : "Airing";
      
      html += `
        <div class="notif-item ${isUnread ? 'unread' : ''}" data-id="${n.id}" style="cursor: pointer;">
          <img src="${escHtml(n.cover)}" class="notif-cover" alt="" loading="lazy">
          <div class="notif-content">
            <div class="notif-title-row">
              <span class="notif-title-main">${escHtml(n.title)}</span> / 
              <span class="notif-title-ep">Episode ${escHtml(n.episode)} ${actionText}</span>
            </div>
            <div class="notif-time">${timeStr}</div>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;
  dd.innerHTML = html;

  // Bind Listeners
  const markReadBtn = document.getElementById('btnMarkRead');
  if (markReadBtn && isNewTab && notifications.length > 0) {
    markReadBtn.addEventListener('click', (e) => { e.stopPropagation(); onMarkAsRead(); });
  }

  document.getElementById('tabNew').addEventListener('click', (e) => {
    e.stopPropagation(); onTabSwitch('new');
  });
  document.getElementById('tabUpcoming').addEventListener('click', (e) => {
    e.stopPropagation(); onTabSwitch('upcoming');
  });

  dd.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(el.dataset.id);
      const notif = activeList.find(n => n.id === id);
      if (notif && onNotificationClick) {
        onNotificationClick(notif);
      }
    });
  });
}

function _timeAgo(unixStamp) {
  const diff = Math.floor(Date.now() / 1000) - unixStamp;
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function _timeUntil(unixStamp) {
  const diff = unixStamp - Math.floor(Date.now() / 1000);
  
  if (diff <= 0) return "Airing right now!";
  
  // Calculate raw time units
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  
  // Format the output string based on how much time is left
  if (d > 0) {
    return `In ${d}d ${h}h ${m}m`;
  } else if (h > 0) {
    return `In ${h}h ${m}m`;
  } else {
    return `In ${m}m`;
  }
}