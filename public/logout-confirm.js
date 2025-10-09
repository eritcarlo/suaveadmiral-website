(function(){
  // Prevent double-inclusion
  if (window.__logoutConfirmInitialized) return;
  window.__logoutConfirmInitialized = true;

  // Insert styles
  const style = document.createElement('style');
  style.textContent = `
    #logoutConfirmModal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);z-index:12000}
    #logoutConfirmModal .box{background:#fff;color:#111;padding:18px;border-radius:10px;max-width:420px;width:90%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25)}
    #logoutConfirmModal .actions{display:flex;gap:12px;justify-content:center;margin-top:14px}
    #logoutConfirmModal .confirm{background:#cf0c02;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600}
    #logoutConfirmModal .cancel{background:#6b7280;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-weight:600}
  `;
  document.head.appendChild(style);

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'logoutConfirmModal';
  modal.innerHTML = `
    <div class="box" role="dialog" aria-modal="true" aria-labelledby="logoutConfirmTitle">
      <h3 id="logoutConfirmTitle">Confirm Logout</h3>
      <p>Are you sure you want to log out?</p>
      <div class="actions">
        <button class="confirm">Yes, log me out</button>
        <button class="cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const confirmBtn = modal.querySelector('.confirm');
  const cancelBtn = modal.querySelector('.cancel');

  function showModal(){ modal.style.display='flex'; document.body.style.overflow='hidden'; }
  function hideModal(){ modal.style.display='none'; document.body.style.overflow=''; }

  // Capture-phase click listener to intercept logout clicks before other handlers
  document.addEventListener('click', function(e){
    try{
      const el = e.target.closest ? e.target.closest('#logoutBtn') : (e.target.id === 'logoutBtn' ? e.target : null);
      if (!el) return;
      // Intercept
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      showModal();
    }catch(err){ /* ignore */ }
  }, true);

  cancelBtn.addEventListener('click', function(){ hideModal(); });
  modal.addEventListener('click', function(e){ if (e.target === modal) hideModal(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') hideModal(); });

  confirmBtn.addEventListener('click', async function(){
    // show a simple loading state
    confirmBtn.disabled = true; confirmBtn.textContent = 'Logging out...';
    try{
      const res = await fetch('/api/logout', { method: 'POST' });
      if (res.ok) {
        // Redirect to main
        window.location.href = '/main';
      } else {
        alert('Logout failed. Please try again.');
        hideModal();
      }
    }catch(err){
      alert('Logout failed. Please try again.');
      hideModal();
    } finally {
      confirmBtn.disabled = false; confirmBtn.textContent = 'Yes, log me out';
    }
  });
})();
