// js/admin.js - Administrator Panel Logic

// Global State
let types = [];
let brands = [];
let locations = [];
let currentParts = [];
let currentVehicles = [];
let activeView = 'stock';
let currentUser = null;

// Pagination State
let pageParts = 1;
let pageVehicles = 1;
let pageInquiries = 1;
let pageAudit = 1;
const ITEMS_PER_PAGE = 20;

// Chart Instances
let salesChart = null;
let categoryChart = null;
let typeDistributionChart = null;
let brandRevenueChart = null;

// Camera State
let capturedImages = [];
let cameraStream = null;

// Detail Modal State
let detailImages = [];
let detailIdx = 0;

// Optimization: Debounce helper
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Check if logged in
    if (token) {
        showApp();
        initData();
    } else {
        showLogin();
    }

    setupEventListeners();
});


function showLogin() {
    document.getElementById('login-view').classList.remove('hidden');
    document.getElementById('app-view').classList.add('hidden');
    loadBranding();
}

function showApp() {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');
}

async function initData() {
    try {
        const [userData, tData, bData, lData] = await Promise.all([
            apiCall('/me'),
            apiCall('/types'),
            apiCall('/brands'),
            apiCall('/locations')
        ]);

        currentUser = userData;
        types = tData;
        brands = bData;
        locations = lData;

        applyRoleRestrictions();
        populateSelectors();
        loadParts();
        loadBranding();
    } catch (e) {
        console.error("Data Initialization failed:", e);
    }
}

function applyRoleRestrictions() {
    if (!currentUser) return;

    const isAdmin = currentUser.role === 'admin';

    // Toggle sidebar items
    document.querySelectorAll('.admin-only').forEach(el => {
        if (isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    // Toggle action buttons in views
    const bulkBtns = document.querySelectorAll('button[onclick*="switchView(\'bulk\')"]');
    bulkBtns.forEach(btn => {
        if (isAdmin) btn.style.display = 'flex';
        else btn.style.display = 'none';
    });
}

// SearchableSelect instances — keyed by select element id
const _ssInstances = {};

function populateSelectors() {
    const typeSels = ['part-type', 'bulk-type-select', 'admin-filter-type'];
    const brandSels = ['part-brand', 'vehicle-make', 'admin-filter-brand'];
    const locSels = ['part-location'];
    const statusSels = ['admin-filter-status'];
    const vehTypeSels = ['vehicles-filter-type', 'vehicle-type'];

    // Sort alphabetically (case-insensitive) — frontend safety net
    const sortedTypes = [...types].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    const sortedBrands = [...brands].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    const sortedLocs = [...locations].sort((a, b) => a.name.localeCompare(b.name, 'pt'));

    // --- Type dropdowns → SearchableSelect ---
    typeSels.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const isFilter = (id === 'admin-filter-type');
        const opts = [
            { value: '', label: isFilter ? 'Todos os Tipos' : '-- Selecione Tipo --' },
            ...sortedTypes.map(t => ({ value: String(t.id), label: t.name }))
        ];

        // Populate the native select as fallback / form value carrier
        el.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

        // Destroy previous instance if exists (e.g. after re-login)
        if (_ssInstances[id]) {
            _ssInstances[id].destroy();
            delete _ssInstances[id];
        }

        _ssInstances[id] = new SearchableSelect(el, opts, {
            placeholder: isFilter ? 'Todos os Tipos' : '-- Selecione Tipo --',
            searchPlaceholder: 'Pesquisar tipo...',
            inline: isFilter,  // no border inside filter bar
            onChange: isFilter ? () => { pageParts = 1; loadParts(); } : null
        });
    });

    // --- Brand dropdowns → SearchableSelect ---
    brandSels.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const isFilter = (id === 'admin-filter-brand');
        const opts = [
            { value: '', label: isFilter ? 'Todas as Marcas' : '-- Marca --' },
            ...sortedBrands.map(b => ({ value: b.name, label: b.name }))
        ];

        el.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

        if (_ssInstances[id]) {
            _ssInstances[id].destroy();
            delete _ssInstances[id];
        }

        _ssInstances[id] = new SearchableSelect(el, opts, {
            placeholder:       isFilter ? 'Todas as Marcas' : '-- Marca --',
            searchPlaceholder: 'Pesquisar marca...',
            inline:            isFilter,
            onChange: isFilter ? () => { pageParts = 1; loadParts(); } : null
        });
    });

    // --- Location dropdowns → SearchableSelect ---
    locSels.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const opts = [
            { value: '', label: '-- Localização --' },
            ...sortedLocs.map(l => ({ value: l.name, label: l.name }))
        ];

        el.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

        if (_ssInstances[id]) {
            _ssInstances[id].destroy();
            delete _ssInstances[id];
        }

        _ssInstances[id] = new SearchableSelect(el, opts, {
            placeholder:       '-- Localização --',
            searchPlaceholder: 'Pesquisar local...',
            inline:            false
        });
    });

    // --- Status dropdowns → SearchableSelect ---
    statusSels.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const opts = [
            { value: '', label: 'Todos os Estados' },
            { value: 'Available', label: 'Disponível' },
            { value: 'EmptySlot', label: 'Em Restock' },
            { value: 'Sold', label: 'Vendido' }
        ];

        el.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

        if (_ssInstances[id]) {
            _ssInstances[id].destroy();
            delete _ssInstances[id];
        }

        _ssInstances[id] = new SearchableSelect(el, opts, {
            placeholder:       'Todos os Estados',
            searchPlaceholder: 'Pesquisar estado...',
            inline:            true,
            onChange: () => { pageParts = 1; loadParts(); }
        });
    });

    // --- Vehicle Type dropdowns → SearchableSelect ---
    vehTypeSels.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const isFilter = (id === 'vehicles-filter-type');
        const opts = isFilter ? [
            { value: '', label: 'Todos os Veículos' },
            { value: 'Para Peças', label: 'Para Peças' },
            { value: 'Salvado', label: 'Salvado' }
        ] : [
            { value: 'Para Peças', label: 'Para Peças' },
            { value: 'Salvado', label: 'Salvado' }
        ];

        el.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');

        if (_ssInstances[id]) {
            _ssInstances[id].destroy();
            delete _ssInstances[id];
        }

        _ssInstances[id] = new SearchableSelect(el, opts, {
            placeholder:       isFilter ? 'Todos os Veículos' : 'Tipo de Veículo',
            searchPlaceholder: 'Pesquisar tipo...',
            inline:            isFilter,
            onChange: isFilter ? () => { pageVehicles = 1; loadVehicles(); } : null
        });
    });
}




function setupEventListeners() {
    // Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }


    // Part Form
    const partForm = document.getElementById('part-form');
    if (partForm) partForm.addEventListener('submit', handleSavePart);

    // Vehicle Form
    const vForm = document.getElementById('vehicle-form');
    if (vForm) vForm.addEventListener('submit', handleSaveVehicle);

    // Type Editor Form
    const typeForm = document.getElementById('type-form');
    if (typeForm) typeForm.addEventListener('submit', handleSaveType);

    // Import Forms
    const importZipForm = document.getElementById('form-import-zip');
    if (importZipForm) importZipForm.addEventListener('submit', handleImportZip);

    const restoreForm = document.getElementById('form-restore-zip');
    if (restoreForm) restoreForm.addEventListener('submit', handleRestoreBackup);

    const userForm = document.getElementById('user-form');
    if (userForm) userForm.addEventListener('submit', handleSaveUser);

    // Image Input Listeners
    ['part-images', 'vehicle-images'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(f => {
                    if (capturedImages.length < 5) {
                        capturedImages.push(f);
                    }
                });
                renderCapturedPreviews();
                // Clear input so same file can be selected again if removed
                e.target.value = '';
            });
        }
    });
}

// --- AUTH ---

