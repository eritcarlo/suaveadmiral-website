// Profile Picture Manager - Shared across all pages
// This file handles real-time profile picture updates

class ProfileManager {
  constructor() {
    this.defaultProfilePic = 'default-profile.svg'; // Updated default profile picture
    this.currentProfilePic = null;
    this.init();
  }

  init() {
    // Load profile picture on page load
    this.loadProfilePicture();
    
    // Set up event listeners for profile picture updates
    this.setupEventListeners();
  }

  // Load profile picture from server
  async loadProfilePicture() {
    try {
      const response = await fetch('/api/user-info');
      const data = await response.json();
      
      if (data.success && data.user) {
        const profilePic = data.user.profile_pic || this.defaultProfilePic;
        this.updateAllProfilePictures(profilePic);
        this.currentProfilePic = profilePic;
        
        // Store in localStorage for faster loading
        localStorage.setItem('profilePic', profilePic);
      } else {
        // User not logged in or error, use default
        this.updateAllProfilePictures(this.defaultProfilePic);
      }
    } catch (error) {
      console.error('Error loading profile picture:', error);
      // Fallback to localStorage or default
      const storedPic = localStorage.getItem('profilePic');
      this.updateAllProfilePictures(storedPic || this.defaultProfilePic);
    }
  }

  // Update profile picture across all elements on the page
  updateAllProfilePictures(imageData) {
    // List of common profile picture element IDs/classes
    const profileSelectors = [
      '#navbar-profile-pic',
      '#profile-pic',
      '.profile img',
      '.user-profile-pic',
      '[data-profile-pic]'
    ];

    profileSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element && element.tagName === 'IMG') {
          element.src = imageData;
        }
      });
    });

    this.currentProfilePic = imageData;
  }

  // Upload new profile picture
  async uploadProfilePicture(file) {
    console.log("uploadProfilePicture called with file:", file);
    
    if (!file) return { success: false, error: 'No file provided' };

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log("File type validation failed:", file.type);
      return { success: false, error: 'Please select an image file' };
    }

    // Validate file size (15MB limit - increased for high-quality photos)
    if (file.size > 15 * 1024 * 1024) {
      console.log("File size validation failed:", file.size);
      return { success: false, error: 'File size must be less than 15MB' };
    }

    try {
      console.log("Converting file to base64...");
      // Convert file to base64 with compression
      const imageData = await this.fileToBase64WithCompression(file);
      console.log("Base64 conversion complete, length:", imageData.length);
      
      // Update UI immediately for better UX
      this.updateAllProfilePictures(imageData);
      
      console.log("Sending request to server...");
      // Send to server
      const response = await fetch('/api/update-profile-pic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageData })
      });

      console.log("Server response status:", response.status);
      console.log("Server response headers:", response.headers);
      
      if (!response.ok) {
        console.log("Response not OK, status:", response.status);
        const errorText = await response.text();
        console.log("Error response text:", errorText);
        
        // Try to parse as JSON, fallback to text
        let errorMessage = 'Upload failed';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        // Revert on error
        this.updateAllProfilePictures(this.currentProfilePic);
        return { success: false, error: errorMessage };
      }
      
      const result = await response.json();
      console.log("Server response:", result);
      
      if (result.success) {
        // Update localStorage
        localStorage.setItem('profilePic', imageData);
        
        // Broadcast update to other tabs/windows
        this.broadcastProfileUpdate(imageData);
        
        return { success: true, message: 'Profile picture updated successfully' };
      } else {
        // Revert on error
        this.updateAllProfilePictures(this.currentProfilePic);
        return { success: false, error: result.error || 'Upload failed' };
      }
    } catch (error) {
      console.error('Upload error:', error);
      // Revert on error
      this.updateAllProfilePictures(this.currentProfilePic);
      return { success: false, error: 'Upload failed' };
    }
  }

  // Convert file to base64
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Convert file to base64 with compression
  fileToBase64WithCompression(file) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Set maximum dimensions while maintaining aspect ratio
        const maxWidth = 800;
        const maxHeight = 800;
        
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with compression (0.8 quality)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        console.log('Original size:', file.size, 'Compressed base64 length:', compressedBase64.length);
        resolve(compressedBase64);
      };
      
      img.onerror = reject;
      
      // Create object URL for the image
      img.src = URL.createObjectURL(file);
    });
  }

  // Broadcast profile picture update to other tabs
  broadcastProfileUpdate(imageData) {
    // Use localStorage event to communicate between tabs
    localStorage.setItem('profilePicUpdate', JSON.stringify({
      imageData,
      timestamp: Date.now()
    }));
  }

  // Set up event listeners
  setupEventListeners() {
    // Listen for profile picture updates from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'profilePicUpdate') {
        try {
          const updateData = JSON.parse(event.newValue);
          if (updateData && updateData.imageData) {
            this.updateAllProfilePictures(updateData.imageData);
          }
        } catch (error) {
          console.error('Error parsing profile update:', error);
        }
      }
    });

    // Set up file input listeners (if they exist on the page)
    document.addEventListener('change', async (event) => {
      if (event.target.id === 'profile-pic-input' || 
          event.target.classList.contains('profile-pic-input')) {
        const file = event.target.files[0];
        if (file) {
          const result = await this.uploadProfilePicture(file);
          
          // Show user feedback
          if (result.success) {
            this.showMessage('Profile picture updated successfully!', 'success');
          } else {
            this.showMessage(result.error || 'Upload failed', 'error');
          }
        }
      }
    });

    // Handle profile picture clicks (for upload)
    document.addEventListener('click', (event) => {
      if (event.target.hasAttribute('data-profile-upload')) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (file) {
            const result = await this.uploadProfilePicture(file);
            if (result.success) {
              this.showMessage('Profile picture updated successfully!', 'success');
            } else {
              this.showMessage(result.error || 'Upload failed', 'error');
            }
          }
        };
        input.click();
      }
    });
  }

  // Show user feedback message
  showMessage(message, type = 'info') {
    // Create or update notification
    let notification = document.getElementById('profile-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'profile-notification';
      notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        transition: all 0.3s ease;
        transform: translateX(400px);
      `;
      document.body.appendChild(notification);
    }

    // Set message and color based on type
    notification.textContent = message;
    notification.style.backgroundColor = type === 'success' ? '#10b981' : 
                                       type === 'error' ? '#ef4444' : '#3b82f6';
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Animate out after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Reset to default profile picture
  async resetToDefault() {
    const result = await this.uploadProfilePicture(null);
    if (result.success) {
      this.updateAllProfilePictures(this.defaultProfilePic);
      localStorage.removeItem('profilePic');
    }
    return result;
  }

  // Get current profile picture
  getCurrentProfilePic() {
    return this.currentProfilePic || this.defaultProfilePic;
  }
}

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if not already initialized
  if (!window.profileManager) {
    window.profileManager = new ProfileManager();
  }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProfileManager;
}