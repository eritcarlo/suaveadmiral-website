// Final confirmation modal function
function showFinalConfirmModal() {
  return new Promise((resolve) => {
    const finalModal = document.createElement('div');
    finalModal.className = 'modal';
    finalModal.style.cssText = 'display: block; z-index: 1002;'; // Higher z-index than first modal
    finalModal.innerHTML = `
      <div class="modal-content" style="text-align: center; max-width: 320px; margin: 30vh auto; padding: 20px;">
        <span class="close-final-confirm" style="position: absolute; right: 15px; top: 8px; font-size: 20px; cursor: pointer; color: #666;">&times;</span>
        <div style="margin: 10px 0;">
          <i class="fas fa-exclamation-triangle" style="color: #dc3545; font-size: 36px; margin-bottom: 12px;"></i>
          <h3 style="color: #dc3545; margin: 0 0 10px; font-size: 18px;">Final Warning</h3>
          <p style="font-size: 0.95em; margin: 0 0 8px; color: #333;">Are you absolutely sure?</p>
          <p style="color: #666; font-size: 0.8em; font-style: italic; margin: 0 0 15px;">This action cannot be undone.</p>
        </div>
        <div style="display: flex; justify-content: center; gap: 8px;">
          <button class="final-no-btn" style="background: #6c757d; color: white; padding: 6px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;">No, Keep It</button>
          <button class="final-yes-btn" style="background: #dc3545; color: white; padding: 6px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;">Yes, Cancel It</button>
        </div>
      </div>
    `;
    document.body.appendChild(finalModal);

    const cleanup = () => {
      finalModal.remove();
    };

    const yesBtn = finalModal.querySelector('.final-yes-btn');
    const noBtn = finalModal.querySelector('.final-no-btn');
    const closeBtn = finalModal.querySelector('.close-final-confirm');

    yesBtn.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    noBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    closeBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    finalModal.addEventListener('click', (e) => {
      if (e.target === finalModal) {
        cleanup();
        resolve(false);
      }
    });

    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  });
}