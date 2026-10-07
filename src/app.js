import { renderStarIcon } from './components/star-icon.js';

const app = document.getElementById('app');

function render() {
  const hash = window.location.hash || '#/';
  app.innerHTML = `
    ${renderStarIcon()}
    <div style="padding: 20px;">
      <h1>Учень</h1>
      <p>Поточний маршрут: ${hash}</p>
      <p>Тут буде відображатися інтерфейс учня.</p>
    </div>
  `;
}

window.addEventListener('hashchange', render);
render();
