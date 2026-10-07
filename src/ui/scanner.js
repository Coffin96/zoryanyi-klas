import { navigate, appState, showToast } from './app.js';
import { parseQR } from '../engine/qr-protocol.js';
import { getProfile } from '../data/repo.js';
import { texts } from '../i18n/uk.js';
import { logoutTeacher } from '../data/firebase.js';

let stream = null;
let scanInterval = null;

export function renderScanner(root) {
  root.innerHTML = `
    <div class="container">
      <div class="top-bar">
        <h2 style="margin:0;">Сканер</h2>
        <button id="btn-logout" class="danger">Вийти</button>
      </div>

      <div class="scanner-container">
        <video id="scanner-video" class="scanner-video" playsinline></video>
        <div class="scanner-overlay"></div>
      </div>
      
      <p id="scanner-msg" class="text-center text-muted">Наведи на QR учня</p>
      
      <div class="flex flex-col gap-md" style="margin-top: var(--spacing-lg);">
        <button id="btn-list" class="primary">Вибрати учня зі списку</button>
      </div>
    </div>
  `;

  document.getElementById('btn-logout').addEventListener('click', () => {
    stopScanner();
    logoutTeacher();
  });

  document.getElementById('btn-list').addEventListener('click', () => {
    stopScanner();
    navigate('student-list');
  });

  startScanner();
}

async function startScanner() {
  const video = document.getElementById('scanner-video');
  const msgEl = document.getElementById('scanner-msg');
  if (!video) return;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    video.setAttribute("playsinline", true);
    await video.play();
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    scanInterval = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // window.jsQR comes from vendor/jsQR.min.js
        const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data) {
          handleScan(code.data);
        }
      }
    }, 250);
  } catch (err) {
    console.error(err);
    msgEl.textContent = texts.scan.noCamera;
    msgEl.classList.add('error-text');
  }
}

export function stopScanner() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
}

let isProcessing = false;

async function handleScan(data) {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const nowMs = Date.now();
    const qrData = parseQR(data, nowMs); // throws Error on invalid
    
    if (qrData.type === 'P') {
      const profile = await getProfile(qrData.uuid);
      stopScanner();
      navigate('student-panel', { student: { uuid: profile.id, alias: profile.alias } });
    } else if (qrData.type === 'R') {
      const profile = await getProfile(qrData.uuid);
      stopScanner();
      navigate('student-panel', { student: { uuid: profile.id, alias: profile.alias }, order: qrData.item });
    } else {
      throw new Error("unsupported-qr");
    }
  } catch (err) {
    console.error(err);
    const msgEl = document.getElementById('scanner-msg');
    if (msgEl) {
      msgEl.textContent = texts.scan.unknown;
      msgEl.style.color = 'var(--danger)';
      setTimeout(() => {
        if (msgEl) {
          msgEl.textContent = 'Наведи на QR учня';
          msgEl.style.color = 'var(--muted)';
        }
      }, 3000);
    }
  } finally {
    setTimeout(() => { isProcessing = false; }, 2000); // debounce
  }
}