async function handleLogin(e) {
    e.preventDefault();
    const formData = new URLSearchParams();
    formData.append('username', document.getElementById('username').value);
    formData.append('password', document.getElementById('password').value);

    try {
        const res = await fetch(`${API_BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            token = data.access_token;
            localStorage.setItem("atp_token", token);
            showApp();
            initData();
        } else {
            alert("Login inválido.");
        }
    } catch (e) {
        alert("Erro de ligação ao servidor.");
    }
}

function logout() {
    localStorage.removeItem("atp_token");
    window.location.reload();
}

// --- NAVIGATION ---

function switchView(viewName) {
    // Role-based protection
    const adminViews = ['users', 'settings', 'analytics', 'bulk', 'types', 'audit'];
    if (adminViews.includes(viewName) && currentUser && currentUser.role !== 'admin') {
        showToast("Acesso restrito a administradores.", "error");
        viewName = 'stock';
    }

    activeView = viewName;
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.remove('hidden');

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
        el.classList.remove('active');
        if (el.id === 'nav-' + viewName) el.classList.add('active');
    });
}

// --- USER MANAGEMENT ---

async function loadUsers() {
    switchView('users');
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">A carregar...</td></tr>';

    try {
        const usersData = await apiCall('/users');
        let html = '';
        usersData.items.forEach(u => {
            const isMe = u.username === currentUser.username;
            const roleBadge = u.role === 'admin'
                ? '<span class="status-badge badge-sold">Admin</span>'
                : '<span class="status-badge badge-available" style="color:var(--accent); border-color:var(--accent); background:var(--accent-glow);">Staff</span>';

            html += `
                <tr>
                    <td style="font-weight:600; color:var(--text-main);">${u.username} ${isMe ? '<small style="color:var(--text-muted); font-weight:400;">(Eu)</small>' : ''}</td>
                    <td>${roleBadge}</td>
                    <td style="text-align:right;">
                        <button class="btn btn-secondary" onclick="editUser('${u.username}', '${u.role}')"><i class="fa-solid fa-pen"></i></button>
                        ${!isMe ? `<button class="btn btn-secondary" onclick="deleteUser(${u.id}, '${u.username}')" style="color:var(--danger); margin-left:8px;"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html || '<tr><td colspan="3">Nenhum utilizador encontrado.</td></tr>';
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--danger);">Não tem permissões para ver utilizadores.</td></tr>';
    }
}

window.loadUsers = loadUsers;

window.openUserModal = () => {
    document.getElementById('user-form').reset();
    document.getElementById('user-modal-id').value = '';
    document.getElementById('user-modal-name').disabled = false;
    document.getElementById('user-modal-title').textContent = "Novo Utilizador";
    toggleModal('user-modal', true);
};

window.editUser = (username, role) => {
    document.getElementById('user-modal-id').value = username;
    document.getElementById('user-modal-name').value = username;
    document.getElementById('user-modal-name').disabled = true;
    document.getElementById('user-modal-role').value = role;
    document.getElementById('user-modal-title').textContent = "Editar Utilizador";
    toggleModal('user-modal', true);
};

window.closeUserModal = () => toggleModal('user-modal', false);

async function handleSaveUser(e) {
    e.preventDefault();
    const username = document.getElementById('user-modal-name').value;
    const password = document.getElementById('user-modal-pass').value;
    const role = document.getElementById('user-modal-role').value;
    const editUsername = document.getElementById('user-modal-id').value;

    try {
        if (editUsername) {
            const payload = { role };
            if (password) payload.password = password;
            await apiCall(`/users/${editUsername}`, 'PUT', payload);
            showToast("Utilizador atualizado.");
        } else {
            if (!password) {
                alert("Password obrigatória para novos utilizadores.");
                return;
            }
            await apiCall('/users', 'POST', { username, password, role });
            showToast("Utilizador criado.");
        }
        closeUserModal();
        loadUsers();
    } catch (err) {
        alert("Erro ao guardar utilizador: " + err.message);
    }
}

window.deleteUser = async (userId, username) => {
    if (confirm(`Tem a certeza que deseja APAGAR o utilizador "${username}"?`)) {
        try {
            await apiCall(`/users/${userId}`, 'DELETE');
            showToast("Utilizador removido.");
            loadUsers();
        } catch (err) {
            alert("Erro ao apagar utilizador.");
        }
    }
}

// --- AUDIT TRAIL ---

const AUDIT_PAGE_SIZE = 20;

async function loadAuditTrail() {
    switchView('audit');
    const skip = (pageAudit - 1) * AUDIT_PAGE_SIZE;
    const tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">A carregar logs...</td></tr>';

    const startDate = document.getElementById('audit-filter-start')?.value || '';
    const endDate = document.getElementById('audit-filter-end')?.value || '';

    let url = `/analytics/history?skip=${skip}&limit=${AUDIT_PAGE_SIZE}`;
    if (startDate) url += `&start_date=${startDate}`;
    if (endDate) url += `&end_date=${endDate}`;

    try {
        const data = await apiCall(url);
        const totalPages = Math.ceil(data.total / AUDIT_PAGE_SIZE);
        const pageStart = skip + 1;
        const pageEnd = Math.min(skip + AUDIT_PAGE_SIZE, data.total);
        const countEl = document.getElementById('audit-count-info');
        if (countEl) {
            countEl.textContent = data.total > 0
                ? `A mostrar ${pageStart}–${pageEnd} de ${data.total} registos`
                : 'Nenhum registo encontrado';
        }
        renderAuditTrail(data.items, totalPages);
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--danger);">Erro ao carregar auditoria.</td></tr>';
    }
}

window.loadAuditTrail = loadAuditTrail;

window.clearAuditFilters = () => {
    const s = document.getElementById('audit-filter-start'); if (s) s.value = '';
    const e = document.getElementById('audit-filter-end'); if (e) e.value = '';
    pageAudit = 1;
    loadAuditTrail();
};

function renderAuditTrail(items, totalPages) {
    const tbody = document.getElementById('audit-tbody');
    const isAdmin = currentUser?.role === 'admin';
    let html = '';
    items.forEach(log => {
        const dt = new Date(log.timestamp).toLocaleString('pt-PT');
        const user = log.user || '<i style="color:#94a3b8">Sistema</i>';
        const action = log.action;
        const itemId = log.part_id ? `Peça #${log.part_id}` : (log.vehicle_id ? `Vei #${log.vehicle_id}` : '-');

        let details = log.details || '';
        if (details.startsWith('{')) {
            try {
                const dObj = JSON.parse(details);
                details = Object.entries(dObj).map(([k, v]) => `${k}: ${v}`).join(' | ');
            } catch (e) { }
        }

        const deleteBtn = isAdmin
            ? `<td style="text-align:right;"><button onclick="deleteAuditRecord(${log.id})" style="background:none;border:none;cursor:pointer;color:var(--danger);padding:4px 8px;border-radius:6px;transition:background 0.15s;" title="Apagar registo" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='none'"><i class="fa-solid fa-trash" style="font-size:0.85rem;"></i></button></td>`
            : `<td></td>`;

        html += `
            <tr>
                <td style="font-size:0.8rem; color:var(--text-muted);">${dt}</td>
                <td><strong style="color:var(--text-main);">${user}</strong></td>
                <td><span class="status-badge" style="background:var(--bg-body); color:var(--text-main); border:1px solid var(--border-color); font-weight:700;">${action}</span></td>
                <td>${itemId}</td>
                <td style="font-size:0.85rem; color:var(--text-muted); max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${details}">${details}</td>
                ${deleteBtn}
            </tr>
        `;
    });
    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;">Nenhum registo de auditoria.</td></tr>';
    renderPagination('audit-pagination', pageAudit, totalPages, (p) => { pageAudit = p; loadAuditTrail(); });
}

window.deleteAuditRecord = async (id) => {
    if (currentUser?.role !== 'admin') return;
    if (!confirm('Apagar este registo de auditoria?')) return;
    try {
        await apiCall(`/analytics/history/${id}`, 'DELETE');
        showToast('Registo removido.');
        loadAuditTrail();
    } catch (e) {
        alert('Erro ao apagar registo: ' + e.message);
    }
};

window.deleteAuditRange = async () => {
    if (currentUser?.role !== 'admin') return;
    const start = document.getElementById('audit-del-start')?.value;
    const end = document.getElementById('audit-del-end')?.value;
    if (!start || !end) return alert('Selecione as duas datas para apagar o intervalo.');
    if (start > end) return alert('A data de início deve ser anterior à data de fim.');
    if (!confirm(`Apagar TODOS os registos de auditoria entre ${start} e ${end}?\n\nEsta ação é irreversível.`)) return;
    try {
        const res = await apiCall(`/analytics/history/range/delete?start_date=${start}&end_date=${end}`, 'DELETE');
        showToast(`${res.deleted} registo(s) eliminado(s).`, 'success');
        document.getElementById('audit-del-start').value = '';
        document.getElementById('audit-del-end').value = '';
        loadAuditTrail();
    } catch (e) {
        alert('Erro ao apagar intervalo: ' + e.message);
    }
};




// --- PARTS MANAGEMENT ---

async function loadParts() {
    switchView('stock');
    const skip = (pageParts - 1) * ITEMS_PER_PAGE;

    // Only use the filter bar search field
    const search = document.getElementById('admin-filter-search')?.value || '';

    const fType = document.getElementById('admin-filter-type')?.value || '';
    const fBrand = document.getElementById('admin-filter-brand')?.value || '';
    const fStatus = document.getElementById('admin-filter-status')?.value || '';

    let url = `/parts?skip=${skip}&limit=${ITEMS_PER_PAGE}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (fType) url += `&type_id=${fType}`;
    if (fBrand) url += `&brand=${encodeURIComponent(fBrand)}`;
    if (fStatus) url += `&status=${fStatus}`;

    try {
        const [partsData, stats] = await Promise.all([
            apiCall(url),
            apiCall('/parts/stats')
        ]);

        currentParts = partsData.items;
        const totalPages = Math.ceil(partsData.total / ITEMS_PER_PAGE);

        document.getElementById('kpi-total').textContent = stats.total;
        document.getElementById('kpi-available').textContent = stats.available;
        document.getElementById('kpi-restock').textContent = stats.empty;
        document.getElementById('kpi-sold').textContent = stats.sold;

        renderPartsTable(currentParts, totalPages);
    } catch (e) {
        console.error("Failed to load parts", e);
    }
}

window.resetAdminFilters = () => {
    const s1 = document.getElementById('admin-filter-search'); if (s1) s1.value = '';
    // Reset the SearchableSelect instance (keeps native select in sync)
    if (_ssInstances['admin-filter-type']) _ssInstances['admin-filter-type'].reset();
    else { const s2 = document.getElementById('admin-filter-type'); if (s2) s2.value = ''; }
    const s3 = document.getElementById('admin-filter-brand'); if (s3) s3.value = '';
    const s4 = document.getElementById('admin-filter-status'); if (s4) s4.value = '';
    pageParts = 1;
    loadParts();
};


function renderPartsTable(items, totalPages) {
    const tbody = document.getElementById('parts-tbody');
    let html = '';
    items.forEach(p => {
        const typeName = types.find(t => t.id === p.type_id)?.name || 'N/A';
        const badge = getStatusBadge(p.status);

        // Dynamic fields tags (Key: Value)
        const dynTags = Object.entries(p.dynamic_data || {})
            .map(([k, v]) => `<span style="background:var(--bg-body); padding:2px 8px; border-radius:4px; font-size:0.75rem; color:var(--text-muted); border:1px solid var(--border-color);"><strong style="color:var(--accent);">${k}:</strong> ${v}</span>`)
            .join(' ');

        // Image thumbnail
        const imgThumb = p.images && p.images.length > 0
            ? `<img src="${API_BASE}${p.images[0]}" style="width:40px; height:40px; object-fit:cover; border-radius:8px; border:1px solid var(--border-color);">`
            : `<div style="width:40px; height:40px; background:var(--bg-body); border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.8rem;"><i class="fa-solid fa-image"></i></div>`;

        let actions = '';
        if (p.status === 'Available') {
            actions = `
                <button class="btn btn-secondary" onclick="openDetailModal(${p.id})" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-secondary" onclick="editPart(${p.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-primary" onclick="baixaPart(${p.id})" title="Vender/Baixa"><i class="fa-solid fa-cart-shopping"></i> Baixa</button>
                ${currentUser.role === 'admin' ? `<button class="btn btn-secondary" onclick="deletePart(${p.id})" style="color:var(--danger)" title="Apagar"><i class="fa-solid fa-trash"></i></button>` : ''}
            `;
        } else if (p.status === 'EmptySlot') {
            actions = `
                <button class="btn btn-secondary" onclick="openDetailModal(${p.id})" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                <button class="btn btn-secondary" onclick="restockPart(${p.id})" title="Restock"><i class="fa-solid fa-boxes-packing"></i> Restock</button>
                ${currentUser.role === 'admin' ? `<button class="btn btn-secondary" onclick="deletePart(${p.id})" style="color:var(--danger)" title="Apagar"><i class="fa-solid fa-trash"></i></button>` : ''}
            `;
        } else {
            actions = `
                <button class="btn btn-secondary" onclick="openDetailModal(${p.id})" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                ${currentUser.role === 'admin' ? `<button class="btn btn-secondary" onclick="deletePart(${p.id})" style="color:var(--danger)" title="Apagar"><i class="fa-solid fa-trash"></i></button>` : ''}
             `;
        }

        html += `
            <tr>
                <td style="font-weight:600;">${typeName}</td>
                <td>${p.brand || '-'}</td>
                <td>${p.model || '-'}</td>
                <td>${p.year || '-'}</td>
                <td><div style="display:flex; flex-wrap:wrap; gap:4px; max-width:200px;">${dynTags || '-'}</div></td>
                <td><strong>${p.part_number}</strong></td>
                <td>${p.location}</td>
                <td>${imgThumb}</td>
                <td>${badge}</td>
                <td><div style="display:flex;gap:8px;align-items:center;">${actions}</div></td>
            </tr>
        `;
    });
    tbody.innerHTML = html || '<tr><td colspan="10" style="text-align:center; padding:20px;">Nenhum registo encontrado.</td></tr>';
    renderPagination('parts-pagination', pageParts, totalPages, (p) => { pageParts = p; loadParts(); });
}

function openPartModal(isRestock = false) {
    toggleModal('part-modal', true);
    const saveAndNewBtn = document.getElementById('save-and-new-btn');
    if (!isRestock) {
        document.getElementById('part-form').reset();
        document.getElementById('part-id').value = '';
        document.getElementById('dynamic-fields-grid').innerHTML = '';

        document.getElementById('modal-title').textContent = "Nova Peca em Stock";
        document.getElementById('save-btn').textContent = "Guardar Peca";

        capturedImages = [];
        renderCapturedPreviews();

        // Reset & enable SearchableSelect for part-type
        if (_ssInstances['part-type']) {
            _ssInstances['part-type'].reset();
            const t = _ssInstances['part-type']._trigger;
            t.disabled = false;
            t.style.pointerEvents = '';
            t.style.opacity = '';
        } else {
            document.getElementById('part-type').disabled = false;
        }
        document.getElementById('part-number').disabled = false;
        document.getElementById('part-location').disabled = false;

        // Show 'save and new' only for new parts
        if (saveAndNewBtn) saveAndNewBtn.style.display = 'inline-flex';
    } else {
        // Re-enable the trigger in case it was disabled in a previous restock
        if (_ssInstances['part-type']) {
            const t = _ssInstances['part-type']._trigger;
            t.disabled = false;
            t.style.pointerEvents = '';
            t.style.opacity = '';
        }
        // Hide for restock/edit
        if (saveAndNewBtn) saveAndNewBtn.style.display = 'none';
    }
}


window.handleSaveAndNew = async () => {
    // Remember the currently selected type before saving
    const typeId = document.getElementById('part-type').value;
    const typeName = types.find(t => t.id == typeId)?.name || '';

    // Trigger form submit and wait; we hook into it via a flag
    const form = document.getElementById('part-form');
    const saveAndNewBtn = document.getElementById('save-and-new-btn');
    const saveBtn = document.getElementById('save-btn');

    // Validate required fields manually (same logic as handleSavePart)
    const type = types.find(t => t.id == typeId);
    if (type) {
        const missing = [];
        const dynFields = Array.from(document.querySelectorAll('.dyn-field'));
        type.fields.forEach(f => {
            if (f.required_field) {
                const el = dynFields.find(df => df.dataset.name === f.name);
                if (!el || !el.value.trim()) missing.push(f.name);
            }
        });
        if (missing.length > 0) {
            alert(`Os seguintes campos são obrigatórios:\n• ${missing.join('\n• ')}`);
            return;
        }
    }

    // Validate brand is required
    const brandVal = document.getElementById('part-brand').value;
    if (!brandVal) {
        alert('A Marca \u00e9 obrigat\u00f3ria. Por favor selecione uma marca.');
        document.getElementById('part-brand').focus();
        return;
    }


    // Disable button during save
    if (saveAndNewBtn) { saveAndNewBtn.disabled = true; saveAndNewBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...'; }

    try {
        const imagesUploadedPaths = await uploadPendingImages();
        const dynData = {};
        document.querySelectorAll('.dyn-field').forEach(el => { dynData[el.dataset.name] = el.value; });

        const payload = {
            part_number: document.getElementById('part-number').value,
            type_id: parseInt(typeId),
            location: document.getElementById('part-location').value,
            brand: document.getElementById('part-brand').value,
            model: document.getElementById('part-model').value,
            year: document.getElementById('part-year').value,
            price: document.getElementById('part-price').value || null,
            show_price: document.getElementById('part-show-price').checked,
            dynamic_data: dynData,
            images: imagesUploadedPaths
        };

        const id = document.getElementById('part-id').value;
        if (id) {
            await apiCall(`/parts/${id}`, 'PUT', payload);
        } else {
            await apiCall('/parts', 'POST', payload);
        }

        showToast("Peça guardada! Abrindo nova do mesmo tipo...");
        loadParts();

        // Reopen modal with same type pre-selected
        openPartModal(false);
        if (_ssInstances['part-type']) _ssInstances['part-type'].setValue(String(typeId));
        else document.getElementById('part-type').value = typeId;
        renderDynamicFields();

    } catch (err) {
        alert("Erro ao guardar a peça: " + err.message);
    } finally {
        if (saveAndNewBtn) { saveAndNewBtn.disabled = false; saveAndNewBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Guardar + Nova do mesmo tipo'; }
    }
};

async function handleSavePart(e) {
    e.preventDefault();
    const btn = document.getElementById('save-btn');

    // --- Validate required dynamic fields ---
    const tid = document.getElementById('part-type').value;
    const type = types.find(t => t.id == tid);
    if (type) {
        const missing = [];
        const dynFields = Array.from(document.querySelectorAll('.dyn-field'));
        type.fields.forEach(f => {
            if (f.required_field) {
                const el = dynFields.find(df => df.dataset.name === f.name);
                if (!el || !el.value.trim()) missing.push(f.name);
            }
        });
        if (missing.length > 0) {
            alert(`Os seguintes campos são obrigatórios:\n• ${missing.join('\n• ')}`);
            return;
        }
    }

    // --- Validate brand is required ---
    const brandVal = document.getElementById('part-brand').value;
    if (!brandVal) {
        alert('A Marca é obrigatória. Por favor selecione uma marca.');
        document.getElementById('part-brand').focus();
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';

    const id = document.getElementById('part-id').value;
    const isRestock = document.getElementById('part-status').value === 'EmptySlot';

    try {
        const imagesUploadedPaths = await uploadPendingImages();
        const dynData = {};
        document.querySelectorAll('.dyn-field').forEach(el => {
            dynData[el.dataset.name] = el.value;
        });

        const payload = {
            part_number: document.getElementById('part-number').value,
            type_id: parseInt(document.getElementById('part-type').value),
            location: document.getElementById('part-location').value,
            brand: document.getElementById('part-brand').value,
            model: document.getElementById('part-model').value,
            year: document.getElementById('part-year').value,
            price: document.getElementById('part-price').value || null,
            show_price: document.getElementById('part-show-price').checked,
            dynamic_data: dynData,
            images: imagesUploadedPaths
        };

        if (id) {
            if (isRestock) payload.status = 'Available';
            await apiCall(`/parts/${id}`, 'PUT', payload);
        } else {
            await apiCall('/parts', 'POST', payload);
        }

        toggleModal('part-modal', false);
        showToast("Sucesso ao guardar peça.");
        loadParts();
    } catch (err) {
        alert("Erro ao guardar a peça: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Registo';
    }
}

async function uploadPendingImages() {
    const paths = [];

    for (let i = 0; i < capturedImages.length; i++) {
        const item = capturedImages[i];
        if (typeof item === 'string') {
            // Already uploaded, keep original path
            paths.push(item);
        } else {
            // New file/blob, upload to server
            const fd = new FormData();
            fd.append("file", item);
            try {
                const res = await fetch(`${API_BASE}/images/upload`, {
                    method: 'POST',
                    body: fd,
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    paths.push(data.url);
                }
            } catch (e) { console.error("Upload error", e); }
        }
    }
    return paths;
}

// Global exposure for onclick
window.editPart = async (id) => {
    const p = currentParts.find(x => x.id === id);
    if (!p) return;

    openPartModal();
    // Hide save-and-new in edit mode
    const saveAndNewBtn = document.getElementById('save-and-new-btn');
    if (saveAndNewBtn) saveAndNewBtn.style.display = 'none';

    document.getElementById('modal-title').textContent = "Editar: " + p.part_number;
    document.getElementById('save-btn').textContent = "Guardar Alterações";

    document.getElementById('part-id').value = p.id;
    document.getElementById('part-status').value = p.status;

    // Sync SearchableSelect instance for part-type
    if (_ssInstances['part-type']) {
        _ssInstances['part-type'].setValue(String(p.type_id));
    } else {
        document.getElementById('part-type').value = p.type_id;
    }

    document.getElementById('part-number').value = p.part_number;
    document.getElementById('part-brand').value = p.brand || '';
    document.getElementById('part-model').value = p.model || '';
    document.getElementById('part-year').value = p.year || '';
    document.getElementById('part-location').value = p.location;
    document.getElementById('part-price').value = p.price || '';
    document.getElementById('part-show-price').checked = p.show_price;

    capturedImages = p.images ? [...p.images] : [];
    renderCapturedPreviews();

    renderDynamicFields(p.dynamic_data);
};


window.renderDynamicFields = (prefill = {}, isRestock = false) => {
    const tid = document.getElementById('part-type').value;
    const container = document.getElementById('dynamic-fields-grid');
    if (!container) return;
    container.innerHTML = '';

    if (!tid) return;
    const type = types.find(t => t.id == tid);
    if (!type) return;

    const badge = document.getElementById('type-badge');
    if (badge) badge.textContent = type.name;

    let html = '';
    type.fields.forEach(f => {
        const val = prefill[f.name] || '';
        const disabled = '';
        const isRequired = f.required_field;
        const lockHint = '';
        const reqMark = isRequired ? '<span style="color:var(--danger); margin-left:2px;">*</span>' : '';
        const requiredAttr = isRequired ? 'required' : '';

        let inputHtml = '';
        if (f.field_type === 'options') {
            inputHtml = `<select class="dyn-field" data-name="${f.name}" ${disabled} ${requiredAttr}><option value="">--</option>`;
            (f.options || []).forEach(opt => {
                inputHtml += `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`;
            });
            inputHtml += `</select>`;
        } else {
            inputHtml = `<input type="${f.field_type === 'number' ? 'number' : 'text'}" class="dyn-field" data-name="${f.name}" value="${val}" ${disabled} ${requiredAttr} placeholder="${isRequired ? 'Obrigatório' : ''}">`;
        }

        html += `
            <div class="form-group" style="width: 48%;">
                <label>${f.name} ${reqMark} ${lockHint}</label>
                ${inputHtml}
            </div>
        `;
    });
    container.innerHTML = html;
};

let activeBaixaId = null;
window.baixaPart = (id) => {
    const p = currentParts.find(x => x.id === id);
    if (!p) return;
    activeBaixaId = id;
    document.getElementById('baixa-ref').textContent = p.part_number;
    document.getElementById('baixa-price').value = p.price || '';
    toggleModal('baixa-modal', true);
};

window.submitBaixa = async (action) => {
    const salePrice = document.getElementById('baixa-price').value;
    if (action === 'venda' && !salePrice && !confirm("Deseja registar a venda sem preço?")) return;

    try {
        await apiCall(`/parts/${activeBaixaId}/baixa`, 'POST', {
            action, sale_price: action === 'venda' ? (salePrice || null) : null
        });
        toggleModal('baixa-modal', false);
        showToast("Baixa processada.");
        loadParts();
        if (activeView === 'analytics') loadAnalytics();
    } catch (err) {
        alert("Erro ao processar baixa.");
    }
};

window.restockPart = (id) => {
    const p = currentParts.find(x => x.id === id);
    openPartModal(true);
    document.getElementById('modal-title').textContent = "Restock Slot: " + p.part_number;
    document.getElementById('part-id').value = p.id;
    document.getElementById('part-status').value = 'EmptySlot';

    if (_ssInstances['part-type']) {
        _ssInstances['part-type'].setValue(String(p.type_id));
        // Disable the trigger button visually
        _ssInstances['part-type']._trigger.disabled = true;
        _ssInstances['part-type']._trigger.style.pointerEvents = 'none';
        _ssInstances['part-type']._trigger.style.opacity = '0.6';
    } else {
        document.getElementById('part-type').value = p.type_id;
        document.getElementById('part-type').disabled = true;
    }
    document.getElementById('part-number').value = p.part_number;
    document.getElementById('part-number').disabled = false;
    document.getElementById('part-location').value = p.location;
    document.getElementById('part-location').disabled = false;

    renderDynamicFields(p.dynamic_data, true);
};

window.deletePart = async (id) => {
    if (confirm("Apagar permanentemente este registo?")) {
        try {
            await apiCall(`/parts/${id}`, 'DELETE');
            showToast("Registo removido.");
            loadParts();
        } catch (err) {
            alert("Erro ao apagar peça: " + (err.message || "Verifique as permissões."));
        }
    }
};

// --- VEHICLES ---

async function loadVehicles() {
    switchView('vehicles');
    const skip = (pageVehicles - 1) * ITEMS_PER_PAGE;
    const search = document.getElementById('vehicles-filter-search')?.value || '';
    const vType = document.getElementById('vehicles-filter-type')?.value || '';

    try {
        let url = `/vehicles?skip=${skip}&limit=${ITEMS_PER_PAGE}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (vType) url += `&vehicle_type=${encodeURIComponent(vType)}`;

        const [vData, stats] = await Promise.all([
            apiCall(url),
            apiCall('/vehicles/stats')
        ]);

        currentVehicles = vData.items;
        const totalPages = Math.ceil(vData.total / ITEMS_PER_PAGE);

        document.getElementById('kpi-v-total').textContent = stats.total;
        document.getElementById('kpi-v-parts').textContent = stats.para_pecas;
        document.getElementById('kpi-v-salvage').textContent = stats.salvados;

        renderVehiclesTable(currentVehicles, totalPages);
    } catch (e) { console.error(e); }
}

function renderVehiclesTable(items, totalPages) {
    const tbody = document.getElementById('vehicles-tbody');
    let html = '';
    items.forEach(v => {
        const badge = getStatusBadge(v.status);
        html += `
            <tr>
                <td style="font-weight:700; color:var(--text-main);">${v.vin}</td>
                <td>${v.make} ${v.model}</td>
                <td>${v.year || '--'}</td>
                <td><span class="status-badge" style="background:var(--accent-glow); color:var(--accent);">${v.vehicle_type}</span></td>
                <td style="font-weight:600;">${v.price ? formatCurrency(v.price) : 'Consultar'}</td>
                <td>${badge}</td>
                <td>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="btn btn-secondary" onclick="editVehicle(${v.id})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        ${currentUser.role === 'admin' ? `<button class="btn btn-secondary" onclick="deleteVehicle(${v.id})" style="color:var(--danger)" title="Apagar"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center;">Sem veículos em stock.</td></tr>';
    renderPagination('vehicles-pagination', pageVehicles, totalPages, (p) => { pageVehicles = p; loadVehicles(); });
}

window.openVehicleModal = () => {
    toggleModal('vehicle-modal', true);
    document.getElementById('vehicle-id').value = '';
    document.getElementById('vehicle-form').reset();
    document.getElementById('vehicle-modal-title').textContent = "Registo de Veículo";
    document.getElementById('v-save-btn').textContent = "Guardar Veículo";
    capturedImages = [];
    document.getElementById('captured-images-previews-vehicles').innerHTML = '';
};

window.openDetailModal = (id) => {
    const p = currentParts.find(x => x.id === id);
    if (!p) return;

    document.getElementById('det-type').textContent = types.find(t => t.id === p.type_id)?.name || 'N/A';
    document.getElementById('det-ref').textContent = p.part_number;
    document.getElementById('det-brand').textContent = p.brand || '-';
    document.getElementById('det-model').textContent = p.model || '-';
    document.getElementById('det-loc').textContent = p.location || '-';
    document.getElementById('det-status').innerHTML = getStatusBadge(p.status);
    document.getElementById('det-desc').textContent = p.description || 'Sem descrição adicional.';

    // Baixa button logic
    const baixaBtn = document.getElementById('det-baixa-btn');
    if (p.status === 'Available') {
        baixaBtn.classList.remove('hidden');
        baixaBtn.onclick = () => { closeDetailModal(); baixaPart(p.id); };
    } else {
        baixaBtn.classList.add('hidden');
    }

    // Dynamic Fields
    const dynContainer = document.getElementById('det-dyn-container');
    dynContainer.innerHTML = Object.entries(p.dynamic_data || {}).map(([k, v]) => `
        <div style="background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #f1f5f9;">
            <div style="font-size:0.7rem; color:#94a3b8; font-weight:700; text-transform:uppercase;">${k}</div>
            <div style="font-size:0.9rem; color:#1e293b; font-weight:600;">${v}</div>
        </div>
    `).join('') || '<div style="grid-column: span 2; color:#94a3b8; font-style:italic;">Nenhum campo dinâmico registado.</div>';

    // Images
    detailImages = p.images || [];
    detailIdx = 0;
    updateDetailImg();

    // Edit button shortcut
    const editBtn = document.getElementById('det-edit-btn');
    editBtn.onclick = () => { closeDetailModal(); editPart(p.id); };

    toggleModal('part-detail-modal', true);
}

window.closeDetailModal = () => {
    toggleModal('part-detail-modal', false);
}

window.changeDetailImg = (dir) => {
    if (!detailImages.length) return;
    detailIdx = (detailIdx + dir + detailImages.length) % detailImages.length;
    updateDetailImg();
}

function updateDetailImg() {
    const container = document.getElementById('detail-img-container');
    const nav = document.getElementById('detail-img-nav');

    if (!detailImages.length) {
        container.innerHTML = '<div style="color:#475569; font-size:4rem; opacity:0.3;"><i class="fa-solid fa-image"></i></div>';
        nav.innerHTML = '';
        document.getElementById('detail-prev').classList.add('hidden');
        document.getElementById('detail-next').classList.add('hidden');
        return;
    }

    container.innerHTML = `<img src="${API_BASE}${detailImages[detailIdx]}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">`;

    nav.innerHTML = detailImages.map((img, i) => `
        <div onclick="detailIdx=${i}; updateDetailImg()" style="width:12px; height:12px; border-radius:50%; background:${i === detailIdx ? '#6366f1' : 'rgba(255,255,255,0.3)'}; cursor:pointer; transition:all 0.2s;"></div>
    `).join('');

    if (detailImages.length > 1) {
        document.getElementById('detail-prev').classList.remove('hidden');
        document.getElementById('detail-next').classList.remove('hidden');
    } else {
        document.getElementById('detail-prev').classList.add('hidden');
        document.getElementById('detail-next').classList.add('hidden');
    }
}

window.editVehicle = (id) => {
    const v = currentVehicles.find(x => x.id === id);
    if (!v) return;
    openVehicleModal();
    document.getElementById('vehicle-modal-title').textContent = "Editar Veículo: " + v.make + ' ' + v.model;
    document.getElementById('v-save-btn').textContent = "Guardar Alterações";

    document.getElementById('vehicle-id').value = v.id;
    document.getElementById('vehicle-type').value = v.vehicle_type;
    document.getElementById('vehicle-vin').value = v.vin || '';
    document.getElementById('vehicle-make').value = v.make;
    document.getElementById('vehicle-model').value = v.model;
    document.getElementById('vehicle-year').value = v.year || '';
    document.getElementById('vehicle-mileage').value = v.mileage || '';
    document.getElementById('vehicle-engine').value = v.engine || '';
    document.getElementById('vehicle-price').value = v.price || '';
    document.getElementById('vehicle-show-price').checked = v.show_price;
    document.getElementById('vehicle-description').value = v.description || '';

    capturedImages = v.images ? [...v.images] : [];
    renderCapturedPreviews();
};

async function handleSaveVehicle(e) {
    e.preventDefault();
    const btn = document.getElementById('v-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';

    const id = document.getElementById('vehicle-id').value;
    try {
        const imagesUploadedPaths = await uploadPendingImages();
        const vinVal = document.getElementById('vehicle-vin').value.trim();
        const payload = {
            vin: vinVal || null,
            make: document.getElementById('vehicle-make').value,
            model: document.getElementById('vehicle-model').value,
            year: document.getElementById('vehicle-year').value,
            vehicle_type: document.getElementById('vehicle-type').value,
            price: document.getElementById('vehicle-price').value || null,
            show_price: document.getElementById('vehicle-show-price').checked,
            description: document.getElementById('vehicle-description').value,
            engine: document.getElementById('vehicle-engine').value,
            mileage: document.getElementById('vehicle-mileage').value,
            images: imagesUploadedPaths
        };

        if (id) await apiCall(`/vehicles/${id}`, 'PUT', payload);
        else await apiCall('/vehicles', 'POST', payload);

        toggleModal('vehicle-modal', false);
        showToast("Veículo guardado.");
        loadVehicles();
    } catch (err) {
        alert("Erro ao guardar veículo.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Veículo';
    }
}

window.deleteVehicle = async (id) => {
    if (confirm("Apagar permanentemente este veículo?")) {
        try {
            await apiCall(`/vehicles/${id}`, 'DELETE');
            showToast("Veículo removido.");
            loadVehicles();
        } catch (err) {
            alert("Erro ao apagar veículo: " + (err.message || "Verifique as permissões."));
        }
    }
};

// --- INQUIRIES ---

async function loadInquiries() {
    switchView('inquiries');
    const tbody = document.getElementById('inquiries-tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="padding:16px; text-align:center; color:#64748b;">A carregar...</td></tr>';
    try {
        const inqs = await apiCall('/inquiries');
        pageInquiries = 1;
        renderInquiriesTable(inqs);
    } catch (e) { console.error(e); }
}

function renderInquiriesTable(inqs) {
    const tbody = document.getElementById('inquiries-tbody');
    const total = inqs.length;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const start = (pageInquiries - 1) * ITEMS_PER_PAGE;
    const pagedItems = inqs.slice(start, start + ITEMS_PER_PAGE);

    let pCount = 0; let cCount = 0;
    inqs.forEach(iq => {
        if (['New', 'Novo', 'Pendente'].includes(iq.status)) pCount++;
        else if (iq.status === 'Contactado') cCount++;
    });

    if (inqs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:16px; text-align:center; color:#64748b;">Nenhum pedido recebido.</td></tr>';
    } else {
        let html = '';
        pagedItems.forEach(iq => {
            const clientName = iq.email ? iq.email.split('@')[0] : 'Cliente';
            let sUI = iq.status;
            if (['New', 'Novo'].includes(sUI)) sUI = 'Pendente';
            if (sUI === 'Terminado') sUI = 'Fechado';

            const dt = new Date(iq.created_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            let p_name = "Item não localizado";
            let p_sub = iq.part_id ? `Ref ID: ${iq.part_id}` : (iq.vehicle_id ? `Veh ID: ${iq.vehicle_id}` : "");

            // Try to find the part in current session data if available
            const pt = currentParts.find(p => p.id === iq.part_id);
            if (pt) {
                const tName = types.find(t => t.id === pt.type_id)?.name || 'Vários';
                p_name = `${pt.brand || ''} ${pt.model || ''}`.trim() || 'Peca s/ Marca';
                p_sub = `${tName} · Ref: ${pt.part_number}`;
            }

            // Quick Response Templates
            const clientFirstName = clientName.charAt(0).toUpperCase() + clientName.slice(1);
            const subject = encodeURIComponent(`Informação sobre: ${p_name}`);
            const bodyAvailable = encodeURIComponent(`Olá ${clientFirstName},\n\nA peça "${p_name}" (${p_sub}) que solicitou está disponível para levantamento nas nossas instalações.\n\nMelhores cumprimentos,\nEquipa AutoParts`);
            const bodySold = encodeURIComponent(`Olá ${clientFirstName},\n\nObrigado pelo seu contacto. Lamentamos informar que a peça "${p_name}" (${p_sub}) já não se encontra disponível (foi vendida).\n\nSe precisar de outra peça, estamos à disposição.\n\nMelhores cumprimentos,\nEquipa AutoParts`);

            const mailtoAvailable = `mailto:${iq.email}?subject=${subject}&body=${bodyAvailable}`;
            const mailtoSold = `mailto:${iq.email}?subject=${subject}&body=${bodySold}`;

            html += `
                <tr class="inq-row" data-status="${sUI}">
                    <td>${dt}</td>
                    <td><strong>${clientName}</strong></td>
                    <td style="font-size:0.85rem;">
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; color:#3b82f6;"><i class="fa-regular fa-envelope" style="color:#94a3b8;"></i> ${iq.email}</div>
                        <div style="display:flex; align-items:center; gap:6px; color:#334155;"><i class="fa-solid fa-phone" style="color:#94a3b8; transform:scaleX(-1);"></i> ${iq.phone}</div>
                    </td>
                    <td>
                        <div style="font-weight:600; color:#1e293b;">${p_name}</div>
                        <div style="font-size:0.8rem; color:#64748b;">${p_sub}</div>
                    </td>
                    <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${iq.message}">${iq.message || '-'}</td>
                    <td>
                        <select onchange="updateInquiryStatus(${iq.id}, this.value)" style="padding:6px; border-radius:6px; border:1px solid #e2e8f0; background:white; color:#334155; font-size:0.85rem; outline:none; cursor:pointer; width:130px;">
                            <option value="Pendente" ${sUI === 'Pendente' ? 'selected' : ''}>Pendente</option>
                            <option value="Contactado" ${sUI === 'Contactado' ? 'selected' : ''}>Contactado</option>
                            <option value="Fechado" ${sUI === 'Fechado' ? 'selected' : ''}>Fechado</option>
                        </select>
                    </td>
                    <td style="text-align:center;">
                        <div style="display:flex; gap:12px; justify-content:center; align-items:center;">
                            ${currentUser.role === 'admin' ? `<button style="background:transparent; border:none; color:#94a3b8; font-size:1.1rem; cursor:pointer; padding:0;" onclick="deleteInquiry(${iq.id})" title="Apagar"><i class="fa-regular fa-trash-can"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        renderPagination('inquiries-pagination', pageInquiries, totalPages, (p) => {
            pageInquiries = p;
            apiCall('/inquiries').then(renderInquiriesTable);
        });
    }

    document.getElementById('inq-pending-count').textContent = pCount;
    document.getElementById('inq-contacted-count').textContent = cCount;
    document.getElementById('inq-total-count').textContent = inqs.length;
    document.getElementById('inq-list-count').textContent = `${inqs.length} pedidos`;
}

window.filterInquiries = (st) => {
    const rows = document.querySelectorAll('.inq-row');
    let count = 0;
    rows.forEach(r => {
        if (!st || r.getAttribute('data-status') === st) {
            r.style.display = ''; count++;
        } else r.style.display = 'none';
    });
    document.getElementById('inq-list-count').textContent = `${count} pedidos`;
};

window.updateInquiryStatus = async (id, st) => {
    await apiCall(`/inquiries/${id}`, 'PUT', { status: st });
    showToast("Estado do pedido atualizado.");
    loadInquiries();
};

window.deleteInquiry = async (id) => {
    if (confirm('Tem a certeza que deseja apagar este pedido?')) {
        await apiCall(`/inquiries/${id}`, 'DELETE');
        loadInquiries();
    }
};

// --- SETTINGS & CONFIG ---

async function loadSettings() {
    switchView('settings');
    const [bData, lData, tData] = await Promise.all([
        apiCall('/brands'),
        apiCall('/locations'),
        apiCall('/types')
    ]);
    brands = bData;
    locations = lData;
    types = tData;

    renderSettingsBrands();
    renderSettingsLocations();
}

// renderSettingsBrands and renderSettingsLocations removed;
// brands/locations rendering is handled by renderBrandsLocationsList() in admin.html

// NOTE: editLocationName, editBrandName, deleteBrand, deleteLocation are defined
// inline in admin.html to correctly use renderBrandsLocationsList().

// Types pagination state
let pageTypes = 1;
const TYPES_PER_PAGE = 10;

window.loadTypesView = async () => {
    switchView('types');
    // Load all three in parallel so brands/locations lists are populated
    const [tData, bData, lData] = await Promise.all([
        apiCall('/types'),
        apiCall('/brands'),
        apiCall('/locations')
    ]);
    types = tData;
    brands = bData;
    locations = lData;
    pageTypes = 1;
    renderTypesPage();
    // Render brands/locations lists with their edit/delete buttons
    if (typeof renderBrandsLocationsList === 'function') {
        renderBrandsLocationsList();
    }
};

function renderTypesPage() {
    const tbody = document.getElementById('types-tbody');
    const pagDiv = document.getElementById('types-pagination');
    if (!tbody) return;

    // Sort alphabetically
    const sorted = [...types].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / TYPES_PER_PAGE));
    pageTypes = Math.min(Math.max(1, pageTypes), totalPages);

    const start = (pageTypes - 1) * TYPES_PER_PAGE;
    const page = sorted.slice(start, start + TYPES_PER_PAGE);

    tbody.innerHTML = page.map(t => {
        const fieldsHtml = (t.fields || []).map(f => {
            const style = f.keep_on_baixa
                ? "background:rgba(234,179,8,0.1);color:#eab308;border:1px solid #fef08a;padding:4px 12px;border-radius:12px;font-size:0.8rem;font-weight:600;display:inline-flex;align-items:center;gap:6px;"
                : "background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;padding:4px 12px;border-radius:12px;font-size:0.8rem;font-weight:600;display:inline-flex;align-items:center;gap:6px;";
            const icon = f.keep_on_baixa ? '<i class="fa-solid fa-lock" style="font-size:0.75rem;"></i>' : '';
            return `<span style="${style}">${icon}${f.name}</span>`;
        }).join('') || '<span style="color:#cbd5e1;font-style:italic;">Sem campos...</span>';

        return `
            <tr style="border-bottom:1px solid #e2e8f0;transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <td style="padding:16px 24px;font-weight:600;">${t.name}</td>
                <td style="padding:16px 24px;"><div style="display:flex;flex-wrap:wrap;gap:8px;">${fieldsHtml}</div></td>
                <td style="padding:16px 24px;color:#64748b;">--</td>
                <td style="padding:16px 24px;text-align:right;display:flex;gap:12px;justify-content:flex-end;">
                    <button style="background:transparent;border:none;color:#3b82f6;cursor:pointer;" onclick="openTypeModal(${t.id})"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button style="background:transparent;border:none;color:#ef4444;cursor:pointer;" onclick="deleteType(${t.id})"><i class="fa-regular fa-trash-can"></i></button>
                </td>
            </tr>`;
    }).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum tipo registado.</td></tr>`;

    // Pagination footer
    if (pagDiv) {
        const from = total === 0 ? 0 : start + 1;
        const to = Math.min(start + TYPES_PER_PAGE, total);
        pagDiv.style.display = total === 0 ? 'none' : 'flex';
        pagDiv.innerHTML = `
            <span style="font-size:0.85rem;color:var(--text-muted);font-weight:600;">
                ${from}–${to} de ${total} tipo${total !== 1 ? 's' : ''}
            </span>
            <div style="display:flex;gap:6px;align-items:center;">
                <button onclick="pageTypes--;renderTypesPage()"
                    ${pageTypes <= 1 ? 'disabled' : ''}
                    class="btn btn-secondary" style="padding:5px 12px;font-size:0.8rem;${pageTypes <= 1 ? 'opacity:0.4;cursor:not-allowed;' : ''}">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <span style="font-size:0.85rem;font-weight:700;color:var(--text-main);min-width:60px;text-align:center;">
                    Pág. ${pageTypes} / ${totalPages}
                </span>
                <button onclick="pageTypes++;renderTypesPage()"
                    ${pageTypes >= totalPages ? 'disabled' : ''}
                    class="btn btn-secondary" style="padding:5px 12px;font-size:0.8rem;${pageTypes >= totalPages ? 'opacity:0.4;cursor:not-allowed;' : ''}">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
    }
}

// Expose for inline onclick
window.renderTypesPage = renderTypesPage;



window.openNewTypeModal = () => {
    document.getElementById('edit-type-id').value = '';
    document.getElementById('edit-type-name').value = '';
    document.getElementById('type-fields-container').innerHTML = '';
    // Update modal title dynamically
    const h = document.querySelector('#type-modal h3');
    if (h) h.textContent = 'Novo Tipo de Peça';
    toggleModal('type-modal', true);
};

window.deleteType = async (id) => {
    if (confirm('Deseja apagar esta categoria? Se houver peças nesta categoria, a operação pode falhar.')) {
        try {
            await apiCall(`/types/${id}`, 'DELETE');
            showToast('Tipo removido.');
            // Refresh types list and stay on current page (clamp if needed)
            types = await apiCall('/types');
            const maxPage = Math.max(1, Math.ceil(types.length / TYPES_PER_PAGE));
            if (pageTypes > maxPage) pageTypes = maxPage;
            renderTypesPage();
            // Also refresh selectors so deleted type disappears from forms
            populateSelectors();
        } catch (err) {
            alert('Erro ao apagar tipo: ' + (err.message || 'Verifique se não existem peças registadas nesta categoria.'));
        }
    }
};


window.openTypeModal = (id) => {
    const t = types.find(x => x.id === id);
    if (!t) return;
    document.getElementById('edit-type-id').value = id;
    document.getElementById('edit-type-name').value = t.name;
    const container = document.getElementById('type-fields-container');
    container.innerHTML = '';
    (t.fields || []).forEach(f => addTypeFieldRow(f));
    // Update modal title
    const h = document.querySelector('#type-modal h3');
    if (h) h.textContent = 'Editar Tipo de Peça';
    toggleModal('type-modal', true);
};

window.closeTypeModal = () => toggleModal('type-modal', false);

window.addTypeFieldRow = (f = null) => {
    const container = document.getElementById('type-fields-container');
    const rowId = `field_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const row = document.createElement('div');
    row.className = 'type-field-row';
    row.id = rowId;
    row.style = "background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:20px; position:relative;";

    const internalId = f ? (f.id_internal || f.name.toLowerCase().replace(/ /g, '_')) : '';
    const label = f ? (f.label || f.name) : '';
    const typeS = f ? f.field_type : 'text';
    const isLocked = !!(f && f.keep_on_baixa);

    row.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <span style="font-weight:600; color:#334155; font-size:0.95rem;">Campo</span>
            <button type="button" style="background:none; border:none; color:#ef4444; font-size:1.1rem; cursor:pointer;" onclick="document.getElementById('${rowId}').remove()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:16px;">
            <div><label>ID Interno</label><input type="text" class="tf-internal" value="${internalId}" disabled style="background:#f1f5f9; width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0;"></div>
            <div><label>Label Visível</label><input type="text" class="tf-name" value="${label}" required style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0;"></div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px; margin-bottom:16px;">
            <div>
                <label>Tipo</label>
                <select class="tf-type" onchange="toggleOptsModern('${rowId}', this.value)" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; background:white;">
                    <option value="text" ${typeS === 'text' ? 'selected' : ''}>Texto</option>
                    <option value="number" ${typeS === 'number' ? 'selected' : ''}>Número</option>
                    <option value="options" ${typeS === 'options' ? 'selected' : ''}>Lista Opções</option>
                </select>
            </div>
            <div><label>Obrigatório</label><select class="tf-req" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; background:white;"><option value="sim" ${f && f.required_field ? 'selected' : ''}>Sim</option><option value="nao" ${f && !f.required_field ? 'selected' : ''}>Não</option></select></div>
            <div><label>Manter na Baixa</label><button type="button" class="tf-keep-btn" data-keep="${isLocked}" onclick="toggleKeepModern(this)" style="width:100%; padding:10px; border-radius:8px; border:1px solid #e2e8f0; background:white; cursor:pointer;">${isLocked ? '<i class="fa-solid fa-lock"></i> Bloqueado' : '<i class="fa-solid fa-lock-open"></i> Livre'}</button></div>
        </div>
        <div class="tf-opts-container" style="display:${typeS === 'options' ? 'block' : 'none'}; border-top:1px solid #e2e8f0; padding-top:16px; margin-top:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"><span style="font-size:0.85rem; font-weight:600;">Opções</span><button type="button" onclick="addOptionRow('${rowId}')" style="background:none; border:none; cursor:pointer;">+ Opção</button></div>
            <div class="opts-list" style="display:flex; flex-direction:column; gap:8px;">${(f?.options || []).map(opt => getOptionHtml(rowId, opt)).join('')}</div>
        </div>
    `;
    container.appendChild(row);
};

window.getOptionHtml = (rid, v) => `
    <div class="opt-row" style="display:flex; align-items:center; gap:12px;">
        <input type="text" value="${v}" class="tf-opt-val" style="flex:1; padding:8px; border-radius:6px; border:1px solid #e2e8f0;">
        <button type="button" style="background:none; border:none; color:#ef4444; cursor:pointer;" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    </div>`;

window.addOptionRow = (rid) => {
    const list = document.querySelector(`#${rid} .opts-list`);
    if (list) list.insertAdjacentHTML('beforeend', getOptionHtml(rid, ''));
};

window.toggleOptsModern = (rid, v) => {
    const c = document.querySelector(`#${rid} .tf-opts-container`);
    if (c) c.style.display = (v === 'options') ? 'block' : 'none';
};

window.toggleKeepModern = (btn) => {
    const cur = btn.getAttribute('data-keep') === 'true';
    btn.setAttribute('data-keep', !cur);
    btn.innerHTML = !cur ? '<i class="fa-solid fa-lock"></i> Bloqueado' : '<i class="fa-solid fa-lock-open"></i> Livre';
};

async function handleSaveType(e) {
    e.preventDefault();
    const id = document.getElementById('edit-type-id').value;
    const payload = { name: document.getElementById('edit-type-name').value.trim(), fields: [] };
    if (!payload.name) { alert('O nome do tipo é obrigatório.'); return; }
    document.querySelectorAll('.type-field-row').forEach(r => {
        const typeF = r.querySelector('.tf-type').value;
        const opts = [];
        if (typeF === 'options') {
            r.querySelectorAll('.tf-opt-val').forEach(i => { if (i.value.trim()) opts.push(i.value.trim()); });
        }
        payload.fields.push({
            name: r.querySelector('.tf-name').value,
            field_type: typeF,
            options: opts,
            keep_on_baixa: r.querySelector('.tf-keep-btn').getAttribute('data-keep') === 'true',
            required_field: r.querySelector('.tf-req').value === 'sim'
        });
    });
    try {
        if (id) {
            await apiCall(`/types/${id}`, 'PUT', payload);
            showToast('Tipo atualizado.');
            closeTypeModal();
            // Refresh in-place keeping current page
            types = await apiCall('/types');
            renderTypesPage();
        } else {
            await apiCall('/types', 'POST', payload);
            showToast('Tipo criado.');
            closeTypeModal();
            // Refresh and go to last page so newly created type is visible
            types = await apiCall('/types');
            pageTypes = Math.ceil(types.length / TYPES_PER_PAGE);
            renderTypesPage();
        }
        // Update form selectors with new/modified type
        populateSelectors();
    } catch (err) { alert('Erro ao guardar tipo: ' + (err.message || '')); }
}

// --- ANALYTICS ---
let currentPageSales = 1;

async function loadAnalytics(days = 7, btn = null) {
    switchView('analytics');
    if (btn) {
        document.querySelectorAll('.analytics-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    try {
        const [dash, pStats, inqs] = await Promise.all([
            apiCall(`/analytics/dashboard?days=${days}`),
            apiCall('/parts/stats'),
            apiCall('/inquiries')
        ]);
        document.getElementById('stat-sales').textContent = dash.total_sales;
        document.getElementById('stat-revenue').textContent = formatCurrency(dash.total_revenue);
        document.getElementById('stat-available').textContent = pStats.available;
        document.getElementById('stat-inquiries').textContent = inqs.length;
        renderSalesChart(dash.daily_sales);
        renderCategoryChart(dash.top_categories);
        renderTypeDistributionChart(dash.sales_by_type);
        renderBrandRevenueChart(dash.top_revenue_brands);
        renderBrandsList(dash.top_brands);
        loadSalesTable(1);
    } catch (e) { console.error(e); }
}

async function loadSalesTable(page = 1) {
    currentPageSales = page;
    const limit = 20;
    const skip = (page - 1) * limit;
    const q = document.getElementById('sales-search')?.value || '';
    const start = document.getElementById('sales-start-date')?.value || '';
    const end = document.getElementById('sales-end-date')?.value || '';
    const tbody = document.getElementById('analytics-sales-tbody');
    if (!tbody) return;

    try {
        let url = `/analytics/sales?skip=${skip}&limit=${limit}&q=${encodeURIComponent(q)}`;
        if (start) url += `&start_date=${start}`;
        if (end) url += `&end_date=${end}`;

        const data = await apiCall(url);

        if (!data.items || data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color:#64748b;">Nenhum registo de venda encontrado.</td></tr>';
            document.getElementById('sales-pagination-info').textContent = 'Sem resultados';
            document.getElementById('sales-prev').disabled = true;
            document.getElementById('sales-next').disabled = true;
            return;
        }

        tbody.innerHTML = data.items.map(s => `
            <tr>
                <td style="font-size:0.8rem; color:#64748b;">${new Date(s.timestamp).toLocaleString('pt-PT')}</td>
                <td><span class="part-tag" style="background:#f1f5f9; color:#475569; font-size:0.7rem;">${s.type}</span></td>
                <td>
                    <div style="font-weight:700; color:#0f172a;">${s.brand} ${s.model}</div>
                    <div style="font-size:0.75rem; color:#64748b;">${s.cat}</div>
                </td>
                <td><span style="font-weight:600;">${s.year || '--'}</span></td>
                <td style="font-weight:700; color:#0f172a;">${formatCurrency(s.price)}</td>
                <td style="font-weight:600; color:#64748b;">${s.user}</td>
                <td style="text-align:right;">
                    ${currentUser.role === 'admin' ? `
                        <button class="btn btn-secondary" onclick="deleteSalesRecord(${s.id})" style="color:#ef4444; padding:6px 10px;">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    ` : '--'}
                </td>
            </tr>
        `).join('');

        // Pagination update
        const startIdx = skip + 1;
        const endIdx = Math.min(skip + limit, data.total);
        document.getElementById('sales-pagination-info').textContent = `A mostrar ${startIdx}-${endIdx} de ${data.total} vendas`;
        document.getElementById('sales-prev').disabled = page <= 1;
        document.getElementById('sales-next').disabled = endIdx >= data.total;

    } catch (e) { console.error(e); }
}

window.setSalesPeriod = (period) => {
    const startEl = document.getElementById('sales-start-date');
    const endEl = document.getElementById('sales-end-date');
    if (!startEl || !endEl) return;

    const now = new Date();
    let start, end;

    switch (period) {
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'quarter':
            start = new Date();
            start.setMonth(now.getMonth() - 2); // Current month + 2 previous = 3 months
            start.setDate(1);
            end = now;
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            end = now;
            break;
        case 'all':
            start = null;
            end = null;
            break;
    }

    startEl.value = start ? start.toISOString().split('T')[0] : '';
    endEl.value = end ? end.toISOString().split('T')[0] : '';
    loadSalesTable(1);
};

window.clearSalesFilters = () => {
    const startEl = document.getElementById('sales-start-date');
    const endEl = document.getElementById('sales-end-date');
    const searchEl = document.getElementById('sales-search');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    if (searchEl) searchEl.value = '';
    loadSalesTable(1);
};

window.deleteSalesRecord = async (id) => {
    if (confirm('Deseja realmente eliminar este registo de venda do histórico?')) {
        try {
            await apiCall(`/analytics/history/${id}`, 'DELETE');
            showToast("Registo removido.");
            loadSalesTable(currentPageSales);
        } catch (e) { alert("Erro ao remover registo."); }
    }
}

function renderSalesChart(data) {
    const ctx = document.getElementById('salesChart')?.getContext('2d');
    if (!ctx) return;
    if (salesChart) salesChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: 'Vendas',
                data: data.map(d => d.count),
                borderColor: '#6366f1',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 2,
                pointHoverRadius: 6,
                pointBackgroundColor: '#6366f1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } },
                x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}

function renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.name),
            datasets: [{ data: data.map(d => d.count), backgroundColor: ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
    });
}

function renderTypeDistributionChart(data) {
    const ctx = document.getElementById('typeDistributionChart')?.getContext('2d');
    if (!ctx) return;
    if (typeDistributionChart) typeDistributionChart.destroy();

    // Ensure we have data
    const finalData = data && data.length > 0 ? data : [
        { name: "Peças", value: 0 },
        { name: "Veículos", value: 0 }
    ];

    typeDistributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: finalData.map(d => d.name),
            datasets: [{
                data: finalData.map(d => d.value),
                backgroundColor: ['#6366f1', '#10b981'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
            }
        }
    });
}

function renderBrandRevenueChart(data) {
    const ctx = document.getElementById('brandRevenueChart')?.getContext('2d');
    if (!ctx) return;
    if (brandRevenueChart) brandRevenueChart.destroy();

    if (!data || data.length === 0) {
        // Handle empty state gracefully
        ctx.font = "14px Inter";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText("Sem dados de receita", ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }

    brandRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Receita (€)',
                data: data.map(d => d.revenue),
                backgroundColor: '#10b981',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => value + ' €', font: { size: 10 } } },
                x: { ticks: { font: { size: 10 } } }
            }
        }
    });
}

