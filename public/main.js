// Modal Management
class ModalManager {
  constructor() {
    this.currentModal = null;
    this.initializeModals();
    this.setupEventListeners();
  }

  initializeModals() {
    this.loginModal = document.getElementById('loginModal');
    this.signupModal = document.getElementById('signupModal');
    this.termsModal = document.getElementById('termsModal');
    this.successModal = document.getElementById('successModal');
  }

  setupEventListeners() {
    // Login modal triggers
    document.getElementById('loginBtn').addEventListener('click', () => this.openModal('login'));
    document.getElementById('loginClose').addEventListener('click', () => this.closeModal());
    document.getElementById('switchToSignup').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchModal('signup');
    });

    // Signup modal triggers
    document.getElementById('signupBtn').addEventListener('click', () => this.openModal('signup'));
    document.getElementById('signupClose').addEventListener('click', () => this.closeModal());
    document.getElementById('switchToLogin').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchModal('login');
    });

    // Terms modal triggers
    document.getElementById('openTerms').addEventListener('click', (e) => {
      e.preventDefault();
      this.openTermsFromSignup();
    });
    document.getElementById('termsClose').addEventListener('click', () => {
      this.closeTermsModal();
    });

    // Success modal triggers
    document.getElementById('successClose').addEventListener('click', () => this.closeModal());
    document.getElementById('successOk').addEventListener('click', () => this.closeModal());

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', () => {
        // Check if this is the terms modal overlay
        if (overlay.parentElement.id === 'termsModal') {
          this.closeTermsModal();
        } else {
          this.closeModal();
        }
      });
    });

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentModal) {
        // Check if terms modal is visible
        if (this.termsModal && this.termsModal.style.display === 'flex') {
          this.closeTermsModal();
        } else {
          this.closeModal();
        }
      }
    });
  }

  openModal(modalType) {
    this.closeModal(); // Close any open modal first
    
    let modal;
    switch(modalType) {
      case 'login':
        modal = this.loginModal;
        break;
      case 'signup':
        modal = this.signupModal;
        break;
      case 'terms':
        modal = this.termsModal;
        break;
      case 'success':
        modal = this.successModal;
        break;
    }

    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
      document.body.classList.add('modal-open');
      this.currentModal = modal;
    }
  }

  closeModal() {
    if (this.currentModal) {
      this.currentModal.classList.remove('active');
      this.currentModal.style.display = 'none';
      document.body.classList.remove('modal-open');
      this.currentModal = null;
    }
  }

  switchModal(modalType) {
    this.closeModal();
    setTimeout(() => this.openModal(modalType), 150);
  }

  showSuccess(message, callback = null) {
    document.getElementById('successMessage').textContent = message;
    this.openModal('success');
    
    if (callback) {
      const successOk = document.getElementById('successOk');
      const newSuccessOk = successOk.cloneNode(true);
      successOk.parentNode.replaceChild(newSuccessOk, successOk);
      newSuccessOk.addEventListener('click', () => {
        this.closeModal();
        callback();
      });
    }
  }

  enableTermsCheckbox() {
    const checkbox = document.getElementById('termsCheckbox');
    const signupBtn = document.getElementById('signupSubmit');
    checkbox.disabled = false;
    this.updateSignupButton();
  }

  updateSignupButton() {
    const checkbox = document.getElementById('termsCheckbox');
    const signupBtn = document.getElementById('signupSubmit');
    signupBtn.disabled = !checkbox.checked;
  }

  openTermsFromSignup() {
    // Don't close the signup modal, just show terms on top
    const termsModal = this.termsModal;
    if (termsModal) {
      termsModal.classList.add('active');
      termsModal.style.display = 'flex';
      termsModal.style.zIndex = '10001'; // Higher than signup modal
    }
  }

  closeTermsModal() {
    // Close terms modal and return to signup modal
    const termsModal = this.termsModal;
    if (termsModal) {
      termsModal.classList.remove('active');
      termsModal.style.display = 'none';
      termsModal.style.zIndex = ''; // Reset z-index
    }
    this.enableTermsCheckbox();
    
    // Ensure signup modal is still visible
    if (this.signupModal) {
      this.signupModal.classList.add('active');
      this.signupModal.style.display = 'flex';
      this.currentModal = this.signupModal;
    }
  }
}

