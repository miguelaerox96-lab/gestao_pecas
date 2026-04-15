// js/catalog.js - Public Catalog Logic

// State
let parts = [];
let vehicles = [];
let types = [];
let brands = [];
let currentView = 'parts'; // 'parts', 'Para Peças', 'Salvado'
let currentPage = 1;
const ITEMS_PER_PAGE = 20;
let currentFilteredItems = [];
let globalAvailableParts = 0;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Always fetch fresh sorted data from the server (cache removed to guarantee sort order)
        sessionStorage.removeItem('atp_metadata');

        const [brandingRes, typesRes, brandsRes, statsRes] = await Promise.all([
            fetch(`${API_BASE}/branding`),
            fetch(`${API_BASE}/types`),
            fetch(`${API_BASE}/brands`),
            fetch(`${API_BASE}/parts/stats`)
        ]);
        
        const branding = await brandingRes.json();
        types  = await typesRes.json();
        brands = await brandsRes.json();
        const stats = await statsRes.json();
        
        globalAvailableParts = stats.available;

        applyBranding(branding);
        populateFilters();
        updateGlobalStats();
        
        switchCatalog('parts');
        setupInquiryForm();
        checkDeepLink();
    } catch (err) {
        console.error("Erro ao carregar catálogo", err);
        const grid = document.getElementById('catalog-grid');
        if (grid) grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Erro ao ligar ao servidor. Tente novamente.</p></div>';
    }
});


function applyBranding(data) {
    if (!data) return;
    const name = data.name || 'Auto Parts Stock';
    const subtitle = data.subtitle || 'Peças Automóveis Usadas';
    const logoUrl = data.logo_url || null;

    const nameEl = document.getElementById('navbar-brand-name');
    const subEl = document.getElementById('navbar-brand-sub');
    const logoIconEl = document.getElementById('navbar-logo-icon');

    if (nameEl) nameEl.textContent = name;
    if (subEl) subEl.textContent = subtitle;
    
    if (logoIconEl) {
        if (logoUrl) {
            const fullLogoUrl = `${API_BASE}${logoUrl}?t=${Date.now()}`;
            logoIconEl.innerHTML = `<img src="${fullLogoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;">`;
            logoIconEl.style.background = 'transparent';
        } else {
            logoIconEl.innerHTML = '<i class="fa-solid fa-wrench"></i>';
            logoIconEl.style.background = '';
        }
    }

    const footerEl = document.getElementById('site-footer-text');
    if (footerEl) {
        footerEl.textContent = `\u00A9 ${new Date().getFullYear()} ${name} \u00B7 ${subtitle}`;
    }
    document.title = `${name} \u2014 Catálogo`;
}

function updateGlobalStats() {
    let label = globalAvailableParts;
    if (globalAvailableParts >= 1000) {
        label = `Mais de ${Math.floor(globalAvailableParts / 1000)} mil`;
    } else if (globalAvailableParts >= 100) {
        label = `Mais de ${Math.floor(globalAvailableParts / 100) * 100}`;
    }
    const statsEl = document.getElementById('stats-count');
    if (statsEl) statsEl.textContent = label;
}

// SearchableSelect instances for the public catalog filters
let _catalogTypeSelect = null;
let _catalogBrandSelect = null;

