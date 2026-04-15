// js/ui.js - Shared UI utilities

/**
 * Format currency to EUR
 */
function formatCurrency(value) {
    if (value === null || value === undefined) return '€ --';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

/**
 * Common modal toggling
 */
function toggleModal(id, show = true) {
    const modal = document.getElementById(id);
    if (modal) {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    }
}

/**
 * Status Badge Generator
 */
function getStatusBadge(status) {
    const labels = {
        'Available': 'Disponível',
        'Sold': 'Vendido',
        'EmptySlot': 'Vazio',
        'Removed': 'Removido',
        'Pendente': 'Pendente',
        'Contactado': 'Contactado',
        'Fechado': 'Fechado'
    };
    
    let colorClass = 'status-badge';
    if (['Available', 'Contactado'].includes(status)) colorClass += ' active';
    else if (['Sold', 'Fechado'].includes(status)) colorClass += ' inactive';
    else if (['Pendente', 'EmptySlot'].includes(status)) colorClass += ' warning';
    
    return `<span class="${colorClass}">${labels[status] || status}</span>`;
}

/**
 * Generic Pagination Renderer
 * Works with both named functions and anonymous arrow functions.
 */
const _paginationCallbacks = {};

function renderPagination(containerId, current, total, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container || total <= 1) {
        if (container) container.innerHTML = '';
        return;
    }

    // Store callback globally so the inline onclick string can reach it
    _paginationCallbacks[containerId] = onPageChange;

    const callExpr = (page) => `_paginationCallbacks['${containerId}'](${page})`;

    let html = `<div style="display:flex; align-items:center; gap:12px;">`;
    
    // Prev
    if (current === 1) {
        html += `<button class="btn btn-secondary" disabled style="opacity:0.3; cursor:not-allowed;"><i class="fa-solid fa-chevron-left"></i></button>`;
    } else {
        html += `<button class="btn btn-secondary" onclick="${callExpr(current - 1)}"><i class="fa-solid fa-chevron-left"></i></button>`;
    }

    // Page Info
    html += `<span style="font-size:0.9rem; font-weight:600; color:var(--text-muted); min-width:100px; text-align:center;">Página ${current} de ${total}</span>`;
    
    // Next
    if (current === total) {
        html += `<button class="btn btn-secondary" disabled style="opacity:0.3; cursor:not-allowed;"><i class="fa-solid fa-chevron-right"></i></button>`;
    } else {
        html += `<button class="btn btn-secondary" onclick="${callExpr(current + 1)}"><i class="fa-solid fa-chevron-right"></i></button>`;
    }

    html += `</div>`;
    container.innerHTML = html;
}

window.formatCurrency = formatCurrency;
window.toggleModal = toggleModal;
window.getStatusBadge = getStatusBadge;
window.renderPagination = renderPagination;
window._paginationCallbacks = _paginationCallbacks;

