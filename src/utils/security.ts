// src/utils/security.ts
export const protectApp = () => {
  // Only run in production
  if (import.meta.env.MODE !== 'production') return;

  // 1. Disable right-click
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // 2. Block common dev tools shortcuts
  document.addEventListener('keydown', (e) => {
    const shortcuts = [
      e.key === 'F12',
      e.ctrlKey && e.shiftKey && ['I', 'J'].includes(e.key.toUpperCase()),
      e.ctrlKey && e.key === 'u'
    ];
    
    if (shortcuts.some(Boolean)) {
      e.preventDefault();
      return false;
    }
  });

  // 3. Clear console in production
  console.clear();
};