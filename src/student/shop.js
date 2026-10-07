export function renderShop(root, state) {
  const p = state.profile;
  const c = state.config;
  const shop = c.shop || [];

  root.innerHTML = `
    <div class="container">
      <h2>Магазин</h2>
      <p class="text-muted" style="margin-bottom: var(--spacing-md);">Покажи свій QR вчителю, щоб придбати.</p>
      
      <div class="flex flex-col gap-sm">
        ${shop.map(item => {
          const percent = Math.min(100, Math.floor((p.balance / item.price) * 100));
          const canAfford = p.balance >= item.price;
          
          return `
            <div class="surface-card">
              <div class="flex justify-between items-center" style="margin-bottom: var(--spacing-sm);">
                <div class="flex items-center gap-sm">
                  <span style="font-size: 24px;">${item.icon}</span>
                  <div>
                    <div style="font-weight: bold;">${item.name}</div>
                    <div class="text-muted" style="font-size: 12px;">${item.desc}</div>
                  </div>
                </div>
                <div style="font-weight: bold; font-size: 18px; color: ${canAfford ? 'var(--ok)' : 'var(--text)'};">
                  ${item.price} ✦
                </div>
              </div>
              <div style="width: 100%; background: var(--bg); height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="width: ${percent}%; background: ${canAfford ? 'var(--ok)' : 'var(--star)'}; height: 100%;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
