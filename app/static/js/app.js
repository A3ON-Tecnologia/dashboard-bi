(() => {
    const themeModal = document.getElementById('themeModal');
    const openTrigger = document.getElementById('themeTrigger');
    const closeButtons = themeModal ? themeModal.querySelectorAll('[data-theme-close]') : [];
    const body = document.body;

    function toggleModal(show) {
        if (!themeModal) return;
        themeModal.classList.toggle('hidden', !show);
        body.classList.toggle('overflow-hidden', show);
    }

    if (openTrigger && themeModal) {
        openTrigger.addEventListener('click', () => toggleModal(true));
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

window.dashboardUtils = {
    apiRequest,
    formatCurrency,
    formatPercentage,
};
