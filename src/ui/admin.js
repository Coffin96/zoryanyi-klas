import { navigate } from './app.js';
import { getActiveProfiles } from '../data/repo.js';
import { db } from '../data/firebase.js';
import { doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateQRUrl } from '../engine/qr-protocol.js';

export async function renderAdmin(root) {
  root.innerHTML = `
    <div class="container">
      <div class="top-bar">
        <button id="btn-back" class="primary">← До списку учнів</button>
        <h2 style="margin:0;">Адміністрування</h2>
        <button id="btn-to-scanner" class="primary">📷 Сканер</button>
      </div>

      <div class="surface-card flex flex-col gap-md" style="margin-bottom: var(--spacing-md);">
        <h3 style="margin:0;">➕ Створення учнів</h3>
        <p class="text-muted text-sm" style="margin:0;">Введіть вигадані псевдоніми учнів (по одному на рядок, до 24 символів). Наприклад:<br><em>Лис-01<br>Сокіл-02<br>Рись-03</em></p>
        <textarea id="aliases-input" rows="5" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--muted); background: var(--bg); color: var(--text); font-family: inherit; font-size: 14px;"></textarea>
        <button id="btn-create-batch" class="primary" style="padding: 10px;">Створити учнів</button>
      </div>

      <div class="surface-card flex flex-col gap-md">
        <h3 style="margin:0;">🖨️ Друк карток</h3>
        <p class="text-muted text-sm" style="margin:0;">Згенерувати аркуш із QR-кодами, псевдонімами та посиланнями для всіх активних учнів.</p>
        <button id="btn-print-cards" class="primary" style="padding: 10px;">Згенерувати картки для друку</button>
      </div>
    </div>
  `;

  document.getElementById('btn-back').addEventListener('click', () => {
    navigate('student-list');
  });

  document.getElementById('btn-to-scanner').addEventListener('click', () => {
    navigate('scanner');
  });

  document.getElementById('btn-create-batch').addEventListener('click', async () => {
    const text = document.getElementById('aliases-input').value;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l.length <= 24);
    if (lines.length === 0) {
      alert('Будь ласка, введіть хоча б один псевдонім.');
      return;
    }

    if (!confirm(`Створити ${lines.length} учнів?`)) return;

    const btn = document.getElementById('btn-create-batch');
    btn.disabled = true;
    btn.textContent = 'Створення...';

    try {
      const batch = writeBatch(db);
      
      lines.forEach(alias => {
        const pid = crypto.randomUUID();
        const pRef = doc(db, "profiles", pid);
        batch.set(pRef, {
          alias: alias,
          archived: false,
          balance: 0,
          earned: 0,
          recent: [],
          hot: [],
          last: null,
          lastOp: null,
          lastAt: {},
          stats: { gradeCount: {}, quests: {}, redeemed: {} },
          counters: {},
          achievements: [],
          v: 1
        });
      });

      await batch.commit();
      document.getElementById('aliases-input').value = '';
      alert(`Успішно створено ${lines.length} учнів!`);
      navigate('student-list');
    } catch (err) {
      console.error(err);
      alert('Помилка: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Створити учнів';
    }
  });

  document.getElementById('btn-print-cards').addEventListener('click', async () => {
    try {
      const profiles = await getActiveProfiles();
      if (profiles.length === 0) {
        alert('Немає активних учнів для друку. Спочатку створіть учнів.');
        return;
      }

      // Generate HTML for printing
      let printContent = `
        <!DOCTYPE html>
        <html><head><title>Картки учнів — Зоряний клас</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, sans-serif; margin: 0; padding: 15mm; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8mm; }
          .card { border: 2px dashed #333; padding: 6mm; text-align: center; border-radius: 8px; page-break-inside: avoid; }
          .title { font-size: 16px; font-weight: bold; margin: 0 0 4px 0; color: #181d45; }
          .alias { font-size: 22px; font-weight: bold; margin: 6px 0; }
          .qr { margin: 6px 0; }
          .qr img { width: 140px; height: 140px; display: inline-block; }
          .url { font-size: 10px; color: #444; word-break: break-all; margin: 4px 0; font-family: monospace; }
          .hint { font-size: 11px; color: #666; margin: 4px 0 0 0; }
          @media print {
            body { padding: 5mm; }
          }
        </style>
        </head><body><div class="grid">
      `;

      profiles.forEach(p => {
        const url = generateQRUrl({ type: 'P', uuid: p.id, alias: p.alias });
        const qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        const qrImg = qr.createImgTag(4, 0);

        printContent += `
          <div class="card">
            <div class="title">✦ Зоряний клас</div>
            <div class="qr">${qrImg}</div>
            <div class="alias">${p.alias}</div>
            <div class="url">${url}</div>
            <p class="hint">Відскануй камерою телефона, щоб відкрити свій баланс</p>
          </div>
        `;
      });

      printContent += `</div></body></html>`;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);

    } catch (err) {
      console.error(err);
      alert('Помилка генерації карток: ' + err.message);
    }
  });
}