function populateFilters() {
    const brandSel = document.getElementById('filter-brand');
    const typeSel  = document.getElementById('filter-type');

    // Sort alphabetically (case-insensitive) — frontend safety net
    const sortedBrands = [...brands].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    const sortedTypes  = [...types].sort((a, b)  => a.name.localeCompare(b.name, 'pt'));
    
    if (brandSel) {
        const opts = [
            { value: '', label: 'Todas as Marcas' },
            ...sortedBrands.map(b => ({ value: b.name, label: b.name }))
        ];

        // Populate native select as fallback
        brandSel.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

        // Destroy previous instance if any
        if (_catalogBrandSelect) {
            _catalogBrandSelect.destroy();
            _catalogBrandSelect = null;
        }

        _catalogBrandSelect = new SearchableSelect(brandSel, opts, {
            placeholder:       'Todas as Marcas',
            searchPlaceholder: 'Pesquisar marca...',
            inline:            true,  // transparent, for use inside filter bar
            onChange: () => filterItems()
        });
    }

    if (typeSel) {
        const opts = [
            { value: '', label: 'Todos os Tipos' },
            ...sortedTypes.map(t => ({ value: String(t.id), label: t.name }))
        ];

        // Populate native select as fallback
        typeSel.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

        // Destroy previous instance if any
        if (_catalogTypeSelect) {
            _catalogTypeSelect.destroy();
            _catalogTypeSelect = null;
        }

        _catalogTypeSelect = new SearchableSelect(typeSel, opts, {
            placeholder:       'Todos os Tipos',
            searchPlaceholder: 'Pesquisar tipo...',
            inline:            true,  // transparent, for use inside filter bar
            onChange: () => filterItems()
        });
    }
}




window.toggleFilters = () => {
    const panel = document.getElementById('filter-panel');
    const btn = document.getElementById('filter-toggle-btn');
    if (panel) {
        const isHidden = panel.classList.toggle('hidden');
        if (btn) btn.classList.toggle('active', !isHidden);
    }
};

window.switchCatalog = async (view) => {
    currentView = view;
    currentPage = 1;

    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    const activeTab = document.getElementById('tab-' + view.replace(/ /g, '-')); // Handle spaces in view names for IDs
    if (activeTab) activeTab.classList.add('active');
    
    // Toggle filters panel visibility 
    const typeFilterGroup = document.getElementById('filter-type')?.parentElement;
    const heroTitle = document.getElementById('hero-title');
    const heroSub = document.getElementById('hero-subtitle');

    if (view === 'parts') {
        if (typeFilterGroup) typeFilterGroup.style.display = '';
        const searchWrap = document.getElementById('filter-search-wrap');
        // Search only shows after a dropdown is selected
        const brand = document.getElementById('filter-brand')?.value || '';
        const typeId = document.getElementById('filter-type')?.value || '';
        if (searchWrap) searchWrap.style.display = (brand || typeId) ? '' : 'none';
        if (heroTitle) heroTitle.innerHTML = "Catálogo de Peças<br>Automóveis";
        if (heroSub) heroSub.textContent = "Selecione uma Marca ou Tipo para pesquisar as peças disponíveis.";
    } else {
        if (typeFilterGroup) typeFilterGroup.style.display = 'none';
        const searchWrap = document.getElementById('filter-search-wrap');
        if (searchWrap) searchWrap.style.display = 'none';
        if (heroTitle) heroTitle.innerHTML = view === 'Salvado' ? "Carros Salvados" : "Carros para Peças";
        if (heroSub) heroSub.textContent = view === 'Salvado' ? "Veículos para recuperação ou venda direta." : "Veículos completos disponíveis para desmantelamento.";
    }

    await loadItems();
};

window.filterItems = async () => {
    currentPage = 1;
    // Show/hide search box based on whether a dropdown filter is active
    const brand = document.getElementById('filter-brand')?.value || '';
    const typeId = document.getElementById('filter-type')?.value || '';
    const searchWrap = document.getElementById('filter-search-wrap');
    if (searchWrap) {
        if (currentView === 'parts') {
            searchWrap.style.display = (brand || typeId) ? '' : 'none';
            // Clear search when dropdown filters are cleared
            if (!brand && !typeId) {
                const s = document.getElementById('filter-search');
                if (s) s.value = '';
            }
        }
    }
    await loadItems();
};

