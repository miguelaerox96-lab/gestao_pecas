// js/api.js - Centralized API and Auth logic

const API_BASE = window.location.origin;
let token = localStorage.getItem('atp_token');

/**
 * Perform an authenticated API call.
 */
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        if (response.status === 401) {
            handleAuthError();
            return null;
        }

        if (response.status === 204) return true;
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'API Error');
        return data;
    } catch (error) {
        console.error(`API Call failed [${method} ${endpoint}]:`, error);
        throw error;
    }
}

function handleAuthError() {
    console.warn("Unauthorized! Redirecting to login/cleaning state.");
    localStorage.removeItem('atp_token');
    token = null;
    // If on admin page, show login
    if (window.location.pathname.includes('admin.html')) {
        const loginView = document.getElementById('login-view');
        const appView = document.getElementById('app-view');
        if (loginView && appView) {
            loginView.classList.remove('hidden');
            appView.classList.add('hidden');
        }
    }
}

const showToast = (msg, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
        <span>${msg}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
};

// Expose to window for backward compatibility or global access
window.API_BASE = API_BASE;
window.apiCall = apiCall;
window.showToast = showToast;
