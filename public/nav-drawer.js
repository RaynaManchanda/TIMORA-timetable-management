/**
 * TIMORA - Navigation drawer
 * On small screens the sidebar is an off-canvas drawer. This module opens and
 * closes it and keeps the toggle button's accessibility state in sync.
 */

const DRAWER_BREAKPOINT_PX = 960;

const appLayout = document.getElementById('app');
const toggleButton = document.getElementById('btn-nav-toggle');
const backdrop = document.getElementById('sidebar-backdrop');
const sidebar = document.getElementById('sidebar');

/**
 * Open or close the drawer and update the toggle button's ARIA state.
 *
 * @param {boolean} isOpen Whether the drawer should be open.
 * @returns {void}
 */
function setDrawerOpen(isOpen) {
  appLayout.classList.toggle('nav-open', isOpen);
  toggleButton.setAttribute('aria-expanded', String(isOpen));
  toggleButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
}

/**
 * Close the drawer. Called after navigation, on Escape and when the window grows.
 *
 * @returns {void}
 */
function closeDrawer() {
  setDrawerOpen(false);
}

/**
 * Attach all drawer event listeners.
 *
 * @returns {void}
 */
function initNavDrawer() {
  if (!appLayout || !toggleButton || !backdrop || !sidebar) return;

  toggleButton.addEventListener('click', () => setDrawerOpen(!appLayout.classList.contains('nav-open')));
  backdrop.addEventListener('click', closeDrawer);
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('.nav-item')) closeDrawer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });
  window.matchMedia(`(min-width: ${DRAWER_BREAKPOINT_PX + 1}px)`).addEventListener('change', closeDrawer);
}

initNavDrawer();
