(() => {
    const themeModal = document.getElementById('themeModal');
    const openTrigger = document.getElementById('themeTrigger');
    const closeButtons = themeModal ? themeModal.querySelectorAll('[data-theme-close]') : [];
    const body = document.body;

    function toggleModal(show) {
        if (!themeModal) return;
        if (show) {
            themeModal.classList.remove('hidden');
            requestAnimationFrame(() => {
                body.classList.add('overflow-hidden');
            });
        } else {
            themeModal.classList.add('hidden');
            body.classList.remove('overflow-hidden');
        }
    }

    if (openTrigger && themeModal) {
        openTrigger.addEventListener('click', () => {
            requestAnimationFrame(() => toggleModal(true));
        });
    }

    closeButtons.forEach((button) => {
        button.addEventListener('click', () => toggleModal(false));
    });

    if (themeModal) {
        themeModal.addEventListener('click', (event) => {
            if (event.target === themeModal) {
                toggleModal(false);
            }
        });
    }

    if (themeModal) {
        themeModal.querySelectorAll('[data-theme-choice]').forEach((choice) => {
            choice.addEventListener('click', async () => {
                const slug = choice.dataset.themeChoice;
                try {
                    await apiRequest('/api/theme', 'POST', { theme: slug });
                    window.location.reload();
                } catch (error) {
                    console.error('Falha ao aplicar tema', error);
                    choice.classList.add('border-red-400/60');
                    setTimeout(() => choice.classList.remove('border-red-400/60'), 1500);
                }
            });
        });
    }
})();

async function apiRequest(url, method = 'GET', body = null) {
    const config = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    const response = await fetch(url, config);
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data.error || data.message || `Erro ${response.status}`;
        throw new Error(message);
    }
    if (response.status === 204) {
        return null;
    }
    return response.json().catch(() => ({}));
}

function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${Number(value).toFixed(2)}%`;
}

function formatMultiplier(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${Number(value).toFixed(2)}x`;
}

function formatValueByType(value, tipo) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    
    switch (tipo) {
        case 'currency':
            return formatCurrency(value);
        case 'percentage':
            return formatPercentage(value);
        case 'multiplier':
            return formatMultiplier(value);
        default:
            return formatCurrency(value);
    }
}

function setFlashToast(data) {
    try {
        sessionStorage.setItem('flashToast', JSON.stringify(data));
    } catch {}
}

function navigateWithToast(url, data) {
    setFlashToast(data);
    window.location.href = url;
}

function reloadWithToast(data) {
    setFlashToast(data);
    window.location.reload();
}

window.dashboardUtils = {
    apiRequest,
    formatCurrency,
    formatPercentage,
    formatMultiplier,
    formatValueByType,
    showToast,
    setFlashToast,
    navigateWithToast,
    reloadWithToast,
};

// Toast notifications
function ensureToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }
    return container;
}

function showToast(opts) {
    const { message, type = 'success', duration = 3000 } = (typeof opts === 'string') ? { message: opts } : (opts || {});
    if (!message) return;
    const container = ensureToastContainer();

    const base = 'pointer-events-auto shadow-lg rounded-lg px-4 py-3 flex items-start gap-3 border text-white';
    const color = type === 'error'
        ? 'bg-rose-500/90 border-rose-400/60'
        : type === 'info'
            ? 'bg-blue-500/90 border-blue-400/60'
            : 'bg-emerald-500/90 border-emerald-400/60';

    const toast = document.createElement('div');
    toast.className = `${base} ${color} opacity-0 translate-y-2 transition-all duration-150`;

    // Icon per type
    const iconWrap = document.createElement('div');
    iconWrap.className = 'shrink-0 mt-0.5 transform scale-90 transition-transform duration-200';
    const iconSvgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(iconSvgNS, 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.classList.add('opacity-95');
    let path1, path2;
    if (type === 'error') {
        path1 = document.createElementNS(iconSvgNS, 'path');
        path1.setAttribute('d', 'M12 9v4m0 4h.01M10.29 3.86l-7.5 12.99A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.71-3.15l-7.5-12.99a2 2 0 0 0-3.42 0z');
        svg.appendChild(path1);
    } else if (type === 'info') {
        path1 = document.createElementNS(iconSvgNS, 'circle');
        path1.setAttribute('cx', '12');
        path1.setAttribute('cy', '12');
        path1.setAttribute('r', '10');
        path2 = document.createElementNS(iconSvgNS, 'path');
        path2.setAttribute('d', 'M12 16v-4m0-4h.01');
        svg.appendChild(path1);
        svg.appendChild(path2);
    } else {
        // success
        path1 = document.createElementNS(iconSvgNS, 'path');
        path1.setAttribute('d', 'M22 11.08V12a10 10 0 1 1-5.93-9.14');
        path2 = document.createElementNS(iconSvgNS, 'polyline');
        path2.setAttribute('points', '22 4 12 14.01 9 11');
        svg.appendChild(path1);
        svg.appendChild(path2);
    }
    iconWrap.appendChild(svg);

    const text = document.createElement('div');
    text.className = 'text-sm font-medium';
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('type', 'button');
    closeBtn.className = 'ml-auto -mr-1 inline-flex items-center justify-center rounded-md px-2 py-1 text-xs opacity-70 hover:opacity-100 hover:bg-white/10 transition';
    closeBtn.innerHTML = '✕';

    let hideTimer = null;
    const remove = () => {
        if (!toast.isConnected) return;
        toast.classList.add('opacity-0', 'translate-y-2');
        toast.classList.remove('opacity-100', 'translate-y-0');
        setTimeout(() => toast.remove(), 160);
    };

    closeBtn.addEventListener('click', () => {
        if (hideTimer) clearTimeout(hideTimer);
        remove();
    });

    toast.appendChild(iconWrap);
    toast.appendChild(text);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    // animate in
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
        toast.classList.add('opacity-100', 'translate-y-0');
        iconWrap.classList.remove('scale-90');
        iconWrap.classList.add('scale-100');
    });

    hideTimer = setTimeout(remove, duration);
}

// Flash toast across navigations
try {
    const flash = sessionStorage.getItem('flashToast');
    if (flash) {
        sessionStorage.removeItem('flashToast');
        const data = JSON.parse(flash);
        // Defer a tick to ensure layout is ready
        setTimeout(() => showToast(data), 50);
    }
} catch {}
