// Alias for app.js
document.addEventListener('DOMContentLoaded', () => {
    if (typeof renderPortfolio === 'function' && !window._appInitialized) {
        window._appInitialized = true;
    }
});