function showSkeletons() {
    const grid = document.getElementById('catalog-grid');
    if (!grid) return;
    
    let html = '';
    for(let i=0; i<6; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-img skeleton"></div>
                <div class="skeleton-body">
                    <div class="skeleton-line title skeleton"></div>
                    <div class="skeleton-line text skeleton"></div>
                    <div class="skeleton-line tags skeleton"></div>
                    <div class="skeleton-line footer skeleton"></div>
                </div>
            </div>`;
    }
    grid.innerHTML = html;
}

async function loadItems() {
    const brand = document.getElementById('filter-brand')?.value || '';
    const typeId = document.getElementById('filter-type')?.value || '';
    const search = document.getElementById('filter-search')?.value || '';
    
    const skip = (currentPage - 1) * ITEMS_PER_PAGE;
    let url = "";

    if (currentView === 'parts') {
        if (!brand && !typeId) {
            const grid = document.getElementById('catalog-grid');
            if (grid) grid.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-sliders"></i>
                    <p>Selecione uma <strong>Marca</strong> ou <strong>Tipo</strong> para ver as peças disponíveis.</p>
                </div>`;
            const pagin = document.getElementById('pagination-container');
            if (pagin) pagin.innerHTML = '';
            const resCount = document.getElementById('results-count');
            if (resCount) resCount.textContent = 'Selecione um filtro...';
            currentFilteredItems = [];
            return;
        }
        url = `${API_BASE}/parts?status=Available&skip=${skip}&limit=${ITEMS_PER_PAGE}`;
        if (brand) url += `&brand=${encodeURIComponent(brand)}`;
        if (typeId) url += `&type_id=${typeId}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
    } else {
        url = `${API_BASE}/vehicles?status=Available&vehicle_type=${encodeURIComponent(currentView)}&skip=${skip}&limit=${ITEMS_PER_PAGE}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
    }

    // --- 2. OPTIMIZATION: SKELETON SCREENS ---
    showSkeletons();

    try {
        const res = await fetch(url);
        const data = await res.json();
        currentFilteredItems = data.items;
        
        if (currentView === 'parts') {
            renderCatalog(data.items, data.total);
        } else {
            renderVehicles(data.items, data.total);
        }
        updatePagination(data.total);
    } catch (e) {
        console.error("Load error:", e);
    }
}

window.resetFilters = async () => {
    const b = document.getElementById('filter-brand'); 
    if (_catalogBrandSelect) _catalogBrandSelect.reset();
    else if(b) b.value = '';

    // Reset the SearchableSelect for type filter
    if (_catalogTypeSelect) _catalogTypeSelect.reset();
    else { const t = document.getElementById('filter-type'); if(t) t.value = ''; }
    const s = document.getElementById('filter-search'); if(s) s.value = '';
    // Hide search when filters are reset
    const searchWrap = document.getElementById('filter-search-wrap');
    if (searchWrap && currentView === 'parts') searchWrap.style.display = 'none';
    currentPage = 1;
    await loadItems();
};