function renderBrandsList(data) {
    const container = document.getElementById('brands-list');
    if (!container) return;
    if (data.length === 0) {
        container.innerHTML = '<div style="color:#94a3b8; font-size:0.85rem; text-align:center;">Sem dados...</div>';
        return;
    }
    const max = data[0].count;
    container.innerHTML = data.map(b => `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.85rem; font-weight:500;">${b.name}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:100px; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                    <div style="width:${(b.count / max) * 100}%; height:100%; background:#3b82f6;"></div>
                </div>
                <span style="font-size:0.85rem; font-weight:700;">${b.count}</span>
            </div>
        </div>
    `).join('');
}

// --- BULK & BACKUPS ---

window.downloadTemplate = (btn) => {
    const id = document.getElementById('bulk-type-select').value;
    if (!id) return alert('Selecione primeiro um Tipo de Peça.');
    doAuthDownload(`/bulk/template/${id}`, `Template_Tipo_${id}.xlsx`, btn);
};

// Drag-drop helpers for the ZIP upload zone
window.handleBulkDrop = (event) => {
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const input = document.getElementById('bulk-zip');
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        input.files = dt.files;
        updateBulkDropLabel(input);
        // Reset drop zone style
        const zone = document.getElementById('bulk-drop-zone');
        if (zone) {
            zone.style.borderColor = 'var(--accent)';
            zone.style.background = 'rgba(99,102,241,0.05)';
        }
    }
};

