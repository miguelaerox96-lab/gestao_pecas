/**
 * searchable-select.js
 * Lightweight searchable dropdown component — no dependencies.
 *
 * Usage:
 *   const ss = new SearchableSelect(targetElement, options, config);
 *   ss.setValue(value);
 *   ss.getValue();
 *   ss.setOptions(newOptions);
 *   ss.destroy();
 *
 * Config:
 *   placeholder   — text shown when nothing is selected (default: 'Selecione...')
 *   searchPlaceholder — input placeholder (default: 'Pesquisar...')
 *   inline        — boolean, renders without border for use inside filter bars
 *   onChange      — callback(value, label) fired on selection
 */

class SearchableSelect {
    constructor(anchorEl, options = [], config = {}) {
        this._anchor    = anchorEl;           // the element we replace / attach to
        this._options   = options;            // [{ value, label }]
        this._config    = {
            placeholder:       'Selecione...',
            searchPlaceholder: 'Pesquisar...',
            inline:            false,
            onChange:          null,
            ...config
        };
        this._value     = '';
        this._label     = '';
        this._open      = false;
        this._focusIdx  = -1;

        this._build();
        this._bindGlobal();

        // If there is already a <select> as the anchor, mirror its current value
        if (anchorEl.tagName === 'SELECT') {
            const sel = anchorEl;
            if (sel.value) {
                const opt = options.find(o => String(o.value) === String(sel.value));
                if (opt) this._setValue(opt.value, opt.label, false);
            }
            // Hide original select but keep it in DOM so form submission still works
            sel.style.display = 'none';
        }
    }

    // ------------------------------------------------------------------ build