function renderCatalog(items, total) {
    const grid = document.getElementById('catalog-grid');
    const resCount = document.getElementById('results-count');
    if (resCount) resCount.textContent = `${total} peça${total !== 1 ? 's' : ''} encontrada${total !== 1 ? 's' : ''}`;

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-face-frown-open"></i>
                <p>Não encontrámos peças com os filtros selecionados.</p>
            </div>`;
        return;
    }

    grid.innerHTML = items.map(p => {
        const typeName = types.find(t => t.id == p.type_id)?.name || 'Peça';
        const mainImg = p.images && p.images.length > 0
            ? `<img src="${API_BASE}${p.images[0]}" alt="${typeName} ${p.part_number}" loading="lazy">`
            : `<div class="part-card-img-placeholder"><i class="fa-solid fa-cube"></i></div>`;

        const dynHtml = Object.entries(p.dynamic_data || {})
            .map(([k, v]) => `<span class="part-tag"><strong>${k}:</strong> ${v}</span>`)
            .join('');

        const priceHtml = (p.show_price && p.price)
            ? `<span class="part-price">${formatCurrency(p.price)}</span>`
            : `<span class="part-price-consult">Preço sob consulta</span>`;

        return `
            <article class="part-card" onclick="openDetailModal(${p.id})">
                <div class="part-card-img">
                    ${mainImg}
                    <span class="part-type-badge">${typeName}</span>
                    <div class="part-card-hover-info">
                        <span><i class="fa-solid fa-plus"></i> Ver Detalhes</span>
                    </div>
                </div>
                <div class="part-card-body">
                    <div class="part-card-title">${p.brand || 'Marca S/N'} ${p.model || ''}</div>
                    <div class="part-card-year">${p.year || 'Ano N/A'}</div>
                    <div class="part-card-tags" style="margin-top: 4px; flex-grow: 1;">${dynHtml}</div>
                    <div class="part-card-footer">
                        ${priceHtml}
                        <button class="btn-inquiry" onclick="event.stopPropagation(); openInquiryModal(${p.id}, 'part')">
                            <i class="fa-regular fa-envelope"></i> Pedir Info
                        </button>
                    </div>
                </div>
            </article>`;
    }).join('');
}

function renderVehicles(items, total) {
    const grid = document.getElementById('catalog-grid');
    const resCount = document.getElementById('results-count');
    if (resCount) resCount.textContent = `${total} veículo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;

    if (items.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-face-frown-open"></i>
                <p>Não encontrámos veículos com os filtros selecionados.</p>
            </div>`;
        return;
    }

    grid.innerHTML = items.map(v => {
        const mainImg = v.images && v.images.length > 0
            ? `<img src="${API_BASE}${v.images[0]}" alt="${v.make} ${v.model}" loading="lazy">`
            : `<div class="part-card-img-placeholder"><i class="fa-solid fa-car"></i></div>`;

        const priceHtml = (v.show_price && v.price)
            ? `<span class="part-price">${formatCurrency(v.price)}</span>`
            : `<span class="part-price-consult">Preço sob consulta</span>`;

        return `
            <article class="part-card" onclick="openInquiryModal(${v.id}, 'vehicle')">
                <div class="part-card-img">
                    ${mainImg}
                    <span class="part-type-badge" style="background:#6366f1;">${v.vehicle_type}</span>
                </div>
                <div class="part-card-body">
                    <div class="part-card-title">${v.make} ${v.model}</div>
                    <div class="part-card-year">${v.year || 'Ano N/A'}</div>
                    <div class="part-card-ref">
                        <i class="fa-solid fa-barcode" style="font-size:0.7rem; opacity:0.5;"></i>
                        VIN: ${v.vin}
                    </div>
                    <div class="part-card-tags">
                        <span class="part-tag">${v.engine || '--'}</span>
                        <span class="part-tag">${v.mileage || '--'} km</span>
                    </div>
                    <div class="part-card-footer">
                        ${priceHtml}
                        <button class="btn-inquiry" onclick="event.stopPropagation(); openInquiryModal(${v.id}, 'vehicle')">
                            <i class="fa-regular fa-envelope"></i> Informações
                        </button>
                    </div>
                </div>
            </article>`;
    }).join('');
}

function updatePagination(totalCount) {
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
    const container = document.getElementById('pagination-container');
    if (!container) return;
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-top:32px;">
            <button class="btn-filter" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changePage(${currentPage - 1})">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <span style="font-size:0.9rem; font-weight:600; color:#475569; min-width:80px; text-align:center;">Página ${currentPage} de ${totalPages}</span>
            <button class="btn-filter" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changePage(${currentPage + 1})">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>
    `;
}

window.changePage = async (newPage) => {
    currentPage = newPage;
    await loadItems();
    window.scrollTo({ top: 300, behavior: 'smooth' });
};

window.openInquiryModal = (id, itemType) => {
    let infoTarget, title, ref;

    if (itemType === 'part') {
        const p = currentFilteredItems.find(x => x.id == id);
        if (!p) return;
        const typeName = types.find(t => t.id == p.type_id)?.name || 'Peça';
        title = `${p.brand || ''} ${p.model || ''}`;
        ref = `Ref: ${p.part_number}`;
        infoTarget = `<div class="modal-part-type">${typeName}</div>`;
        document.getElementById('inq-part-id').value = p.id;
        document.getElementById('inq-vehicle-id').value = '';
    } else {
        const v = currentFilteredItems.find(x => x.id == id);
        if (!v) return;
        title = `${v.make} ${v.model}`;
        ref = `VIN: ${v.vin}`;
        infoTarget = `<div class="modal-part-type" style="color:#6366f1;">${v.vehicle_type}</div>`;
        document.getElementById('inq-part-id').value = '';
        document.getElementById('inq-vehicle-id').value = v.id;
    }

    document.getElementById('inquiry-part-info').innerHTML = `
        ${infoTarget}
        <div class="modal-part-name">${title}</div>
        <div class="modal-part-ref">${ref}</div>
    `;

    // Default message
    const messageField = document.getElementById('inq-message');
    if (messageField) {
        messageField.value = 'Gostaria de saber mais sobre esta peça, disponibilidade de envio, etc.';
    }

    toggleModal('inquiry-modal', true);
    document.body.style.overflow = 'hidden';
};

window.closeInquiryModal = () => {
    toggleModal('inquiry-modal', false);
    const form = document.getElementById('inquiry-form');
    if(form) form.reset();
};

// --- PART DETAIL MODAL (CATALOG) ---

let detailImages = [];
let detailIdx = 0;
let _currentShareId = null;

window.openDetailModal = (id) => {
    const p = currentFilteredItems.find(x => x.id == id);
    if(!p) return;
    _currentShareId = p.id;

    const typeName = types.find(t => t.id == p.type_id)?.name || 'Peça';
    
    // Fill text info
    document.getElementById('det-type-tag').textContent = typeName;
    document.getElementById('det-title').textContent = `${p.brand || ''} ${p.model || ''}`;
    document.getElementById('det-brand').textContent = p.brand || '--';
    document.getElementById('det-model').textContent = p.model || '--';
    document.getElementById('det-year').textContent = p.year || '--';
    document.getElementById('det-price').textContent = (p.show_price && p.price) ? formatCurrency(p.price) : 'Sob Consulta';
    document.getElementById('det-desc').textContent = p.description || 'Nenhum detalhe adicional disponível.';

    // Dynamic specs
    const dynContainer = document.getElementById('det-dyn-container');
    dynContainer.innerHTML = Object.entries(p.dynamic_data || {}).map(([k,v]) => `
        <div class="spec-item">
            <span class="spec-label">${k}</span>
            <span class="spec-value">${v}</span>
        </div>
    `).join('') || '<div style="grid-column: span 2; color:#94a3b8; font-style:italic; font-size:0.85rem;">Sem especificações...</div>';

    // Images
    detailImages = p.images || [];
    detailIdx = 0;
    updateDetailImg();

    // Contact button logic
    const contactBtn = document.getElementById('det-contact-btn');
    contactBtn.onclick = () => { toggleModal('part-detail-modal', false); openInquiryModal(p.id, 'part'); };

    // Share links setup
    const shareUrl = `${window.location.origin}${window.location.pathname}?part=${p.id}`;
    const shareText = `Veja esta peça: ${p.brand || ''} ${p.model || ''} ${p.year ? '(' + p.year + ')' : ''} em stock!`;
    const waLink = document.getElementById('share-whatsapp');
    const fbLink = document.getElementById('share-facebook');
    if (waLink) {
        waLink.href = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
        waLink.onclick = (e) => { e.stopPropagation(); window.open(waLink.href, '_blank'); closeShareDropdown(); return false; };
    }
    if (fbLink) {
        fbLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        fbLink.onclick = (e) => { e.stopPropagation(); window.open(fbLink.href, '_blank'); closeShareDropdown(); return false; };
    }

    // Close share dropdown if open
    closeShareDropdown();

    toggleModal('part-detail-modal', true);
};

window.closeDetailModal = () => {
    toggleModal('part-detail-modal', false);
    closeShareDropdown();
};

// --- SHARE LOGIC ---
let _currentShareUrl = '';

function closeShareDropdown() {
    const dd = document.getElementById('share-dropdown');
    if (dd) dd.classList.add('hidden');
}

window.toggleShareDropdown = (e) => {
    e.stopPropagation();
    const dd = document.getElementById('share-dropdown');
    if (dd) dd.classList.toggle('hidden');
};

window.copyShareLink = async () => {
    const p = currentFilteredItems.find(x => x.id == _currentShareId);
    if (!p) return;
    const url = `${window.location.origin}${window.location.pathname}?part=${p.id}`;
    try {
        await navigator.clipboard.writeText(url);
        const btn = document.getElementById('share-copy-btn');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--success);"></i> Link copiado!';
            btn.style.color = 'var(--success)';
            setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
        }
    } catch {
        showToast('Não foi possível copiar.', 'error');
    }
    closeShareDropdown();
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dd = document.getElementById('share-dropdown');
    const btn = document.getElementById('det-share-btn');
    if (dd && !dd.classList.contains('hidden') && !dd.contains(e.target) && e.target !== btn) {
        closeShareDropdown();
    }
});