window.updateBulkDropLabel = (input) => {
    const label = document.getElementById('bulk-drop-label');
    if (!label) return;
    if (input.files && input.files.length > 0) {
        const f = input.files[0];
        const kb = (f.size / 1024).toFixed(0);
        label.innerHTML = `<strong style="color:var(--accent)"><i class="fa-solid fa-file-zipper"></i> ${f.name}</strong><br><span style="font-size:0.78rem">${kb} KB selecionado</span>`;
    } else {
        label.textContent = 'Arraste o ZIP aqui ou clique para selecionar';
    }
};

// ----------------------------------------------------------------
// Native browser download — builds a URL with the token as query param
// and opens it so the browser handles the save-to-disk dialog normally.
// ----------------------------------------------------------------
function doAuthDownload(endpoint, _filename, btn) {
    if (!token) { alert('Sessão expirada — faça login novamente.'); return; }
    const origText = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A preparar...'; }

    // Separator between existing query params and token
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${API_BASE}${endpoint}${sep}token=${encodeURIComponent(token)}`;

    // Open in new tab — browser treats it as a file download and saves to Downloads folder
    window.open(url, '_blank');

    // Re-enable button after short delay
    setTimeout(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = origText; }
        showToast('Download iniciado — verifique a pasta de Transferências.');
    }, 1500);
}

// Export full backup (JSON or Excel)
window.doBackupExport = (format, btn) => {
    const dt = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    doAuthDownload(`/backup/export?format=${format}`, `AutoParts_Backup_${format}_${dt}.zip`, btn);
};

// ─── Exportar Auditoria para Excel (filtros ativos) ───────────────────────────
window.exportAuditToExcel = async (btn) => {
    if (typeof XLSX === 'undefined') {
        alert('Biblioteca de Excel ainda a carregar. Tente novamente.');
        return;
    }
    const origHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A preparar...';

    try {
        const startDate = document.getElementById('audit-filter-start')?.value || '';
        const endDate = document.getElementById('audit-filter-end')?.value || '';

        // Fetch ALL records with active filters (no pagination)
        let url = `/analytics/history?skip=0&limit=999999`;
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;

        const data = await apiCall(url);
        const rows = (data.items || []).map(r => {
            const itemId = r.part_id ? `Peça #${r.part_id}` : (r.vehicle_id ? `Veículo #${r.vehicle_id}` : '—');
            let details = r.details || '';
            if (details.startsWith('{')) {
                try {
                    const dObj = JSON.parse(details);
                    details = Object.entries(dObj).map(([k, v]) => `${k}: ${v}`).join(' | ');
                } catch (e) { }
            }
            return {
                'Data/Hora': new Date(r.timestamp).toLocaleString('pt-PT'),
                'Utilizador': r.user || 'Sistema',
                'Ação': r.action || '—',
                'Item': itemId,
                'Preço (€)': r.price_at_action || '—',
                'Detalhes': details || '—'
            };
        });


        const ws = XLSX.utils.json_to_sheet(rows);
        // Auto-width columns
        const colWidths = Object.keys(rows[0] || {}).map(k => ({
            wch: Math.max(k.length, ...rows.map(r => String(r[k] || '').length)) + 2
        }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Auditoria');

        const dt = new Date().toISOString().slice(0, 10);
        const suffix = (startDate || endDate)
            ? `_${startDate || 'inicio'}_ate_${endDate || 'fim'}`
            : '_completo';
        XLSX.writeFile(wb, `Auditoria${suffix}_${dt}.xlsx`);
        showToast(`${rows.length} registos exportados para Excel.`);
    } catch (err) {
        alert('Erro ao exportar auditoria: ' + (err.message || ''));
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHTML;
    }
};

