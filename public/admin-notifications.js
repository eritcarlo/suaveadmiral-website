// Admin Notification Manager - Shared across all admin pages
// This handles notification synchronization between different admin pages

class AdminNotificationManager {
  constructor() {
    this.storageKey = 'admin_notification_state';
    this.lastUpdateKey = 'admin_notification_last_update';
    this.setupEventListeners();
  }

  // Setup storage event listeners to sync across tabs/pages
  setupEventListeners() {
    // Listen for storage changes from other tabs/pages
    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey || e.key === this.lastUpdateKey) {
        this.loadNotificationStateFromStorage();
      }
    });

    // Listen for focus events to refresh notifications when user returns to tab
    window.addEventListener('focus', () => {
      this.checkForUpdates();
    });
  }

  // Load notification count from localStorage and update UI
  loadNotificationStateFromStorage() {
    try {
      const state = localStorage.getItem(this.storageKey);
      if (state) {
        const { count, timestamp } = JSON.parse(state);
        
        // Only use cached state if it's less than 30 seconds old
        const now = Date.now();
        if (now - timestamp < 30000) {
          this.updateNotificationCount(count);
          return;
        }
      }
    } catch (error) {
      console.error('Error loading notification state from storage:', error);
    }
    
    // If no valid cached state, fetch fresh data
    this.loadAdminNotifications();
  }

  // Save notification state to localStorage
  saveNotificationStateToStorage(count) {
    try {
      const state = {
        count: count,
        timestamp: Date.now()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(state));
      localStorage.setItem(this.lastUpdateKey, Date.now().toString());
    } catch (error) {
      console.error('Error saving notification state to storage:', error);
    }
  }

  // Check if we need to update (compare timestamps)
  checkForUpdates() {
    const lastUpdate = localStorage.getItem(this.lastUpdateKey);
    if (!lastUpdate || Date.now() - parseInt(lastUpdate) > 30000) {
      this.loadAdminNotifications();
    } else {
      this.loadNotificationStateFromStorage();
    }
  }

  // Update the notification count in the UI
  updateNotificationCount(count) {
    const countElem = document.getElementById('adminNotificationCount');
    if (countElem) {
      if (count > 0) {
        countElem.textContent = count;
        countElem.style.display = 'inline-block';
      } else {
        countElem.style.display = 'none';
      }
    }
  }

  // Load notifications from server and update storage
  async loadAdminNotifications() {
    try {
      const response = await fetch('/api/admin/notifications');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const count = data.notifications?.filter(n => !n.is_read).length || 0;
      
      this.updateNotificationCount(count);
      this.saveNotificationStateToStorage(count);
      
      return data;
    } catch (error) {
      console.error('Error loading admin notifications:', error);
      this.updateNotificationCount(0);
      return null;
    }
  }

  // Load dropdown notifications (for when dropdown is opened)
  async loadAdminDropdownNotifications() {
    const dropdownContent = document.getElementById('adminNotificationDropdownContent');
    if (!dropdownContent) return;

    dropdownContent.innerHTML = '<div class="notification-loading">Loading notifications...</div>';
    
    try {
      const response = await fetch('/api/admin/notifications');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const notifications = data.notifications || [];
      
      if (notifications.length === 0) {
        dropdownContent.innerHTML = '<div class="no-notifications">No new bookings.</div>';
        return;
      }
      
      dropdownContent.innerHTML = '';
      notifications.forEach(n => {
        const item = document.createElement('div');
        item.className = 'notification-dropdown-item' + (n.is_read ? '' : ' unread');
        item.innerHTML = `
          <div class="notification-message">${n.message}</div>
          <div class="notification-date">${n.date}</div>
        `;
        item.onclick = () => this.markAdminNotificationAsRead(n.id);
        dropdownContent.appendChild(item);
      });
    } catch (error) {
      console.error('Error loading dropdown notifications:', error);
      dropdownContent.innerHTML = '<div class="notification-loading">Failed to load notifications.</div>';
    }
  }

  // Mark single notification as read
  async markAdminNotificationAsRead(notificationId) {
    try {
      const response = await fetch('/api/admin/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });

      if (response.ok) {
        // Refresh notifications and sync across pages
        await this.loadAdminNotifications();
        this.loadAdminDropdownNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all notifications as read
  async markAllAdminNotificationsAsRead() {
    const markAllBtn = document.getElementById('adminMarkAllReadBtn');
    if (!markAllBtn) return;

    const originalText = markAllBtn.textContent;
    
    // Show loading state
    markAllBtn.textContent = 'Marking...';
    markAllBtn.disabled = true;
    
    try {
      const response = await fetch('/api/admin/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Update UI immediately
        this.updateNotificationCount(0);
        this.saveNotificationStateToStorage(0);
        
        // Update dropdown content
        const dropdownContent = document.getElementById('adminNotificationDropdownContent');
        if (dropdownContent) {
          dropdownContent.innerHTML = '<div class="no-notifications">All notifications marked as read!</div>';
        }
        
        // Broadcast the change to other tabs/pages
        this.broadcastNotificationUpdate();
        
        // Reload notifications after a short delay
        setTimeout(() => {
          this.loadAdminNotifications();
          this.loadAdminDropdownNotifications();
        }, 1000);
      } else {
        throw new Error('Server returned success: false');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      alert('Failed to mark all notifications as read. Please try again.');
    } finally {
      // Restore button state
      markAllBtn.textContent = originalText;
      markAllBtn.disabled = false;
    }
  }

  // Broadcast notification update to other tabs/pages
  broadcastNotificationUpdate() {
    // Update timestamp to trigger storage event in other tabs
    localStorage.setItem(this.lastUpdateKey, Date.now().toString());
    
    // Also dispatch a custom event for same-page updates
    window.dispatchEvent(new CustomEvent('adminNotificationUpdate', {
      detail: { source: 'markAllAsRead' }
    }));
  }

  // Setup the notification bell dropdown functionality
  setupNotificationBell() {
    const bell = document.getElementById('adminNotificationBell');
    const dropdown = document.getElementById('adminNotificationDropdown');
    const markAllBtn = document.getElementById('adminMarkAllReadBtn');
    
    if (bell && dropdown) {
      // Bell click handler
      bell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show')) {
          this.loadAdminDropdownNotifications();
        }
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!bell.contains(e.target)) {
          dropdown.classList.remove('show');
        }
      });
    }
    
    if (markAllBtn) {
      // Mark all as read button handler
      markAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.markAllAdminNotificationsAsRead();
      });
    }
  }

  // Initialize the notification manager
  init() {
    // Setup notification bell functionality
    this.setupNotificationBell();
    
    // Load initial notification state
    this.checkForUpdates();
    
    // Setup periodic refresh (every 30 seconds)
    setInterval(() => {
      this.loadAdminNotifications();
    }, 30000);
  }
}

// Create global instance
window.adminNotificationManager = new AdminNotificationManager();

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminNotificationManager.init();
});