import { navigate } from './app.js';
import { getActiveProfiles } from '../data/repo.js';
import { db } from '../data/firebase.js';
import { doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { generateQRUrl } from '../engine/qr-protocol.js';

export async function renderAdmin(root) {
  root.innerHTML = `
    <div class="container">
      <div class="top-bar">
        <button id="btn-back" class="primary">Назад</button>
        <h2 style="margin:0;">Адміністрування</h2>
        <div></div>
      </div>

      <div class="surface-card flex flex-col gap-md">
        <h3>Створення учнів</h3>
        <p class="text-muted text-sm">Введіть псевдоніми по одному на рядок (макс. 24 символи)</p>
        <textarea id="aliases-input" rows="5" style="width: 100%; padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--muted); background: var(--bg); color: var(--text);"></textarea>
        <button id="btn-create-batch" class="primary">Створити учнів</button>
      </div>

      <div class="surface-card flex flex-col gap-md" style="margin-top: var(--spacing-md);">
        <h3>Друк карток</h3>
        <button id="btn-print-cards" class="primary">Згенерувати картки для друку</button>
      </div>
    </div>
  `;

  document.getElementById('btn-back').addEventListener('click', () => {
    navigate('student-list');
  });

  document.getElementById('btn-create-batch').addEventListener('click', async () => {
    const text = document.getElementById('aliases-input').value;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l.length <= 24);
    if (lines.length === 0) return;

    if (!confirm(`Створити ${lines.length} профілів?`)) return;

    const btn = document.getElementById('btn-create-batch');
    btn.disabled = true;
    btn.textContent = 'Створення...';

    try {
      // Chunk batches of 500 max, but we'll likely have ~17.
      const batch = writeBatch(db);
      const nowMs = Date.now();
      
      lines.forEach(alias => {
        const pid = crypto.randomUUID();
        const pRef = doc(db, "profiles", pid);
        batch.set(pRef, {
          alias: alias,
          archived: false,
          balance: 0,
          earned: 0,
          recent: [],
          hot: 0,
          last: 0,
          lastOp: "",
          lastAt: nowMs,
          stats: { grades: 0, quests: 0, items: 0 },
          counters: {},
          achievements: {},
          v: 1
        });
      });

      await batch.commit();
      document.getElementById('aliases-input').value = '';
      alert(`Створено ${lines.length} учнів!`);
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
        alert('Немає учнів для друку');
        return;
      }

      // Generate HTML for printing
      let printContent = `
        <html><head><title>Картки учнів</title>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 20mm; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10mm; }
          .card { border: 2px dashed #000; padding: 10mm; text-align: center; border-radius: 10px; page-break-inside: avoid; }
          .alias { font-size: 24px; font-weight: bold; margin-top: 10px; }
          .qr { margin-top: 10px; }
          .qr img { width: 150px; height: 150px; }
          @media print {
            body { padding: 0; }
          }
        </style>
        </head><body><div class="grid">
      `;

      profiles.forEach(p => {
        const url = generateQRUrl({ type: 'P', uuid: p.id, alias: p.alias });
        const qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        const qrImg = qr.createImgTag(5, 0);

        printContent += `
          <div class="card">
            <h2>Зоряний клас</h2>
            <div class="qr">${qrImg}</div>
            <div class="alias">${p.alias}</div>
            <p style="font-size: 12px; color: #555;">(Збільши яскравість екрана при скануванні)</p>
          </div>
        `;
      });

      printContent += `</div></body></html>`;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      
      // We give it a moment to render images before calling print
      setTimeout(() => {
        printWindow.print();
      }, 500);

    } catch (err) {
      console.error(err);
      alert('Помилка генерації');
    }
  });
}