// ─── Exportar Vendas/Analytics para Excel (filtros ativos) ────────────────────
window.exportSalesToExcel = async (btn) => {
    if (typeof XLSX === 'undefined') {
        alert('Biblioteca de Excel ainda a carregar. Tente novamente.');
        return;
    }
    const origHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A preparar...';

    try {
        const q = document.getElementById('sales-search')?.value || '';
        const start = document.getElementById('sales-start-date')?.value || '';
        const end = document.getElementById('sales-end-date')?.value || '';

        // Fetch ALL records with active filters (no pagination)
        let url = `/analytics/sales?skip=0&limit=999999&q=${encodeURIComponent(q)}`;
        if (start) url += `&start_date=${start}`;
        if (end) url += `&end_date=${end}`;

        const data = await apiCall(url);
        const rows = (data.items || []).map(s => ({
            'Data': new Date(s.timestamp).toLocaleString('pt-PT'),
            'Tipo': s.type || '—',
            'Referência': s.cat || '—',
            'Marca': s.brand || '—',
            'Modelo': s.model || '—',
            'Ano': s.year || '—',
            'Preço (€)': s.price != null ? Number(s.price).toFixed(2) : '—',
            'Operador': s.user || '—'
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const colWidths = Object.keys(rows[0] || {}).map(k => ({
            wch: Math.max(k.length, ...rows.map(r => String(r[k] || '').length)) + 2
        }));
        ws['!cols'] = colWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Vendas');

        const dt = new Date().toISOString().slice(0, 10);
        const suffix = (start || end)
            ? `_${start || 'inicio'}_ate_${end || 'fim'}`
            : '_completo';
        XLSX.writeFile(wb, `Vendas${suffix}_${dt}.xlsx`);
        showToast(`${rows.length} vendas exportadas para Excel.`);
    } catch (err) {
        alert('Erro ao exportar vendas: ' + (err.message || ''));
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHTML;
    }
};

// Export inventory or history reports
window.doExportReport = (type, btn) => {
    const dt = new Date().toISOString().slice(0, 8);
    const filename = type === 'inventory'
        ? `Inventario_AutoParts_${dt}.xlsx`
        : `Historico_AutoParts_${dt}.xlsx`;
    doAuthDownload(`/bulk/export/${type}`, filename, btn);
};


async function handleImportZip(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-import-zip');
    const file = document.getElementById('bulk-zip').files[0];
    const resultBox = document.getElementById('bulk-results');

    if (!file) return alert('Selecione um ficheiro ZIP primeiro.');
    if (!file.name.endsWith('.zip')) return alert('O ficheiro deve ser um .zip');

    const origLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A processar...';
    if (resultBox) resultBox.style.display = 'none';

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/bulk/import`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });

        const data = await res.json();

        if (res.ok) {
            const hasErrors = data.errors && data.errors.length > 0;
            let html = `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:${hasErrors ? '12' : '0'}px;padding:12px;background:rgba(16,185,129,0.1);border-radius:8px;">
                    <i class="fa-solid fa-circle-check" style="color:var(--success);font-size:1.3rem;"></i>
                    <div>
                        <div style="font-weight:700;color:var(--success);">${data.success} peça(s) importada(s) com sucesso!</div>
                        ${hasErrors ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">${data.errors.length} erro(s) encontrado(s)</div>` : ''}
                    </div>
                </div>`;

            if (hasErrors) {
                html += `<div style="margin-top:8px;max-height:140px;overflow-y:auto;">`;
                data.errors.forEach(err => {
                    html += `<div style="padding:6px 10px;margin-bottom:4px;background:rgba(239,68,68,0.08);border-radius:6px;font-size:0.82rem;color:var(--danger);">
                        <i class="fa-solid fa-triangle-exclamation"></i> [Linha ${err.row}] ${err.msg}
                    </div>`;
                });
                html += `</div>`;
            }

            if (resultBox) { resultBox.innerHTML = html; resultBox.style.display = 'block'; }
            showToast(`${data.success} peça(s) importada(s)!`);
            loadParts();

            // Reset the file input and drop zone
            document.getElementById('bulk-zip').value = '';
            updateBulkDropLabel({ files: [] });
            const zone = document.getElementById('bulk-drop-zone');
            if (zone) {
                zone.style.borderColor = 'var(--border-color)';
                zone.style.background = 'var(--bg-body)';
            }
        } else {
            const errMsg = data.detail || 'Erro desconhecido';
            if (resultBox) {
                resultBox.innerHTML = `<div style="padding:12px;background:rgba(239,68,68,0.1);border-radius:8px;color:var(--danger);"><i class="fa-solid fa-circle-xmark"></i> <strong>Erro:</strong> ${errMsg}</div>`;
                resultBox.style.display = 'block';
            }
        }
    } catch (err) {
        alert('Falha na ligação: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origLabel;
    }
}

async function handleRestoreBackup(e) {
    e.preventDefault();
    const mode = document.getElementById('backup-mode').value;
    const file = document.getElementById('backup-zip').files[0];
    const resultBox = document.getElementById('restore-results');
    const btn = document.getElementById('btn-restore-zip');

    if (!file) return alert('Selecione um ficheiro de backup.');

    const confirmMsg = mode === 'replace'
        ? '⚠️ ATENÇÃO: Modo REPLACE apaga TODOS os dados existentes antes de restaurar.\n\nTem a certeza absoluta que quer continuar?'
        : 'Vai adicionar dados do backup sem apagar os existentes (Merge). Continuar?';

    if (!confirm(confirmMsg)) return;

    const origLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A restaurar...';
    if (resultBox) resultBox.style.display = 'none';

    const fd = new FormData();
    fd.append('file', file);

    try {
        const res = await fetch(`${API_BASE}/backup/import?mode=${mode}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        const data = await res.json();

        if (res.ok) {
            if (resultBox) {
                resultBox.innerHTML = `<div style="padding:14px;background:rgba(16,185,129,0.1);border-radius:8px;color:var(--success);font-weight:700;"><i class="fa-solid fa-circle-check"></i> Backup restaurado com sucesso! A recarregar...</div>`;
                resultBox.style.display = 'block';
            }
            showToast('Backup restaurado! A recarregar...', 'success');
            setTimeout(() => window.location.reload(), 2000);
        } else {
            const errMsg = data.detail || 'Erro desconhecido';
            if (resultBox) {
                resultBox.innerHTML = `<div style="padding:14px;background:rgba(239,68,68,0.1);border-radius:8px;color:var(--danger);"><i class="fa-solid fa-circle-xmark"></i> <strong>Falha:</strong> ${errMsg}</div>`;
                resultBox.style.display = 'block';
            }
        }
    } catch (err) {
        alert('Erro de rede: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origLabel;
    }
}

// --- BRANDING ---

function applyBranding(data) {
    const name = data.name || 'Auto Parts Stock';
    const sub = data.subtitle || 'Gestão de Stock';
    const logo = data.logo_url ? `${API_BASE}${data.logo_url}?t=${Date.now()}` : null;

    document.getElementById('sidebar-brand-name').textContent = name;
    document.getElementById('sidebar-brand-sub').textContent = sub;
    document.title = `${name} — Admin`;

    const imgHtml = logo ? `<img src="${logo}" style="width:100%;height:100%;object-fit:contain;">` : '<i class="fa-solid fa-car"></i>';
    document.getElementById('sidebar-logo').innerHTML = imgHtml;
    const loginLogo = document.getElementById('login-logo-container');
    if (loginLogo) loginLogo.innerHTML = logo ? `<img src="${logo}" style="width:100%;height:100%;object-fit:contain;">` : '<i class="fa-solid fa-car-side"></i>';

    const loginTitle = document.getElementById('login-brand-name');
    if (loginTitle) loginTitle.textContent = name + ' Admin';
    const loginSub = document.getElementById('login-brand-sub');
    if (loginSub) loginSub.textContent = data.subtitle || 'Autenticação Necessária';
}

async function loadBranding() {
    try {
        const data = await apiCall('/branding');
        applyBranding(data);
        const nameInp = document.getElementById('branding-name');
        const subInp = document.getElementById('branding-subtitle');
        if (nameInp) nameInp.value = data.name || '';
        if (subInp) subInp.value = data.subtitle || '';

        const preview = document.getElementById('branding-logo-preview');
        const removeBtn = document.getElementById('btn-remove-logo');
        if (preview) {
            if (data.logo_url) {
                preview.innerHTML = `<img src="${API_BASE}${data.logo_url}?t=${Date.now()}" style="width:100%;height:100%;object-fit:contain;">`;
                if (removeBtn) removeBtn.style.display = 'flex';
            } else {
                preview.innerHTML = '<i class="fa-solid fa-image"></i>';
                if (removeBtn) removeBtn.style.display = 'none';
            }
        }
    } catch (e) { console.warn('Branding load error', e); }
}

window.saveBranding = async () => {
    const name = document.getElementById('branding-name').value.trim();
    const subtitle = document.getElementById('branding-subtitle').value.trim();
    if (!name) return alert("Nome obrigatório");
    const fd = new FormData(); fd.append('name', name); fd.append('subtitle', subtitle);
    try {
        const res = await fetch(`${API_BASE}/branding`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }, body: fd
        });
        if (res.ok) {
            applyBranding(await res.json());
            const fb = document.getElementById('branding-save-feedback');
            fb.style.display = 'flex'; setTimeout(() => fb.style.display = 'none', 2500);
        }
    } catch (e) { alert("Erro."); }
};

window.previewAndUploadLogo = async (input) => {
    const file = input.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
        const res = await fetch(`${API_BASE}/branding/logo`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
        });
        if (res.ok) { loadBranding(); }
    } catch (e) { alert("Upload error."); }
};

