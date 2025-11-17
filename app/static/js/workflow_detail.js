(() => {
    const workflow = window.__WORKFLOW__;
    if (!workflow) return;

    const { apiRequest, formatCurrency, formatPercentage, formatValueByType } = window.dashboardUtils;
    const theme = window.__THEME__ || {};

    const state = {
        dataset: null,
        categories: new Map(),
    };

    // Estilos do select baseados no tema
    function getSelectStyles() {
        const themeName = theme.name || 'dark';
        
        const styles = {
            dark: {
                bg: 'rgb(31, 41, 55)',
                bgHover: 'rgb(55, 65, 81)',
                border: 'rgb(75, 85, 99)',
                borderHover: 'rgb(107, 114, 128)',
                borderFocus: 'rgb(59, 130, 246)',
                text: 'rgb(243, 244, 246)',
                optionBg: 'rgb(31, 41, 55)',
                optionHoverBg: 'rgb(55, 65, 81)',
                optionSelectedBg: 'rgb(59, 130, 246)',
                arrow: '%23ffffff',
                shadow: 'none',
                shadowFocus: '0 0 0 3px rgba(59, 130, 246, 0.1)'
            },
            light: {
                bg: 'white',
                bgHover: 'rgb(249, 250, 251)',
                border: 'rgb(209, 213, 219)',
                borderHover: 'rgb(156, 163, 175)',
                borderFocus: 'rgb(59, 130, 246)',
                text: 'rgb(17, 24, 39)',
                optionBg: 'white',
                optionHoverBg: 'rgb(243, 244, 246)',
                optionSelectedBg: 'rgb(59, 130, 246)',
                arrow: '%23000000',
                shadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                shadowFocus: '0 0 0 3px rgba(59, 130, 246, 0.1)'
            },
            neon: {
                bg: 'rgb(17, 24, 39)',
                bgHover: 'rgb(31, 41, 55)',
                border: 'rgb(168, 85, 247)',
                borderHover: 'rgb(192, 132, 252)',
                borderFocus: 'rgb(217, 70, 239)',
                text: 'rgb(134, 239, 172)',
                optionBg: 'rgb(17, 24, 39)',
                optionHoverBg: 'rgb(31, 41, 55)',
                optionSelectedBg: 'rgb(168, 85, 247)',
                arrow: '%2386efac',
                shadow: '0 0 10px rgba(168, 85, 247, 0.3)',
                shadowFocus: '0 0 15px rgba(168, 85, 247, 0.5)'
            },
            futurist: {
                bg: 'rgba(31, 41, 55, 0.6)',
                bgHover: 'rgba(55, 65, 81, 0.7)',
                border: 'rgba(59, 130, 246, 0.5)',
                borderHover: 'rgba(59, 130, 246, 0.7)',
                borderFocus: 'rgba(139, 92, 246, 0.8)',
                text: 'rgb(191, 219, 254)',
                optionBg: 'rgb(31, 41, 55)',
                optionHoverBg: 'rgb(55, 65, 81)',
                optionSelectedBg: 'linear-gradient(to right, rgb(59, 130, 246), rgb(139, 92, 246))',
                arrow: '%23bfdbfe',
                shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                shadowFocus: '0 0 0 3px rgba(59, 130, 246, 0.2)'
            }
        };
        
        return styles[themeName] || styles.dark;
    }

    const helpers = {
        renderBalancete,
        renderAnaliseJP,
    };

    if (workflow.tipo === 'balancete') {
        initBalancete();
    } else if (workflow.tipo === 'analise_jp') {
        initAnaliseJP();
    }

    function initBalancete() {
        const form = document.getElementById('balanceteUploadForm');
        const deleteButton = document.getElementById('deleteBalanceteUpload');
        const feedback = document.getElementById('balanceteUploadFeedback');

        if (workflow.balancete?.upload) {
            state.dataset = workflow.balancete.upload;
            renderBalancete();
        } else {
            fetchBalanceteDataset();
        }

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                feedback?.classList.add('hidden');

                const formData = new FormData(form);
                try {
                    const response = await uploadFile(`/api/workflows/${workflow.id}/balancete/upload`, formData);
                    state.dataset = response.dataset;
                    renderBalancete();
                    form.reset();
                    setFeedback(feedback, 'Upload concluído com sucesso.', true);
                } catch (error) {
                    setFeedback(feedback, error.message, false);
                }
            });
        }

        if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
                if (!state.dataset?.upload?.id) return;
                const confirmed = window.confirm('Deseja remover o upload atual?');
                if (!confirmed) return;
                try {
                    await apiRequest(`/api/workflows/${workflow.id}/balancete/upload/${state.dataset.upload.id}`, 'DELETE');
                    state.dataset = null;
                    renderBalancete();
                } catch (error) {
                    alert(error.message);
                }
            });
        }
    }

    function initAnaliseJP() {
        if (Array.isArray(workflow.analise_jp?.categories)) {
            workflow.analise_jp.categories.forEach((categoria) => {
                state.categories.set(categoria.slug, categoria.upload || null);
            });
        }
        const cards = document.querySelectorAll('[data-category]');
        cards.forEach((card) => {
            const slug = card.dataset.category;
            bindAnaliseCard(card, slug);
        });
    }

    async function fetchBalanceteDataset() {
        try {
            const dataset = await apiRequest(`/api/workflows/${workflow.id}/balancete/dataset`);
            state.dataset = dataset;
            renderBalancete();
        } catch (error) {
            console.warn('Nenhum dataset de balancete disponível.', error.message);
        }
    }

    function renderBalancete() {
        const summary = document.getElementById('balanceteSummary');
        const tableWrapper = document.getElementById('balanceteTableWrapper');
        const deleteButton = document.getElementById('deleteBalanceteUpload');
        const uploadName = document.querySelector('[data-upload-name]');
        const fileInput = document.getElementById('balanceteFileInput');
        const statusPill = document.getElementById('balanceteUploadStatus');

        if (!state.dataset) {
            if (summary) {
                summary.querySelector('[data-periodo-1]').textContent = '-';
                summary.querySelector('[data-periodo-2]').textContent = '-';
                summary.querySelector('[data-indicadores-total]').textContent = '0';
            }
            if (tableWrapper) {
                tableWrapper.innerHTML = '<p class="text-sm opacity-70">Nenhum arquivo foi enviado ainda.</p>';
            }
            if (deleteButton) deleteButton.classList.add('hidden');
            if (uploadName) uploadName.textContent = '';
            // Estilo vermelho quando aguardando upload
            if (fileInput) {
                fileInput.classList.remove('border-emerald-400/40', 'text-emerald-200');
                fileInput.classList.add('border-rose-400/40');
            }
            if (statusPill) {
                statusPill.textContent = 'aguardando upload';
                statusPill.className = 'text-xs px-2 py-0.5 rounded border border-rose-400/40 text-rose-200';
            }
            return;
        }

        const { period_labels, records, upload, value_options } = state.dataset;

        if (summary) {
            summary.querySelector('[data-periodo-1]').textContent = period_labels?.periodo_1 || '-';
            summary.querySelector('[data-periodo-2]').textContent = period_labels?.periodo_2 || '-';
            summary.querySelector('[data-indicadores-total]').textContent = records?.length || 0;
        }

        if (uploadName) {
            uploadName.textContent = upload?.nome_arquivo || '';
        }

        if (deleteButton) {
            if (upload?.id) {
                deleteButton.dataset.uploadId = upload.id;
                deleteButton.classList.remove('hidden');
            } else {
                deleteButton.classList.add('hidden');
            }
        }

        // Estilo verde quando há upload
        if (fileInput) {
            fileInput.classList.remove('border-rose-400/40');
            fileInput.classList.add('border-emerald-400/40');
        }
        if (statusPill) {
            statusPill.textContent = 'upload enviado';
            statusPill.className = 'text-xs px-2 py-0.5 rounded border border-emerald-400/40 text-emerald-200';
        }

        if (tableWrapper) {
            if (!records || !records.length) {
                tableWrapper.innerHTML = '<p class="text-sm opacity-70">Nenhum dado encontrado no arquivo enviado.</p>';
                return;
            }

            const headers = [
                { key: 'tipo_valor', label: 'Tipo' },
                { key: 'indicador', label: 'Indicador' },
                ...value_options.map((option) => ({ key: option.key, label: option.label, kind: option.value_kind })),
            ];

            const rows = records
                .map((row, rowIndex) => {
                    const tipoValor = row.tipo_valor || 'currency';
                    const cells = headers
                        .map(({ key, kind }) => {
                            const value = row[key];
                            
                            if (key === 'tipo_valor') {
                                const selectStyles = getSelectStyles();
                                const arrowSvg = `data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='14' height='8' viewBox='0 0 14 8'%3e%3cpath fill='${selectStyles.arrow}' fill-opacity='0.8' d='M1.41 0L7 5.58 12.59 0 14 1.41l-7 7-7-7z'/%3e%3c/svg%3e`;
                                
                                return `
                                    <td class="px-4 py-2 border-b border-white/5">
                                        <div class="flex justify-center">
                                            <select 
                                                class="tipo-valor-select rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none transition-all duration-200 cursor-pointer min-w-[80px] text-center"
                                                data-indicador="${row.indicador}"
                                                data-tipo-select
                                                style="
                                                    appearance: none;
                                                    background: ${selectStyles.bg};
                                                    background-image: url('${arrowSvg}');
                                                    background-repeat: no-repeat;
                                                    background-position: calc(100% - 0.75rem) center;
                                                    border: 1.5px solid ${selectStyles.border};
                                                    color: ${selectStyles.text};
                                                    padding-right: 2.5rem;
                                                    box-shadow: ${selectStyles.shadow};
                                                "
                                            >
                                                <option value="currency" ${tipoValor === 'currency' ? 'selected' : ''}>R$</option>
                                                <option value="percentage" ${tipoValor === 'percentage' ? 'selected' : ''}>%</option>
                                                <option value="multiplier" ${tipoValor === 'multiplier' ? 'selected' : ''}>x</option>
                                            </select>
                                        </div>
                                    </td>
                                `;
                            }
                            
                            if (key === 'indicador') {
                                return `<td class="px-4 py-2 border-b border-white/5 text-left font-medium whitespace-nowrap">${value || '-'}</td>`;
                            }
                            
                            // Diferença percentual sempre usa %
                            if (key === 'diferenca_percentual') {
                                return `<td class="px-4 py-2 border-b border-white/5 text-right">${formatPercentage(value)}</td>`;
                            }
                            
                            // Outras colunas usam o tipo_valor do indicador
                            return `<td class="px-4 py-2 border-b border-white/5 text-right">${formatValueByType(value, tipoValor)}</td>`;
                        })
                        .join('');
                    return `<tr>${cells}</tr>`;
                })
                .join('');

            const headerCells = headers
                .map(({ label }) => `<th class="px-4 py-2 border-b border-white/10 text-left text-xs uppercase tracking-wide opacity-70">${label}</th>`)
                .join('');

            tableWrapper.innerHTML = `
                <table class="min-w-full text-sm">
                    <thead>
                        <tr>${headerCells}</tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;

            // Bind change events e hover effects para os selects de tipo
            tableWrapper.querySelectorAll('[data-tipo-select]').forEach((select) => {
                const selectStyles = getSelectStyles();
                
                // Hover effects
                select.addEventListener('mouseenter', () => {
                    select.style.background = selectStyles.bgHover;
                    select.style.borderColor = selectStyles.borderHover;
                });
                
                select.addEventListener('mouseleave', () => {
                    select.style.background = selectStyles.bg;
                    select.style.borderColor = selectStyles.border;
                });
                
                // Focus effects
                select.addEventListener('focus', () => {
                    select.style.borderColor = selectStyles.borderFocus;
                    select.style.boxShadow = selectStyles.shadowFocus;
                });
                
                select.addEventListener('blur', () => {
                    select.style.borderColor = selectStyles.border;
                    select.style.boxShadow = selectStyles.shadow;
                });
                
                // Change event
                select.addEventListener('change', async (e) => {
                    const indicadorNome = e.target.dataset.indicador;
                    const novoTipo = e.target.value;
                    
                    try {
                        await apiRequest(
                            `/api/workflows/${workflow.id}/balancete/indicador/${encodeURIComponent(indicadorNome)}/tipo`,
                            'PATCH',
                            { tipo_valor: novoTipo }
                        );
                        
                        // Atualizar estado local
                        const record = state.dataset.records.find(r => r.indicador === indicadorNome);
                        if (record) {
                            record.tipo_valor = novoTipo;
                        }
                        
                        // Re-renderizar tabela para aplicar nova formatação
                        renderBalancete();
                    } catch (error) {
                        alert(`Erro ao atualizar tipo: ${error.message}`);
                        e.target.value = record?.tipo_valor || 'currency';
                    }
                });
            });
        }
    }

    function bindAnaliseCard(card, slug) {
        const statusLabel = card.querySelector('[data-category-status]');
        const deleteButton = card.querySelector('[data-action="delete-upload"]');
        const viewButton = card.querySelector('[data-action="view-table"]');
        const tableContainer = card.querySelector('[data-category-table]');
        const form = card.querySelector('[data-category-upload-form]');
        const feedback = card.querySelector('[data-feedback]');

        const dataset =
            state.categories.get(slug) ||
            workflow.analise_jp?.categories?.find((item) => item.slug === slug)?.upload ||
            null;
        updateCategoryUI({ statusLabel, deleteButton, viewButton, tableContainer }, dataset);

        if (form) {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                const formData = new FormData(form);
                formData.append('categoria', slug);
                setFeedback(feedback, '');
                try {
                    const response = await uploadFile(`/api/workflows/${workflow.id}/analise-jp/upload/${slug}`, formData);
                    state.categories.set(slug, response.dataset);
                    updateCategoryUI({ statusLabel, deleteButton, viewButton, tableContainer }, response.dataset);
                    form.reset();
                    setFeedback(feedback, 'Upload realizado com sucesso.', true);
                } catch (error) {
                    setFeedback(feedback, error.message, false);
                }
            });
        }

        if (deleteButton) {
            deleteButton.addEventListener('click', async () => {
                const dataset = state.categories.get(slug);
                if (!dataset?.upload?.id) return;
                if (!window.confirm('Remover upload da categoria selecionada?')) return;
                try {
                    await apiRequest(`/api/workflows/${workflow.id}/analise-jp/upload/${slug}/${dataset.upload.id}`, 'DELETE');
                    state.categories.set(slug, null);
                    updateCategoryUI({ statusLabel, deleteButton, viewButton, tableContainer }, null);
                    setFeedback(feedback, 'Upload removido.', true);
                } catch (error) {
                    setFeedback(feedback, error.message, false);
                }
            });
        }

        if (viewButton && tableContainer) {
            viewButton.addEventListener('click', async () => {
                let dataset = state.categories.get(slug);
                if (!dataset) {
                    try {
                        dataset = await apiRequest(`/api/workflows/${workflow.id}/analise-jp/dataset/${slug}`);
                        state.categories.set(slug, dataset);
                    } catch (error) {
                        alert(error.message);
                        return;
                    }
                }
                if (!dataset?.records?.length) {
                    tableContainer.innerHTML = '<p class="text-sm opacity-70">Nenhum dado disponível para esta categoria.</p>';
                } else {
                    tableContainer.innerHTML = buildAnaliseTable(dataset);
                }
                tableContainer.classList.toggle('hidden');
                viewButton.textContent = tableContainer.classList.contains('hidden') ? 'Ver tabela' : 'Ocultar tabela';
            });
        }
    }

    function updateCategoryUI(elements, dataset) {
        const { statusLabel, deleteButton, viewButton, tableContainer } = elements;
        
        // Obter o card da categoria
        const card = statusLabel?.closest('[data-category]');
        const hasUpload = Boolean(dataset?.upload?.id);
        
        if (statusLabel) {
            statusLabel.textContent = dataset ? 'com dados' : 'aguardando upload';
        }
        
        // Atualizar bordas e ícone de check
        if (card) {
            card.dataset.hasUpload = hasUpload ? 'true' : 'false';
            
            if (hasUpload) {
                // Adicionar borda verde
                card.classList.remove('border-white/10');
                card.classList.add('border-green-500/60');
                
                // Adicionar ícone de check se não existir
                let checkIcon = card.querySelector('[data-check-icon]');
                if (!checkIcon) {
                    checkIcon = document.createElement('div');
                    checkIcon.setAttribute('data-check-icon', '');
                    checkIcon.className = 'w-6 h-6 rounded-full bg-green-500/20 border border-green-500/60 flex items-center justify-center flex-shrink-0';
                    checkIcon.innerHTML = `
                        <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                    `;
                    
                    // Inserir o ícone ao lado do título
                    const titleContainer = card.querySelector('.flex.items-center.justify-between > div:first-child');
                    if (titleContainer) {
                        // Transformar em flex container se ainda não for
                        if (!titleContainer.classList.contains('flex')) {
                            titleContainer.classList.add('flex', 'items-center', 'gap-2');
                        }
                        // Inserir o ícone como primeiro elemento
                        titleContainer.insertBefore(checkIcon, titleContainer.firstChild);
                    }
                }
            } else {
                // Remover borda verde
                card.classList.remove('border-green-500/60');
                card.classList.add('border-white/10');
                
                // Remover ícone de check
                const checkIcon = card.querySelector('[data-check-icon]');
                if (checkIcon) {
                    checkIcon.remove();
                }
                
                // Remover classes flex do container do título se necessário
                const titleContainer = card.querySelector('.flex.items-center.justify-between > div:first-child');
                if (titleContainer && titleContainer.children.length === 1) {
                    titleContainer.classList.remove('flex', 'items-center', 'gap-2');
                }
            }
        }
        
        if (deleteButton) {
            if (dataset?.upload?.id) {
                deleteButton.dataset.uploadId = dataset.upload.id;
                deleteButton.classList.remove('hidden');
            } else {
                deleteButton.classList.add('hidden');
            }
        }
        if (viewButton) {
            if (dataset?.records?.length) {
                viewButton.disabled = false;
                viewButton.classList.remove('opacity-40', 'cursor-not-allowed');
            } else {
                viewButton.disabled = true;
                viewButton.classList.add('opacity-40', 'cursor-not-allowed');
            }
        }
        if (tableContainer) {
            tableContainer.classList.add('hidden');
            tableContainer.innerHTML = '';
        }
    }

    function buildAnaliseTable(dataset) {
        const fields = dataset.fields || [];
        const rows = (dataset.records || []).map((record) => {
            const cells = fields
                .map((key) => `<td class="px-3 py-2 border-b border-white/5">${record[key] ?? '-'}</td>`)
                .join('');
            return `<tr>${cells}</tr>`;
        });

        const header = fields
            .map((key) => `<th class="px-3 py-2 border-b border-white/10 text-left text-xs uppercase tracking-wide opacity-70">${key}</th>`)
            .join('');

        return `
            <div class="overflow-x-auto scrollbar-thin mt-3">
                <table class="min-w-full text-sm">
                    <thead><tr>${header}</tr></thead>
                    <tbody>${rows.join('')}</tbody>
                </table>
            </div>
        `;
    }

    function setFeedback(element, message, success = true) {
        if (!element) return;
        element.textContent = message;
        element.classList.toggle('hidden', !message);
        element.classList.toggle('text-emerald-300', success);
        element.classList.toggle('text-rose-300', !success);
    }

    async function uploadFile(url, formData) {
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || data.message || `Erro ${response.status}`);
        }
        return response.json();
    }

    function renderAnaliseJP() {
        // placeholder kept for parity; cards render on demand
    }
})();