window.changeDetailImg = (dir) => {
    if(!detailImages.length) return;
    detailIdx = (detailIdx + dir + detailImages.length) % detailImages.length;
    updateDetailImg();
};

function updateDetailImg() {
    const container = document.getElementById('detail-img-container');
    const nav = document.getElementById('detail-img-nav');
    
    if(!detailImages.length) {
        container.innerHTML = '<div style="color:rgba(255,255,255,0.2); font-size:4rem;"><i class="fa-solid fa-image"></i></div>';
        nav.innerHTML = '';
        return;
    }
    
    container.innerHTML = `<img src="${API_BASE}${detailImages[detailIdx]}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">`;
    
    nav.innerHTML = detailImages.map((_, i) => `
        <div onclick="detailIdx=${i}; updateDetailImg()" style="width:10px; height:10px; border-radius:50%; background:${i===detailIdx ? '#6366f1' : 'rgba(255,255,255,0.3)'}; cursor:pointer; transition:0.2s;"></div>
    `).join('');
}

function setupInquiryForm() {
    const modal = document.getElementById('inquiry-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeInquiryModal();
        });
    }

    const form = document.getElementById('inquiry-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...'; }

            const payload = {
                email: document.getElementById('inq-email').value,
                phone: document.getElementById('inq-phone').value,
                message: document.getElementById('inq-message').value
            };
            const partId = document.getElementById('inq-part-id').value;
            const vehId = document.getElementById('inq-vehicle-id').value;
            if(partId) payload.part_id = parseInt(partId);
            if(vehId) payload.vehicle_id = parseInt(vehId);

            try {
                const res = await fetch(`${API_BASE}/public/inquiry`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    closeInquiryModal();
                    showToast('Pedido enviado com sucesso! Entraremos em contacto brevemente.');
                } else {
                    showToast('Erro ao enviar pedido.', 'error');
                }
            } catch (err) {
                showToast('Falha de rede.', 'error');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fa-regular fa-paper-plane"></i> Enviar Mensagem'; }
            }
        });
    }
}

// --- DEEP LINK: ?part=ID ---
async function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const partId = params.get('part');
    if (!partId) return;

    try {
        const res = await fetch(`${API_BASE}/parts/${partId}`);
        if (!res.ok) return;
        const part = await res.json();
        // Inject into filtered items so openDetailModal can find it
        if (!currentFilteredItems.find(x => x.id == part.id)) {
            currentFilteredItems = [part, ...currentFilteredItems];
        }
        openDetailModal(part.id);
    } catch (e) {
        console.warn('Deep link part not found:', e);
    }
}