// Form Management
class FormManager {
  constructor(modalManager) {
    this.modalManager = modalManager;
    this.setupFormHandlers();
    this.setupPasswordToggles();
    this.setupRememberMe();
  }

  setupFormHandlers() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      this.handleLogin(e);
    });

    // Signup form
    document.getElementById('signupForm').addEventListener('submit', (e) => {
      this.handleSignup(e);
    });

    // Terms checkbox
    document.getElementById('termsCheckbox').addEventListener('change', () => {
      this.modalManager.updateSignupButton();
    });

    // Real-time password validation
    document.getElementById('signupPassword').addEventListener('input', (e) => {
      this.validatePasswordRealTime(e.target.value);
    });

    // Real-time confirm password validation
    document.getElementById('confirmPassword').addEventListener('input', (e) => {
      this.validateConfirmPasswordRealTime(e.target.value);
    });
  }

  setupPasswordToggles() {
    document.querySelectorAll('.toggle-password').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const input = toggle.previousElementSibling;
        const icon = toggle.querySelector('i');
        
        if (input.type === 'password') {
          input.type = 'text';
          icon.className = 'fas fa-eye-slash';
        } else {
          input.type = 'password';
          icon.className = 'fas fa-eye';
        }
      });
    });
  }

  setupRememberMe() {
    // Load remembered credentials on page load
    const isRemembered = localStorage.getItem('rememberMe') === 'true';
    if (isRemembered) {
      const email = localStorage.getItem('rememberedEmail');
      const password = localStorage.getItem('rememberedPassword');
      
      if (email && password) {
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = password;
        document.getElementById('rememberMe').checked = true;
      }
    }

    // Check for registration auto-fill on page load
    const registeredEmail = sessionStorage.getItem('registeredEmail');
    const registeredPassword = sessionStorage.getItem('registeredPassword');
    
    if (registeredEmail && registeredPassword) {
      document.getElementById('loginEmail').value = registeredEmail;
      document.getElementById('loginPassword').value = registeredPassword;
      
      sessionStorage.removeItem('registeredEmail');
      sessionStorage.removeItem('registeredPassword');
      
      this.modalManager.showSuccess("Welcome! Your login credentials have been auto-filled for your convenience.");
    }
  }

  autoFillLoginAfterSignup() {
    // Auto-fill login form after successful signup
    const registeredEmail = sessionStorage.getItem('registeredEmail');
    const registeredPassword = sessionStorage.getItem('registeredPassword');
    
    if (registeredEmail && registeredPassword) {
      const emailField = document.getElementById('loginEmail');
      const passwordField = document.getElementById('loginPassword');
      
      if (emailField && passwordField) {
        emailField.value = registeredEmail;
        passwordField.value = registeredPassword;
        
        // Add visual feedback with gentle highlight
        emailField.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
        passwordField.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
          emailField.style.backgroundColor = '';
          passwordField.style.backgroundColor = '';
        }, 3000);
        
        // Clean up session storage
        sessionStorage.removeItem('registeredEmail');
        sessionStorage.removeItem('registeredPassword');
        
        // Show helpful message
        setTimeout(() => {
          this.showLoginSuccessMessage('Your credentials have been auto-filled! You can now login directly.');
        }, 100);
      }
    }
  }

  showLoginSuccessMessage(message) {
    // Show a gentle success message in the login form
    const existingMessage = document.querySelector('.login-auto-fill-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const loginForm = document.getElementById('loginForm');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'login-auto-fill-message';
    messageDiv.innerHTML = `
      <div style="
        background: rgba(34, 197, 94, 0.1);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 15px;
        color: #16a34a;
        font-size: 14px;
        text-align: center;
        animation: fadeIn 0.3s ease;
      ">
        <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
        ${message}
      </div>
    `;
    
    loginForm.insertBefore(messageDiv, loginForm.firstChild);

    // Auto-remove message after 5 seconds
    setTimeout(() => {
      if (messageDiv && messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('loginSubmit');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Handle remember me
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
          localStorage.setItem('rememberedPassword', password);
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberedPassword');
          localStorage.removeItem('rememberMe');
        }

        this.modalManager.showSuccess('Login successful! Redirecting...', () => {
          setTimeout(() => {
            window.location.href = data.role === 'SUPERADMIN' ? '/superadmin' : 
                                  data.role === 'ADMIN' ? '/admin' : '/homepage';
          }, 1500);
        });
      } else {
        // Handle error response - server returns { error: "message" }
        this.showLoginError('❌ ' + (data.error || data.message || 'Login failed'));
      }
    } catch (error) {
      this.showLoginError('❌ Network error: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  async handleSignup(e) {
    e.preventDefault();

    const fullName = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = 'USER'; // Default role for all signups
    const termsChecked = document.getElementById('termsCheckbox').checked;

    // Validation
    if (!fullName) {
      this.modalManager.showSuccess('❌ Full name is required!');
      return;
    }

    // Check for real-time validation errors
    const hasPasswordErrors = document.querySelector('.password-validation-errors');
    const hasConfirmPasswordError = document.querySelector('.confirm-password-error');
    
    if (hasPasswordErrors || hasConfirmPasswordError) {
      this.modalManager.showSuccess('❌ Please fix the password errors before continuing!');
      return;
    }

    if (!this.validatePassword(password)) {
      return;
    }

    if (password !== confirmPassword) {
      this.modalManager.showSuccess('❌ Passwords do not match!');
      return;
    }

    if (!termsChecked) {
      this.modalManager.showSuccess('❌ Please accept the terms and conditions!');
      return;
    }

    const submitBtn = document.getElementById('signupSubmit');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
      // Start signup verification flow instead of direct register
      const response = await fetch('/api/signup-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password })
      });
      const data = await response.json();

      if (response.ok) {
        // Open verification modal
        const verifyModal = document.getElementById('signupVerifyModal');
        if (verifyModal) {
          verifyModal.classList.add('active');
          verifyModal.style.display = 'flex';
          document.body.classList.add('modal-open');
        }
        // Store email and password temporarily in session for auto-fill after verify
        sessionStorage.setItem('pendingSignupEmail', email);
        // also store the full name so resends can include it
        sessionStorage.setItem('pendingSignupName', fullName);
        sessionStorage.setItem('pendingSignupPassword', password);
        document.getElementById('signupVerifyMessage').textContent = '';
      } else {
        this.modalManager.showSuccess('❌ ' + (data.error || data.message || 'Failed to start signup'));
      }
    } catch (error) {
      this.modalManager.showSuccess('❌ Network error: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // Verification handlers
  async handleSignupVerify() {
    const code = document.getElementById('signupVerifyCode').value.trim();
    const email = sessionStorage.getItem('pendingSignupEmail');
    const password = sessionStorage.getItem('pendingSignupPassword');

    if (!code || !email) {
      document.getElementById('signupVerifyMessage').textContent = 'Please enter the verification code.';
      return;
    }

    document.getElementById('signupVerifySubmit').disabled = true;

    try {
      const res = await fetch('/api/signup-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const json = await res.json();
      if (res.ok) {
        // Close verify modal and show success, then autofill login
        const verifyModal = document.getElementById('signupVerifyModal');
        if (verifyModal) { verifyModal.classList.remove('active'); verifyModal.style.display = 'none'; document.body.classList.remove('modal-open'); }

        sessionStorage.setItem('registeredEmail', email);
        sessionStorage.setItem('registeredPassword', password);
        sessionStorage.removeItem('pendingSignupEmail');
        sessionStorage.removeItem('pendingSignupPassword');

        this.modalManager.showSuccess('Account created! Your login credentials have been saved for convenience.', () => {
          this.modalManager.switchModal('login');
          setTimeout(() => this.autoFillLoginAfterSignup(), 200);
        });
      } else {
        document.getElementById('signupVerifyMessage').textContent = json.error || json.message || 'Verification failed';
      }
    } catch (err) {
      document.getElementById('signupVerifyMessage').textContent = 'Network error: ' + err.message;
    } finally {
      document.getElementById('signupVerifySubmit').disabled = false;
    }
  }

  async handleSignupResend() {
    const email = sessionStorage.getItem('pendingSignupEmail');
    if (!email) return;
    try {
      const res = await fetch('/api/signup-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: sessionStorage.getItem('pendingSignupName') || '',
          email,
          password: sessionStorage.getItem('pendingSignupPassword') || ''
        })
      });
      const j = await res.json();
      document.getElementById('signupVerifyMessage').textContent = res.ok ? 'Verification code resent' : (j.error || 'Failed to resend');
    } catch (err) {
      document.getElementById('signupVerifyMessage').textContent = 'Network error: ' + err.message;
    }
  }

  validatePassword(password) {
    if (password.length < 8 || password.length > 16) {
      this.modalManager.showSuccess('❌ Password must be between 8 and 16 characters long!');
      return false;
    }

    const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
    if (!hasNumberOrSpecial) {
      this.modalManager.showSuccess('❌ Password must contain at least 1 number or special character!');
      return false;
    }

    return true;
  }

  validatePasswordRealTime(password) {
    // Remove existing indicators
    this.removePasswordIndicators();

    if (password.length === 0) {
      return;
    }

    // Create password strength indicator
    this.createPasswordStrengthIndicator(password);
    
    // Create validation messages
    this.createPasswordValidationMessages(password);
  }

  validateConfirmPasswordRealTime(confirmPassword) {
    const password = document.getElementById('signupPassword').value;
    const existingError = document.querySelector('.confirm-password-error');
    
    if (existingError) {
      existingError.remove();
    }

    if (confirmPassword.length > 0 && password !== confirmPassword) {
      this.showConfirmPasswordError('❌ Passwords do not match!');
    }
  }

  createPasswordStrengthIndicator(password) {
    const strength = this.calculatePasswordStrength(password);
    const passwordWrapper = document.getElementById('signupPassword').parentNode;
    
    const indicator = document.createElement('div');
    indicator.className = 'password-strength-indicator';
    indicator.innerHTML = `
      <div class="strength-bar">
        <div class="strength-fill ${strength.class}" style="width: ${strength.percentage}%"></div>
      </div>
      <div class="strength-text ${strength.class}">${strength.text}</div>
    `;
    
    passwordWrapper.insertAdjacentElement('afterend', indicator);
  }

  createPasswordValidationMessages(password) {
    const issues = this.getPasswordIssues(password);
    
    if (issues.length > 0) {
      const passwordWrapper = document.getElementById('signupPassword').parentNode;
      const errorDiv = document.createElement('div');
      errorDiv.className = 'password-validation-errors';
      errorDiv.innerHTML = issues.map(issue => `
        <div class="password-error-item">
          <i class="fas fa-times-circle"></i> ${issue}
        </div>
      `).join('');
      
      // Insert after strength indicator or password wrapper
      const strengthIndicator = document.querySelector('.password-strength-indicator');
      if (strengthIndicator) {
        strengthIndicator.insertAdjacentElement('afterend', errorDiv);
      } else {
        passwordWrapper.insertAdjacentElement('afterend', errorDiv);
      }
    }
  }

  calculatePasswordStrength(password) {
    let score = 0;
    let feedback = [];

    // Check if password exceeds 16 characters - show "Not Good"
    if (password.length > 16) {
      return { percentage: 30, text: 'Not Good', class: 'not-good' };
    }

    // Length check - give full points for 8-16 characters, bonus for 12+
    if (password.length >= 8 && password.length <= 16) {
      score += 25;
      if (password.length >= 12) {
        score += 10; // Bonus for longer passwords within range
      }
    }

    // Number check
    if (/[0-9]/.test(password)) {
      score += 20;
    }
    
    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 20;
    }

    // Uppercase letter
    if (/[A-Z]/.test(password)) {
      score += 15;
    }

    // Lowercase letter
    if (/[a-z]/.test(password)) {
      score += 15;
    }

    // Mixed case and numbers/specials bonus
    if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 10;
    }

    // Variety bonus for having multiple character types
    let varietyCount = 0;
    if (/[a-z]/.test(password)) varietyCount++;
    if (/[A-Z]/.test(password)) varietyCount++;
    if (/[0-9]/.test(password)) varietyCount++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) varietyCount++;
    
    if (varietyCount >= 3) {
      score += 10;
    }

    // Return strength classification
    if (score < 40) {
      return { percentage: Math.min(score, 100), text: 'Weak', class: 'weak' };
    } else if (score < 70) {
      return { percentage: Math.min(score, 100), text: 'Good', class: 'good' };
    } else if (score < 90) {
      return { percentage: Math.min(score, 100), text: 'Strong', class: 'strong' };
    } else {
      return { percentage: 100, text: 'Perfect', class: 'perfect' };
    }
  }

  getPasswordIssues(password) {
    const issues = [];

    if (password.length < 8) {
      issues.push('Password must be at least 8 characters long and maximum of 16 characters only');
    }
    
    if (password.length > 16) {
      issues.push('Password must be maximum of 16 characters only');
    }

    if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) {
      issues.push('Password must contain at least 1 number or special character');
    }

    return issues;
  }

  removePasswordIndicators() {
    const existingIndicator = document.querySelector('.password-strength-indicator');
    const existingErrors = document.querySelector('.password-validation-errors');
    
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    if (existingErrors) {
      existingErrors.remove();
    }
  }

  showConfirmPasswordError(message) {
    const confirmPasswordWrapper = document.getElementById('confirmPassword').parentNode;
    const errorDiv = document.createElement('div');
    errorDiv.className = 'confirm-password-error';
    errorDiv.innerHTML = `
      <div style="
        background: rgba(207, 12, 2, 0.1);
        border: 1px solid #cf0c02;
        border-radius: 8px;
        padding: 8px 12px;
        margin: 8px 0;
        color: #cf0c02;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <i class="fas fa-times-circle"></i> ${message}
      </div>
    `;
    
    confirmPasswordWrapper.insertAdjacentElement('afterend', errorDiv);
  }

  showLoginError(message) {
    // Remove any existing error message
    const existingError = document.querySelector('.login-error');
    if (existingError) {
      existingError.remove();
    }

    // Create error element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'login-error';
    errorDiv.innerHTML = `
      <div style="
        background: rgba(207, 12, 2, 0.1);
        border: 1px solid #cf0c02;
        border-radius: 8px;
        padding: 12px;
        margin: 10px 0;
        color: #cf0c02;
        font-size: 14px;
        text-align: center;
        animation: shake 0.5s ease-in-out;
      ">
        ${message}
      </div>
    `;

    // Insert error message above the login button
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginSubmit');
    loginForm.insertBefore(errorDiv, loginButton);

    // Auto-remove error after 5 seconds
    setTimeout(() => {
      if (errorDiv && errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 5000);
  }
}

// Navigation Management
class NavigationManager {
  constructor() {
    this.setupSmoothScrolling();
    this.setupActiveNavigation();
  }

  setupSmoothScrolling() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection) {
          const headerHeight = document.querySelector('.main-header').offsetHeight;
          const targetPosition = targetSection.offsetTop - headerHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }

  setupActiveNavigation() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
      let current = '';
      const headerHeight = document.querySelector('.main-header').offsetHeight;

      sections.forEach(section => {
        const sectionTop = section.offsetTop - headerHeight - 100;
        const sectionHeight = section.offsetHeight;
        
        if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
          current = section.getAttribute('id');
        }
      });

      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
          link.classList.add('active');
        }
      });
    });
  }
}