window.removeLogo = async () => {
    if (confirm('Remover logo?')) {
        await apiCall('/branding/logo', 'DELETE');
        loadBranding();
    }
};

// --- CAMERA ---

window.openCamera = async () => {
    toggleModal('camera-modal', true);
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        document.getElementById('camera-video').srcObject = cameraStream;
    } catch (err) { alert("Câmara inacessível."); closeCamera(); }
};

window.closeCamera = () => {
    if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
    toggleModal('camera-modal', false);
};

window.takeSnapshot = () => {
    const vid = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    canvas.width = vid.videoWidth; canvas.height = vid.videoHeight;
    canvas.getContext('2d').drawImage(vid, 0, 0);
    canvas.toBlob((blob) => {
        if (capturedImages.length < 5) {
            capturedImages.push(new File([blob], `cap_${Date.now()}.jpg`, { type: "image/jpeg" }));
            renderCapturedPreviews();
        }
    }, 'image/jpeg', 0.85);
};

function renderCapturedPreviews() {
    const html = capturedImages.map((item, i) => {
        const src = typeof item === 'string' ? `${API_BASE}${item}` : URL.createObjectURL(item);
        return `
            <div class="preview-item">
                <img src="${src}">
                <button type="button" class="remove-p" onclick="removeCapturedImg(${i})">×</button>
            </div>
        `;
    }).join('');
    document.querySelectorAll('.captured-previews').forEach(c => c.innerHTML = html);
}

