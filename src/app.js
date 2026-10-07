import { initStudentApp } from './student/app.js';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.error('SW registration failed:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initStudentApp();
});
