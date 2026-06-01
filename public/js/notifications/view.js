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

export function renderDropdown(notifications, readIds, onMarkAsRead) {
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;

  const total = notifications.length;
  
  let html = `
    <div class="notif-header">
      <div class="notif-tab">Anime <span class="notif-count-pill">${total}</span></div>
      <div class="notif-mark-read" id="btnMarkRead">
        <i class="bi bi-check-circle-fill"></i> Mark as read
      </div>
    </div>
    <div class="notif-list">
  `;

  if (total === 0) {
    html += `<div class="notif-empty">No new episodes available.</div>`;
  } else {
    notifications.forEach(n => {
      const isUnread = !readIds.includes(n.id);
      const timeStr = _timeAgo(n.airingAt);
      
      html += `
        <a href="${n.siteUrl}" target="_blank" rel="noopener" class="notif-item ${isUnread ? 'unread' : ''}">
          <img src="${n.cover}" class="notif-cover" alt="">
          <div class="notif-content">
            <div class="notif-title-row">
              <span class="notif-title-main">${n.title}</span> / 
              <span class="notif-title-ep">Episode ${n.episode} Available!</span>
            </div>
            <div class="notif-time">${timeStr}</div>
          </div>
        </a>
      `;
    });
  }

  html += `</div>`;
  dd.innerHTML = html;

  const markReadBtn = document.getElementById('btnMarkRead');
  if (markReadBtn && total > 0) {
    markReadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onMarkAsRead();
    });
  }
}

function _timeAgo(unixStamp) {
  const diff = Math.floor(Date.now() / 1000) - unixStamp;
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}