    _build() {
        const cfg   = this._config;
        const wrap  = document.createElement('div');
        wrap.className = 'ss-wrap' + (cfg.inline ? ' ss-inline' : '');

        const trigger = document.createElement('button');
        trigger.type      = 'button';
        trigger.className = 'ss-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.innerHTML = `
            <span class="ss-label placeholder">${cfg.placeholder}</span>
            <i class="fa-solid fa-chevron-down ss-arrow"></i>
        `;

        const dropdown = document.createElement('div');
        dropdown.className = 'ss-dropdown';
        dropdown.style.display = 'none';
        dropdown.innerHTML = `
            <div class="ss-search-wrap">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input class="ss-search-input" type="text" placeholder="${cfg.searchPlaceholder}" autocomplete="off" spellcheck="false">
            </div>
            <div class="ss-list" role="listbox"></div>
        `;

        wrap.appendChild(trigger);
        wrap.appendChild(dropdown);

        // Insert wrapper right after the anchor element
        this._anchor.insertAdjacentElement('afterend', wrap);

        this._wrap     = wrap;
        this._trigger  = trigger;
        this._dropdown = dropdown;
        this._searchEl = dropdown.querySelector('.ss-search-input');
        this._listEl   = dropdown.querySelector('.ss-list');

        this._renderOptions(this._options, '');
        this._bindEvents();
    }

    // --------------------------------------------------------------- events

    _bindEvents() {
        this._trigger.addEventListener('click', () => this._toggleOpen());
        this._trigger.addEventListener('keydown', e => this._onTriggerKey(e));

        this._searchEl.addEventListener('input', () => {
            this._focusIdx = -1;
            this._renderOptions(this._options, this._searchEl.value.trim());
        });
        this._searchEl.addEventListener('keydown', e => this._onSearchKey(e));
    }

    _bindGlobal() {
        this._globalClick = (e) => {
            if (this._open && !this._wrap.contains(e.target)) this._close();
        };
        document.addEventListener('mousedown', this._globalClick);
    }

    // ------------------------------------------------------- open / close

    _toggleOpen() {
        this._open ? this._close() : this._openDropdown();
    }

    _openDropdown() {
        this._open = true;
        this._dropdown.style.display = 'block';
        this._trigger.classList.add('open');
        this._trigger.setAttribute('aria-expanded', 'true');
        this._searchEl.value = '';
        this._renderOptions(this._options, '');
        this._focusIdx = -1;

        // Ensure dropdown doesn't overflow viewport
        requestAnimationFrame(() => {
            const rect   = this._dropdown.getBoundingClientRect();
            const bottom = rect.bottom;
            if (bottom > window.innerHeight - 12) {
                this._dropdown.style.top  = 'auto';
                this._dropdown.style.bottom = 'calc(100% + 6px)';
            } else {
                this._dropdown.style.top  = 'calc(100% + 6px)';
                this._dropdown.style.bottom = 'auto';
            }
            this._searchEl.focus();
        });
    }

    _close() {
        this._open = false;
        this._dropdown.style.display = 'none';
        this._trigger.classList.remove('open');
        this._trigger.setAttribute('aria-expanded', 'false');
        this._focusIdx = -1;
    }

    // ----------------------------------------------- render options list

    _renderOptions(options, query) {
        const q     = query.toLowerCase();
        const items = q
            ? options.filter(o => o.label.toLowerCase().includes(q))
            : options;

        if (!items.length) {
            this._listEl.innerHTML = '<div class="ss-no-results">Sem resultados</div>';
            return;
        }

        this._listEl.innerHTML = items.map(o => {
            const isSelected   = String(o.value) === String(this._value);
            const isPlaceholder = o.value === '';
            const labelHtml     = q ? this._highlight(o.label, q) : o.label;
            return `
                <div class="ss-option${isSelected ? ' selected' : ''}${isPlaceholder ? ' ss-option-placeholder' : ''}"
                     role="option"
                     aria-selected="${isSelected}"
                     data-value="${o.value}"
                     data-label="${o.label.replace(/"/g, '&quot;')}">
                    ${labelHtml}
                </div>`;
        }).join('');

        // Click handler for each option
        this._listEl.querySelectorAll('.ss-option').forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault(); // prevent blur on trigger
                this._select(el.dataset.value, el.dataset.label);
            });
        });
    }

    _highlight(text, query) {
        const idx = text.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return text;
        return text.slice(0, idx)
            + `<span class="ss-highlight">${text.slice(idx, idx + query.length)}</span>`
            + text.slice(idx + query.length);
    }

    // ---------------------------------------------------- keyboard nav

    _onTriggerKey(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (!this._open) this._openDropdown();
        }
        if (e.key === 'Escape') this._close();
    }

    _onSearchKey(e) {
        const opts = Array.from(this._listEl.querySelectorAll('.ss-option'));
        if (!opts.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._focusIdx = Math.min(this._focusIdx + 1, opts.length - 1);
            this._applyFocus(opts);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._focusIdx = Math.max(this._focusIdx - 1, 0);
            this._applyFocus(opts);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this._focusIdx >= 0 && opts[this._focusIdx]) {
                const el = opts[this._focusIdx];
                this._select(el.dataset.value, el.dataset.label);
            }
        } else if (e.key === 'Escape') {
            this._close();
            this._trigger.focus();
        }
    }

    _applyFocus(opts) {
        opts.forEach((o, i) => {
            o.classList.toggle('focused', i === this._focusIdx);
            if (i === this._focusIdx) o.scrollIntoView({ block: 'nearest' });
        });
    }

    // --------------------------------------------------------- selection

    _select(value, label) {
        this._setValue(value, label, true);
        this._close();
        this._trigger.focus();
    }

    _setValue(value, label, fireChange) {
        this._value = value;
        this._label = label;

        const labelEl = this._trigger.querySelector('.ss-label');
        if (value === '' || value === null || value === undefined) {
            labelEl.textContent = this._config.placeholder;
            labelEl.classList.add('placeholder');
        } else {
            labelEl.textContent = label;
            labelEl.classList.remove('placeholder');
        }

        // Keep original <select> in sync (if used that way)
        if (this._anchor.tagName === 'SELECT') {
            this._anchor.value = value;
            // Dispatch a real 'change' event so external onchange handlers fire
            this._anchor.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (fireChange && this._config.onChange) {
            this._config.onChange(value, label);
        }
    }

    // --------------------------------------------------------- public API

    getValue()  { return this._value; }
    getLabel()  { return this._label; }

    setValue(value) {
        const opt = this._options.find(o => String(o.value) === String(value));
        if (opt) {
            this._setValue(opt.value, opt.label, false);
        } else if (value === '' || value === null || value === undefined) {
            this._setValue('', '', false);
        }
    }

    setOptions(options) {
        this._options = options;
        // If current value no longer exists, reset
        if (this._value && !options.find(o => String(o.value) === String(this._value))) {
            this._setValue('', '', false);
        }
        if (this._open) this._renderOptions(this._options, this._searchEl.value.trim());
    }

    reset() {
        this._setValue('', '', false);
    }

    destroy() {
        document.removeEventListener('mousedown', this._globalClick);
        this._wrap.remove();
        if (this._anchor.tagName === 'SELECT') {
            this._anchor.style.display = '';
        }
    }
}
