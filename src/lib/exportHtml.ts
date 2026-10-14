import type { Category, Ticket } from "../types";
import { fmtDate, todayISO } from "./util";

export interface ExportResult {
  fileName: string;
  ticketCount: number;
  withPhotos: number;
}

export async function exportHTML(
  tickets: Ticket[],
  categories: Category[]
): Promise<ExportResult> {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const sorted = [...tickets].sort((a, b) => b.date.localeCompare(a.date));
  const withPhotos = sorted.filter((t) => t.photo).length;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TicketBox - Archivo de Tickets</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #0B132B 0%, #1C2541 100%);
      color: #F8F9FA;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      background: rgba(30, 41, 59, 0.6);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #70D6FF, #00B4D8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .stats {
      display: flex;
      gap: 16px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .stat {
      background: rgba(0, 180, 216, 0.1);
      border: 1px solid rgba(0, 180, 216, 0.3);
      border-radius: 12px;
      padding: 12px 20px;
      flex: 1;
      min-width: 140px;
    }
    .stat-label { font-size: 12px; color: #8CA3C3; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-value { font-size: 24px; font-weight: 600; color: #70D6FF; margin-top: 4px; }
    .filters {
      background: rgba(30, 41, 59, 0.6);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filter-btn {
      background: rgba(0, 180, 216, 0.1);
      border: 1px solid rgba(0, 180, 216, 0.3);
      color: #F8F9FA;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s;
    }
    .filter-btn:hover { background: rgba(0, 180, 216, 0.2); }
    .filter-btn.active {
      background: linear-gradient(135deg, #00B4D8, #70D6FF);
      color: #04222E;
      font-weight: 600;
    }
    .search {
      flex: 1;
      min-width: 200px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 8px 16px;
      color: #F8F9FA;
      font-size: 14px;
    }
    .search::placeholder { color: #8CA3C3; }
    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }
    .ticket-card {
      background: rgba(30, 41, 59, 0.6);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s;
      cursor: pointer;
    }
    .ticket-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      border-color: rgba(0, 180, 216, 0.3);
    }
    .ticket-photo {
      width: 100%;
      height: 200px;
      object-fit: cover;
      background: #0E1C3A;
      cursor: zoom-in;
    }
    .ticket-photo-placeholder {
      width: 100%;
      height: 200px;
      background: linear-gradient(135deg, #1C2541, #0B132B);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #8CA3C3;
      font-size: 48px;
    }
    .ticket-content { padding: 16px; }
    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 12px;
    }
    .ticket-store {
      font-size: 18px;
      font-weight: 600;
      color: #F8F9FA;
    }
    .ticket-date {
      font-size: 12px;
      color: #8CA3C3;
      margin-top: 4px;
    }
    .ticket-total {
      font-size: 24px;
      font-weight: 700;
      color: #70D6FF;
      font-variant-numeric: tabular-nums;
    }
    .ticket-category {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }
    .ticket-items {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .ticket-items-title {
      font-size: 12px;
      color: #8CA3C3;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .ticket-item {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #F8F9FA;
      padding: 4px 0;
    }
    .ticket-item-name { flex: 1; }
    .ticket-item-price {
      font-variant-numeric: tabular-nums;
      color: #70D6FF;
      margin-left: 12px;
    }
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(8px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .modal.active { display: flex; }
    .modal-content {
      max-width: 90vw;
      max-height: 90vh;
      position: relative;
    }
    .modal-image {
      max-width: 100%;
      max-height: 90vh;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    .modal-close {
      position: absolute;
      top: -40px;
      right: 0;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #F8F9FA;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    }
    .modal-close:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: rotate(90deg);
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #8CA3C3;
    }
    .empty-state-icon { font-size: 64px; margin-bottom: 16px; }
    @media (max-width: 768px) {
      .tickets-grid { grid-template-columns: 1fr; }
      .filters { flex-direction: column; align-items: stretch; }
      .search { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🧾 Archivo de Tickets</h1>
      <div class="stats">
        <div class="stat">
          <div class="stat-label">Total Tickets</div>
          <div class="stat-value">${tickets.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Con Foto</div>
          <div class="stat-value">${withPhotos}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Gasto Total</div>
          <div class="stat-value">${tickets.reduce((a, t) => a + t.total, 0).toFixed(2).replace('.', ',')} €</div>
        </div>
      </div>
    </header>

    <div class="filters">
      <button class="filter-btn active" data-filter="all">Todos</button>
      ${categories.map((c) => `<button class="filter-btn" data-filter="${c.id}">${c.name}</button>`).join('')}
      <input type="text" class="search" placeholder="Buscar por tienda o producto..." id="search">
    </div>

    <div class="tickets-grid" id="ticketsGrid">
      ${sorted
        .map((t) => {
          const cat = catById.get(t.category);
          return `
        <div class="ticket-card" data-category="${t.category}" data-store="${t.store.toLowerCase()}" data-items="${t.items.map((i) => i.name.toLowerCase()).join(' ')}">
          ${
            t.photo
              ? `<img src="${t.photo}" alt="Ticket de ${t.store}" class="ticket-photo" onclick="openModal('${t.photo.replace(/'/g, "\\'")}')">`
              : `<div class="ticket-photo-placeholder">📄</div>`
          }
          <div class="ticket-content">
            <div class="ticket-header">
              <div>
                <div class="ticket-store">${t.store}</div>
                <div class="ticket-date">${fmtDate(t.date)}</div>
              </div>
              <div class="ticket-total">${t.total.toFixed(2).replace('.', ',')} €</div>
            </div>
            ${cat ? `<span class="ticket-category" style="background: ${cat.color}20; color: ${cat.color}; border: 1px solid ${cat.color}40;">${cat.name}</span>` : ''}
            ${
              t.items.length > 0
                ? `
              <div class="ticket-items">
                <div class="ticket-items-title">Productos (${t.items.length})</div>
                ${t.items
                  .slice(0, 3)
                  .map((i) => `<div class="ticket-item"><span class="ticket-item-name">${i.qty > 1 ? i.qty + '× ' : ''}${i.name}</span><span class="ticket-item-price">${(i.qty * i.price).toFixed(2).replace('.', ',')} €</span></div>`)
                  .join('')}
                ${t.items.length > 3 ? `<div class="ticket-item" style="color: #8CA3C3; font-style: italic;">...y ${t.items.length - 3} más</div>` : ''}
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;
        })
        .join('')}
    </div>

    <div class="empty-state" id="emptyState" style="display: none;">
      <div class="empty-state-icon">🔍</div>
      <p>No se encontraron tickets con esos filtros</p>
    </div>
  </div>

  <div class="modal" id="modal" onclick="closeModal(event)">
    <div class="modal-content">
      <button class="modal-close" onclick="closeModal()">&times;</button>
      <img src="" alt="Ticket ampliado" class="modal-image" id="modalImage">
    </div>
  </div>

  <script>
    // Filtros
    const filterBtns = document.querySelectorAll('.filter-btn');
    const searchInput = document.getElementById('search');
    const ticketsGrid = document.getElementById('ticketsGrid');
    const emptyState = document.getElementById('emptyState');
    let currentFilter = 'all';

    function applyFilters() {
      const searchTerm = searchInput.value.toLowerCase();
      const cards = ticketsGrid.querySelectorAll('.ticket-card');
      let visibleCount = 0;

      cards.forEach((card) => {
        const category = card.dataset.category;
        const store = card.dataset.store;
        const items = card.dataset.items;

        const matchesFilter = currentFilter === 'all' || category === currentFilter;
        const matchesSearch = !searchTerm || store.includes(searchTerm) || items.includes(searchTerm);

        if (matchesFilter && matchesSearch) {
          card.style.display = 'block';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        applyFilters();
      });
    });

    searchInput.addEventListener('input', applyFilters);

    // Modal de imagen
    function openModal(src) {
      const modal = document.getElementById('modal');
      const modalImage = document.getElementById('modalImage');
      modalImage.src = src;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeModal(event) {
      if (event && event.target !== event.currentTarget && !event.target.classList.contains('modal-close')) return;
      const modal = document.getElementById('modal');
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ticketbox_${todayISO()}.html`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);

  return {
    fileName: `ticketbox_${todayISO()}.html`,
    ticketCount: tickets.length,
    withPhotos,
  };
}
