document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'index.html' });
    });
  }
});