// Reviews Management
class ReviewsManager {
  constructor() {
    this.currentPage = 1;
    this.reviewsPerPage = 6;
    this.allReviews = [];
    this.setupReviews();
  }

  async setupReviews() {
    await this.loadReviews();
    this.setupLoadMoreButton();
  }

  async loadReviews() {
    try {
      const response = await fetch('/api/reviews');
      const data = await response.json();
      
      if (response.ok) {
        this.allReviews = data.reviews || [];
        this.updateReviewsStats(data);
        this.displayReviews();
      } else {
        this.showError('Failed to load reviews');
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      this.showError('Unable to connect to review service');
    }
  }

  updateReviewsStats(data) {
    const overallRating = document.getElementById('overallRating');
    const overallStars = document.getElementById('overallStars');
    const reviewCount = document.getElementById('reviewCount');

    if (data.averageRating) {
      overallRating.textContent = data.averageRating.toFixed(1);
      this.updateStarsDisplay(overallStars, data.averageRating);
    }

    if (data.totalCount !== undefined) {
      reviewCount.textContent = data.totalCount;
    }
  }

  updateStarsDisplay(container, rating) {
    const stars = container.querySelectorAll('i');
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    stars.forEach((star, index) => {
      star.className = 'fas fa-star';
      if (index < fullStars) {
        star.style.color = '#d4af37';
      } else if (index === fullStars && hasHalfStar) {
        star.className = 'fas fa-star-half-alt';
        star.style.color = '#d4af37';
      } else {
        star.style.color = '#444';
      }
    });
  }

  displayReviews() {
    const reviewsGrid = document.getElementById('reviewsGrid');
    const reviewsToShow = this.allReviews.slice(0, this.currentPage * this.reviewsPerPage);
    
    if (reviewsToShow.length === 0) {
      reviewsGrid.innerHTML = `
        <div class="review-loading">
          <i class="fas fa-comments"></i>
          <p>No reviews yet. Be the first to share your experience!</p>
        </div>
      `;
      return;
    }

    reviewsGrid.innerHTML = reviewsToShow.map(review => this.createReviewCard(review)).join('');
    this.updateLoadMoreButton();
  }

  createReviewCard(review) {
    const reviewDate = new Date(review.created_at);
    const formattedDate = reviewDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const initials = this.getInitials(review.name);
    const starsHtml = this.generateStarsHtml(review.rating);

    return `
      <div class="review-card">
        <div class="review-header">
          <div class="review-author">
            <div class="review-avatar">${initials}</div>
            <div class="review-info">
              <h4>${this.escapeHtml(review.name)}</h4>
              <div class="review-date">${formattedDate}</div>
            </div>
          </div>
          <div class="review-rating">${starsHtml}</div>
        </div>
        <p class="review-comment">"${this.escapeHtml(review.comment)}"</p>
      </div>
    `;
  }

  getInitials(name) {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  generateStarsHtml(rating) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= rating) {
        starsHtml += '<i class="fas fa-star"></i>';
      } else {
        starsHtml += '<i class="fas fa-star empty"></i>';
      }
    }
    return starsHtml;
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  setupLoadMoreButton() {
    const loadMoreBtn = document.getElementById('loadMoreReviews');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.currentPage++;
        this.displayReviews();
      });
    }
  }

  updateLoadMoreButton() {
    const loadMoreBtn = document.getElementById('loadMoreReviews');
    const hasMoreReviews = this.allReviews.length > this.currentPage * this.reviewsPerPage;
    
    if (loadMoreBtn) {
      loadMoreBtn.style.display = hasMoreReviews ? 'inline-flex' : 'none';
    }
  }

  showError(message) {
    const reviewsGrid = document.getElementById('reviewsGrid');
    reviewsGrid.innerHTML = `
      <div class="review-loading">
        <i class="fas fa-exclamation-triangle" style="color: #cf0c02;"></i>
        <p style="color: #cf0c02;">${message}</p>
      </div>
    `;
  }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const modalManager = new ModalManager();
  const formManager = new FormManager(modalManager);
  const navigationManager = new NavigationManager();
  const reviewsManager = new ReviewsManager();

  // Add loading animation
  setTimeout(() => {
    document.body.style.opacity = '1';
  }, 100);

  // Verify modal controls
  const verifyClose = document.getElementById('verifyClose');
  if (verifyClose) verifyClose.addEventListener('click', () => {
    const vm = document.getElementById('signupVerifyModal'); if (vm) { vm.classList.remove('active'); vm.style.display = 'none'; document.body.classList.remove('modal-open'); }
  });

  const signupVerifySubmit = document.getElementById('signupVerifySubmit');
  if (signupVerifySubmit) signupVerifySubmit.addEventListener('click', (e) => { e.preventDefault(); formManager.handleSignupVerify(); });
  const signupResendCode = document.getElementById('signupResendCode');
  if (signupResendCode) signupResendCode.addEventListener('click', (e) => { e.preventDefault(); formManager.handleSignupResend(); });
});

// Add smooth loading transition
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 0.3s ease';