window.removeCapturedImg = (i) => { capturedImages.splice(i, 1); renderCapturedPreviews(); };

// Module export for cleaner window access (some already explicitly set)
window.loadParts = loadParts;
window.loadVehicles = loadVehicles;
window.loadInquiries = loadInquiries;
window.loadSettings = loadSettings;
window.loadAnalytics = loadAnalytics;
window.logout = logout;
window.switchView = switchView;

// Global Modal Closers
window.closePartModal = () => toggleModal('part-modal', false);
window.closeVehicleModal = () => toggleModal('vehicle-modal', false);
window.closeDetailModal = () => toggleModal('part-detail-modal', false);
window.closeBaixaModal = () => toggleModal('baixa-modal', false);
window.closeTypeModal = () => toggleModal('type-modal', false);

window.clearSystem = async () => {
    const mode = document.getElementById('cleanup-mode').value;
    const modeText = mode === 'full' ? 'TUDO (incluindo categorias e marcas)' : 'apenas o Stock e Histórico';
    
    const confirm1 = confirm(`Deseja limpar o sistema agora? Esta ação apagará ${modeText}.`);
    if (!confirm1) return;
    
    const confirm2 = confirm(`ESTA AÇÃO É IRREVERSÍVEL. Tem a certeza que deseja prosseguir com a limpeza ${mode.toUpperCase()}?`);
    if (!confirm2) return;

    try {
        const res = await apiCall('/maintenance/clear', 'POST', { mode });
        showToast(res.msg || "Sistema limpo com sucesso.");
        // Reload page to clear all local state and caches
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (err) {
        alert("Erro ao limpar sistema: " + err.message);
    }
};
