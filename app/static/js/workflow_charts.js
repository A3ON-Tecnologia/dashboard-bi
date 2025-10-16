(() => {
    const workflow = window.__WORKFLOW__;
    if (!workflow || !window.dashboardUtils) {
        return;
    }

    const { apiRequest, formatCurrency, formatPercentage } = window.dashboardUtils;
    const ChartJs = window.Chart;

    if (ChartJs && ChartJs.register && window.ChartDataLabels) {
        ChartJs.register(window.ChartDataLabels);
    }

    const COLOR_PALETTE = [
        '#4ade80',
        '#38bdf8',
        '#f97316',
        '#a78bfa',
        '#f472b6',
        '#facc15',
        '#22d3ee',
        '#fb7185',
        '#34d399',
        '#60a5fa',
    ];

    const CHART_TYPES = [
        { type: 'bar', label: 'Barras verticais', description: 'Comparacao entre categorias com colunas.' },
        { type: 'bar-horizontal', label: 'Barras horizontais', description: 'Comparacao usando barras na horizontal.' },
        { type: 'line', label: 'Linha', description: 'Tendencias ou evolucao ao longo do tempo.' },
        { type: 'area', label: 'Area', description: 'Linha com preenchimento para destacar volume.' },
        { type: 'pie', label: 'Pizza', description: 'Distribuicao percentual por categoria.' },
        { type: 'donut', label: 'Donut', description: 'Variacao do grafico de pizza com centro oco.' },
        { type: 'table', label: 'Tabela', description: 'Exibicao tabular dos dados selecionados.' },
    ];

    const STACKABLE_TYPES = new Set(['bar', 'bar-horizontal', 'area']);
    const DATA_LABEL_TYPES = new Set(['bar', 'bar-horizontal', 'line', 'area', 'pie', 'donut']);

    const datasetSummary = document.getElementById('datasetSummary');
    const chartGrid = document.getElementById('chartGrid');
    const refreshButton = document.getElementById('refreshCharts');
    const openModalButton = document.getElementById('openChartModal');

    const chartModal = document.getElementById('chartModal');
    const chartModalTitle = document.getElementById('chartModalTitle');
    const stepIndicators = Array.from(chartModal?.querySelectorAll('[data-step-indicator]') || []);
    const stepContainers = Array.from(chartModal?.querySelectorAll('[data-chart-step]') || []);
    const closeModalButtons = Array.from(chartModal?.querySelectorAll('[data-chart-close]') || []);
    const nextButton = chartModal?.querySelector('[data-chart-next]');
    const prevButton = chartModal?.querySelector('[data-chart-prev]');
    const saveButton = chartModal?.querySelector('[data-chart-save]');
    const modalFeedback = document.getElementById('chartModalFeedback');

    const chartTypeChoices = document.getElementById('chartTypeChoices');
    const chartNameInput = document.getElementById('chartNameInput');

    const balanceteConfig = document.getElementById('balanceteConfig');
    const indicatorOptionsContainer = document.getElementById('indicatorOptions');
    const metricOptionsContainer = document.getElementById('metricOptions');

    const analiseConfig = document.getElementById('analiseConfig');
    const chartCategorySelect = document.getElementById('chartCategorySelect');
    const dimensionOptionsContainer = document.getElementById('dimensionOptions');
    const valueOptionsContainer = document.getElementById('valueOptions');
    const rowOptionsContainer = document.getElementById('rowOptions');

    const chartPreviewCanvas = document.getElementById('chartPreview');
    const tablePreview = document.getElementById('tablePreview');
    const chartOptionStacked = document.getElementById('chartOptionStacked');
    const chartOptionDataLabels = document.getElementById('chartOptionDataLabels');
    
    // Modal de confirmação de exclusão
    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    const deleteChartName = document.getElementById('deleteChartName');
    const deleteChartType = document.getElementById('deleteChartType');
    const deleteCancelButtons = deleteConfirmModal?.querySelectorAll('[data-delete-cancel]');
    const deleteConfirmButton = deleteConfirmModal?.querySelector('[data-delete-confirm]');
    
    let pendingDeleteIndex = null;

    const state = {
        workflowType: workflow.tipo,
        dataset: null,
        charts: [],
        categories: [],
        categoryDatasets: new Map(),
        chartInstances: new Map(),
        previewInstance: null,
        loading: false,
        modal: createEmptyModalState(),
    };

    // Inicializar categorias para analise_jp
    if (state.workflowType === 'analise_jp' && workflow.analise_jp?.categories) {
        state.categories = workflow.analise_jp.categories.map(cat => ({
            slug: cat.slug,
            nome: cat.label || cat.nome || cat.slug,
            label: cat.label || cat.nome || cat.slug
        }));
    }

    // Inicializar gráficos existentes
    if (state.workflowType === 'balancete' && Array.isArray(workflow.balancete?.charts)) {
        state.charts = normalizeCharts(workflow.balancete.charts);
    } else if (state.workflowType === 'analise_jp' && Array.isArray(workflow.analise_jp?.charts)) {
        state.charts = normalizeCharts(workflow.analise_jp.charts);
    }

    init();

    async function init() {
        populateChartTypeChoices();
        bindBaseEvents();
        await loadData();
        await loadCharts();
        renderDatasetSummary();
        renderChartGrid();
        updateModalAvailability();
    }

    function bindBaseEvents() {
        if (refreshButton) refreshButton.addEventListener('click', () => loadData());
        if (openModalButton) openModalButton.addEventListener('click', () => openModal('create'));
        if (chartModal) {
            chartModal.addEventListener('click', (event) => {
                if (event.target === chartModal) closeModal();
            });
        }
        closeModalButtons.forEach((button) => button.addEventListener('click', () => closeModal()));
        if (nextButton) nextButton.addEventListener('click', () => handleNextStep());
        if (prevButton) prevButton.addEventListener('click', () => handlePrevStep());
        if (saveButton) saveButton.addEventListener('click', () => saveChart());
        if (chartNameInput) {
            chartNameInput.addEventListener('input', (event) => {
                state.modal.config.name = event.target.value;
                if (state.modal.step === 3) renderPreview();
            });
        }
        if (chartOptionStacked) {
            chartOptionStacked.addEventListener('change', (event) => {
                state.modal.config.options.stacked = event.target.checked;
                if (state.modal.step === 3) renderPreview();
            });
        }
        if (chartOptionDataLabels) {
            chartOptionDataLabels.addEventListener('change', (event) => {
                state.modal.config.options.dataLabels = event.target.checked;
                if (state.modal.step === 3) renderPreview();
            });
        }
        if (chartTypeChoices) chartTypeChoices.addEventListener('click', (event) => handleChartTypeChoice(event));
        if (indicatorOptionsContainer) indicatorOptionsContainer.addEventListener('change', (event) => handleIndicatorToggle(event));
        if (metricOptionsContainer) {
            metricOptionsContainer.addEventListener('change', (event) => handleMetricToggle(event));
            metricOptionsContainer.addEventListener('input', (event) => handleMetricInput(event));
        }
        if (chartCategorySelect) chartCategorySelect.addEventListener('change', (event) => handleCategoryChange(event));
        if (dimensionOptionsContainer) dimensionOptionsContainer.addEventListener('change', (event) => handleDimensionToggle(event));
        if (valueOptionsContainer) {
            valueOptionsContainer.addEventListener('change', (event) => handleValueMetricToggle(event));
            valueOptionsContainer.addEventListener('input', (event) => handleValueMetricInput(event));
        }
        if (rowOptionsContainer) rowOptionsContainer.addEventListener('change', (event) => handleRowToggle(event));
        
        // Modal de exclusão
        if (deleteConfirmModal) {
            deleteConfirmModal.addEventListener('click', (event) => {
                if (event.target === deleteConfirmModal) closeDeleteModal();
            });
        }
        deleteCancelButtons?.forEach(btn => {
            btn.addEventListener('click', () => closeDeleteModal());
        });
        if (deleteConfirmButton) {
            deleteConfirmButton.addEventListener('click', () => confirmDelete());
        }
    }

    async function loadData() {
        if (state.loading) return;
        state.loading = true;
        
        try {
            if (state.workflowType === 'balancete') {
                try {
                    console.log('Carregando dataset de balancete para workflow', workflow.id);
                    const response = await apiRequest(`/api/workflows/${workflow.id}/balancete/dataset`, 'GET');
                    console.log('Resposta do dataset:', response);
                    if (response) {
                        state.dataset = response;
                        console.log('Dataset carregado com sucesso:', state.dataset);
                    }
                } catch (error) {
                    console.log('Erro ao carregar dataset de balancete:', error.message);
                    state.dataset = null;
                }
            } else if (state.workflowType === 'analise_jp') {
                for (const category of state.categories) {
                    if (!state.categoryDatasets.has(category.slug)) {
                        try {
                            const response = await apiRequest(`/api/workflows/${workflow.id}/analise-jp/dataset/${category.slug}`, 'GET');
                            if (response) {
                                state.categoryDatasets.set(category.slug, response);
                            }
                        } catch (error) {
                            console.log(`Nenhum dataset para categoria ${category.slug}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            state.loading = false;
        }
    }
    
    async function loadCharts() {
        try {
            console.log('Carregando gráficos salvos...');
            const endpoint = state.workflowType === 'balancete'
                ? `/api/workflows/${workflow.id}/balancete/charts`
                : `/api/workflows/${workflow.id}/analise-jp/charts`;
            
            const response = await apiRequest(endpoint, 'GET');
            console.log('Resposta dos gráficos:', response);
            
            if (response && response.charts) {
                state.charts = normalizeCharts(response.charts);
                console.log('Gráficos carregados:', state.charts.length);
            }
        } catch (error) {
            console.error('Erro ao carregar gráficos:', error);
        }
    }

    function renderDatasetSummary() {
        if (!datasetSummary) return;
        
        console.log('Renderizando sumário. Tipo:', state.workflowType, 'Dataset:', state.dataset);
        
        let html = '';
        
        if (state.workflowType === 'balancete') {
            // Verificar se há dataset E se tem records (pode ter dataset vazio)
            if (state.dataset && (state.dataset.records || state.dataset.indicator_options)) {
                const totalIndicadores = state.dataset.total_indicadores || state.dataset.records?.length || 0;
                const periodo1 = state.dataset.period_labels?.periodo_1 || 'Período 1';
                const periodo2 = state.dataset.period_labels?.periodo_2 || 'Período 2';
                
                html = `
                    <div class="flex flex-wrap gap-4">
                        <div class="flex items-center gap-2">
                            <span class="text-green-400">●</span>
                            <span><strong>${totalIndicadores}</strong> indicadores disponíveis</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-blue-400">●</span>
                            <span>Períodos: <strong>${periodo1}</strong> vs <strong>${periodo2}</strong></span>
                        </div>
                    </div>
                `;
            } else {
                html = '<p class="text-yellow-400">⚠ Nenhum dado de balancete encontrado. Faça o upload de um arquivo primeiro.</p>';
            }
        } else if (state.workflowType === 'analise_jp') {
            if (state.categories.length > 0) {
                const categoriesWithData = state.categories.filter(cat => state.categoryDatasets.has(cat.slug));
                html = `
                    <div class="flex flex-wrap gap-4">
                        <div class="flex items-center gap-2">
                            <span class="text-green-400">●</span>
                            <span><strong>${categoriesWithData.length}</strong> de <strong>${state.categories.length}</strong> categorias com dados</span>
                        </div>
                    </div>
                    <div class="mt-3 space-y-2">
                        ${state.categories.map(cat => {
                            const hasData = state.categoryDatasets.has(cat.slug);
                            const dataset = state.categoryDatasets.get(cat.slug);
                            const rowCount = dataset?.records?.length || 0;
                            const colCount = dataset?.fields?.length || 0;
                            
                            return `
                                <div class="flex items-center gap-3 text-sm">
                                    <span class="${hasData ? 'text-green-400' : 'text-gray-500'}">●</span>
                                    <span class="font-medium">${cat.nome || cat.label}</span>
                                    ${hasData ? `<span class="opacity-60">(${rowCount} linhas, ${colCount} colunas)</span>` : '<span class="opacity-60">(sem dados)</span>'}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            } else {
                html = '<p class="text-yellow-400">⚠ Nenhuma categoria configurada para análise JP.</p>';
            }
        }
        
        datasetSummary.innerHTML = html;
    }

    function updateModalAvailability() {
        if (!openModalButton) return;
        
        const hasData = state.workflowType === 'balancete' 
            ? (state.dataset && (state.dataset.records?.length > 0 || state.dataset.indicator_options?.length > 0))
            : (state.categories.length > 0 && state.categoryDatasets.size > 0);
        
        if (hasData) {
            openModalButton.disabled = false;
            openModalButton.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            openModalButton.disabled = true;
            openModalButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    function renderChartGrid() {
        if (!chartGrid) return;
        
        console.log('Renderizando grid com', state.charts.length, 'gráficos');
        
        if (state.charts.length === 0) {
            chartGrid.innerHTML = '<div class="text-sm opacity-70">Nenhum gráfico cadastrado até o momento. Clique em "Novo gráfico" para começar.</div>';
            return;
        }
        
        chartGrid.innerHTML = state.charts.map((chart, index) => {
            const chartConfig = chart.config || chart.chart || chart;
            const chartName = chartConfig.nome || chartConfig.name || 'Gráfico sem nome';
            const chartType = chartConfig.chart_type || chartConfig.type || 'bar';
            const chartId = chart.id || 'sem-id';
            
            return `
                <div class="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 mb-6" data-chart-id="${chartId}">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold">${chartName}</h3>
                        <div class="flex gap-2">
                            <button class="px-3 py-1 rounded-lg border border-white/15 hover:border-white/40 transition text-xs" onclick="editChart(${index})">Editar</button>
                            <button class="px-3 py-1 rounded-lg border border-red-500/30 hover:border-red-500/60 text-red-400 transition text-xs" onclick="deleteChart(${index})">Excluir</button>
                        </div>
                    </div>
                    <div id="chart-${index}" class="w-full" style="position: relative; height: 400px;">
                        ${chartType === 'table' ? '<div class="text-sm opacity-60">Tabela</div>' : '<canvas style="width: 100%; height: 100%;"></canvas>'}
                    </div>
                </div>
            `;
        }).join('');
        
        // Renderizar cada gráfico
        state.charts.forEach((chart, index) => {
            const chartConfig = chart.config || chart.chart || chart;
            const chartType = chartConfig.chart_type || chartConfig.type || 'bar';
            if (chartType !== 'table') {
                renderChart(chart, index);
            }
        });
    }

    function renderChart(chart, index) {
        const container = document.querySelector(`#chart-${index} canvas`);
        if (!container) {
            console.error('Canvas não encontrado para gráfico', index);
            return;
        }
        
        console.log('Renderizando gráfico', index, chart);
        
        const ctx = container.getContext('2d');
        const chartData = prepareChartData(chart);
        
        if (state.chartInstances.has(index)) {
            state.chartInstances.get(index).destroy();
        }
        
        try {
            const instance = new ChartJs(ctx, chartData);
            state.chartInstances.set(index, instance);
            console.log('Gráfico', index, 'renderizado com sucesso');
        } catch (error) {
            console.error('Erro ao renderizar gráfico', index, error);
        }
    }

    function prepareChartData(chart) {
        console.log('Preparando dados do gráfico:', chart);
        
        // Extrair dados do chart (pode vir em formatos diferentes)
        const chartData = chart.data || {};
        const chartConfig = chart.config || chart.chart || chart;
        const chartType = chartConfig.chart_type || chartConfig.type || 'bar';
        
        // Determinar tipo correto do Chart.js
        let finalType = chartType;
        if (chartType === 'bar-horizontal') {
            finalType = 'bar';
        } else if (chartType === 'donut') {
            finalType = 'doughnut';
        } else if (chartType === 'area') {
            finalType = 'line';
        }
        
        // Preparar datasets
        const labels = chartData.labels || [];
        const series = chartData.series || [];
        
        // Detectar se há valores monetários
        const hasCurrencyValues = series.some(s => s.value_kind === 'currency');
        const hasPercentageValues = series.some(s => s.value_kind === 'percentage');
        
        const datasets = series.map(s => {
            const dataset = {
                label: s.label,
                data: s.values || [],
                backgroundColor: s.color || COLOR_PALETTE[0],
                borderColor: s.color || COLOR_PALETTE[0],
                borderWidth: 2,
                valueKind: s.value_kind || 'number' // Armazenar tipo do valor
            };
            
            if (chartType === 'area') {
                dataset.fill = true;
                dataset.tension = 0.4;
            } else if (chartType === 'line') {
                dataset.fill = false;
                dataset.tension = 0.4;
            }
            
            return dataset;
        });
        
        return {
            type: finalType,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: chartType === 'bar-horizontal' ? 'y' : 'x',
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { color: 'rgba(255,255,255,0.9)' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                
                                const value = context.parsed.y !== undefined ? context.parsed.y : context.parsed;
                                const valueKind = context.dataset.valueKind || 'number';
                                
                                if (valueKind === 'currency') {
                                    label += formatCurrency(value);
                                } else if (valueKind === 'percentage') {
                                    label += formatPercentage(value);
                                } else {
                                    label += value !== null ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';
                                }
                                
                                return label;
                            }
                        }
                    },
                    datalabels: { 
                        display: chartConfig.options?.dataLabels !== false,
                        color: '#fff',
                        font: { weight: 'bold', size: 10 },
                        formatter: (value, context) => {
                            if (value === null || value === undefined) return '';
                            
                            const valueKind = context.dataset.valueKind || 'number';
                            
                            if (valueKind === 'currency') {
                                // Formato compacto para moeda
                                if (Math.abs(value) >= 1000000) {
                                    return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                                } else if (Math.abs(value) >= 1000) {
                                    return 'R$ ' + (value / 1000).toFixed(1) + 'K';
                                }
                                return 'R$ ' + value.toFixed(0);
                            } else if (valueKind === 'percentage') {
                                return value.toFixed(1) + '%';
                            } else {
                                return Math.round(value).toLocaleString('pt-BR');
                            }
                        }
                    }
                },
                scales: finalType === 'pie' || finalType === 'doughnut' ? undefined : {
                    x: { 
                        stacked: chartConfig.options?.stacked || false,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: 'rgba(255,255,255,0.7)' }
                    },
                    y: { 
                        stacked: chartConfig.options?.stacked || false,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { 
                            color: 'rgba(255,255,255,0.7)',
                            callback: function(value) {
                                // Formatar eixo Y se houver valores monetários
                                if (hasCurrencyValues) {
                                    if (Math.abs(value) >= 1000000) {
                                        return 'R$ ' + (value / 1000000).toFixed(1) + 'M';
                                    } else if (Math.abs(value) >= 1000) {
                                        return 'R$ ' + (value / 1000).toFixed(0) + 'K';
                                    }
                                    return 'R$ ' + value.toFixed(0);
                                } else if (hasPercentageValues) {
                                    return value.toFixed(0) + '%';
                                }
                                return value.toLocaleString('pt-BR');
                            }
                        },
                        beginAtZero: true
                    }
                },
                // Controlar espessura das barras
                barPercentage: chartType === 'bar-horizontal' ? 0.5 : 0.5,
                categoryPercentage: chartType === 'bar-horizontal' ? 0.6 : 0.7
            }
        };
    }

    function populateChartTypeChoices() {
        if (!chartTypeChoices) return;
        
        chartTypeChoices.innerHTML = CHART_TYPES.map(type => `
            <button 
                class="p-4 rounded-xl border border-white/10 hover:border-white/30 hover:bg-white/5 transition text-left"
                data-chart-type="${type.type}"
            >
                <div class="font-semibold mb-1">${type.label}</div>
                <div class="text-xs opacity-60">${type.description}</div>
            </button>
        `).join('');
    }

    function createEmptyModalState() {
        return {
            mode: 'create',
            step: 1,
            editIndex: null,
            config: {
                type: null,
                name: '',
                category: null,
                indicators: [],
                metrics: [],
                dimensions: [],
                values: [],
                rows: [],
                options: {
                    stacked: false,
                    dataLabels: true
                }
            }
        };
    }

    function normalizeCharts(charts) {
        return charts.map(chartItem => {
            // Backend retorna: { chart: {...}, data: {...} }
            // Onde chart contém: { id, nome, chart_type, indicadores, metricas, options }
            
            let id = null;
            let config = null;
            let data = null;
            
            if (chartItem.chart) {
                // Estrutura do backend: { chart: {...}, data: {...} }
                id = chartItem.chart.id;
                config = chartItem.chart;
                data = chartItem.data;
            } else if (chartItem.id) {
                // Estrutura direta: { id, nome, chart_type, ... }
                id = chartItem.id;
                config = chartItem;
            } else {
                // Fallback
                config = chartItem;
            }
            
            return {
                id: id,
                config: config,
                chart: chartItem.chart || config,
                data: data
            };
        });
    }

    function openModal(mode, editIndex = null) {
        if (!chartModal) return;
        
        state.modal = createEmptyModalState();
        state.modal.mode = mode;
        state.modal.editIndex = editIndex;
        
        if (mode === 'edit' && editIndex !== null) {
            const chart = state.charts[editIndex];
            const chartConfig = chart.config || chart.chart || chart;
            
            console.log('Editando gráfico:', chart);
            
            // Copiar toda a configuração
            state.modal.config = {
                type: chartConfig.chart_type || chartConfig.type,
                name: chartConfig.nome || chartConfig.name || '',
                category: chartConfig.categoria || chartConfig.category || null,
                indicators: [...(chartConfig.indicadores || [])],
                metrics: chartConfig.metricas ? JSON.parse(JSON.stringify(chartConfig.metricas)) : [],
                dimensions: [...(chartConfig.dimensoes || chartConfig.dimensions || [])],
                values: chartConfig.metricas && state.workflowType === 'analise_jp' ? JSON.parse(JSON.stringify(chartConfig.metricas)) : [],
                rows: [...((chartConfig.options?.row_indices) || [])],
                options: {
                    stacked: chartConfig.options?.stacked || false,
                    dataLabels: chartConfig.options?.dataLabels !== false
                }
            };
            
            console.log('Config carregada para edição:', state.modal.config);
        }
        
        // Preencher input do nome
        if (chartNameInput) {
            chartNameInput.value = state.modal.config.name || '';
        }
        
        goToStep(1);
        chartModal.classList.remove('hidden');
    }

    function closeModal() {
        if (!chartModal) return;
        chartModal.classList.add('hidden');
        state.modal = createEmptyModalState();
    }

    function goToStep(step) {
        state.modal.step = step;
        
        stepIndicators.forEach((indicator, index) => {
            if (index + 1 === step) {
                indicator.classList.add('bg-blue-500/20', 'border-blue-500');
                indicator.classList.remove('opacity-60');
            } else if (index + 1 < step) {
                indicator.classList.add('bg-green-500/20', 'border-green-500');
                indicator.classList.remove('opacity-60');
            } else {
                indicator.classList.remove('bg-blue-500/20', 'border-blue-500', 'bg-green-500/20', 'border-green-500');
                indicator.classList.add('opacity-60');
            }
        });
        
        stepContainers.forEach((container, index) => {
            container.classList.toggle('hidden', index + 1 !== step);
        });
        
        if (prevButton) prevButton.classList.toggle('invisible', step === 1);
        if (nextButton) nextButton.classList.toggle('hidden', step === 3);
        if (saveButton) saveButton.classList.toggle('hidden', step !== 3);
        
        updateStepTitle();
        
        // Se for passo 1 e estiver editando, marcar o tipo selecionado
        if (step === 1 && state.modal.mode === 'edit' && state.modal.config.type) {
            setTimeout(() => {
                const button = chartTypeChoices?.querySelector(`[data-chart-type="${state.modal.config.type}"]`);
                if (button) {
                    button.classList.add('ring-2', 'ring-blue-500', 'bg-blue-500/10');
                }
            }, 50);
        }
    }

    function updateStepTitle() {
        if (!chartModalTitle) return;
        
        const titles = {
            1: 'Selecionar tipo',
            2: 'Configurar dados',
            3: 'Pré-visualização e opções'
        };
        
        chartModalTitle.textContent = titles[state.modal.step] || 'Configuração';
    }

    function handleNextStep() {
        // Validar antes de avançar
        if (state.modal.step === 1) {
            if (!state.modal.config.type) {
                alert('Selecione um tipo de gráfico');
                return;
            }
        } else if (state.modal.step === 2) {
            // Pegar o nome do input antes de avançar
            if (chartNameInput) {
                state.modal.config.name = chartNameInput.value.trim();
            }
            
            if (!state.modal.config.name) {
                alert('Informe um nome para o gráfico');
                chartNameInput?.focus();
                return;
            }
            
            // Validar dados selecionados
            if (state.workflowType === 'balancete') {
                if (!state.modal.config.indicators || state.modal.config.indicators.length === 0) {
                    alert('Selecione pelo menos um indicador');
                    return;
                }
                if (!state.modal.config.metrics || state.modal.config.metrics.length === 0) {
                    alert('Selecione pelo menos uma métrica');
                    return;
                }
            } else if (state.workflowType === 'analise_jp') {
                if (!state.modal.config.dimensions || state.modal.config.dimensions.length === 0) {
                    alert('Selecione pelo menos uma dimensão');
                    return;
                }
                if (!state.modal.config.values || state.modal.config.values.length === 0) {
                    alert('Selecione pelo menos um valor');
                    return;
                }
            }
        }
        
        if (state.modal.step < 3) {
            goToStep(state.modal.step + 1);
            
            if (state.modal.step === 2) {
                renderDataConfigStep();
            } else if (state.modal.step === 3) {
                renderPreview();
            }
        }
    }

    function handlePrevStep() {
        if (state.modal.step > 1) {
            goToStep(state.modal.step - 1);
        }
    }

    function handleChartTypeChoice(event) {
        const button = event.target.closest('[data-chart-type]');
        if (!button) return;
        
        // Remover seleção anterior
        chartTypeChoices?.querySelectorAll('button').forEach(btn => {
            btn.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-500/10');
        });
        
        // Adicionar seleção visual
        button.classList.add('ring-2', 'ring-blue-500', 'bg-blue-500/10');
        
        // Salvar tipo selecionado
        state.modal.config.type = button.dataset.chartType;
        
        console.log('Tipo de gráfico selecionado:', state.modal.config.type);
        // NÃO avança automaticamente - usuário deve clicar em "Avançar"
    }

    function renderDataConfigStep() {
        if (state.workflowType === 'balancete') {
            balanceteConfig?.classList.remove('hidden');
            analiseConfig?.classList.add('hidden');
            renderBalanceteOptions();
            
            // Se estiver editando, marcar checkboxes
            if (state.modal.mode === 'edit') {
                setTimeout(() => {
                    // Marcar indicadores
                    state.modal.config.indicators.forEach(indicator => {
                        const checkbox = indicatorOptionsContainer?.querySelector(`input[value="${indicator}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                    
                    // Marcar métricas e preencher valores
                    state.modal.config.metrics.forEach(metric => {
                        const container = metricOptionsContainer?.querySelector(`input[value="${metric.key}"]`)?.closest('div');
                        if (container) {
                            const checkbox = container.querySelector('input[type="checkbox"]');
                            const labelInput = container.querySelector('input[type="text"]');
                            const colorInput = container.querySelector('input[type="color"]');
                            
                            if (checkbox) checkbox.checked = true;
                            if (labelInput) labelInput.value = metric.label;
                            if (colorInput && metric.color) colorInput.value = metric.color;
                        }
                    });
                }, 100);
            }
        } else if (state.workflowType === 'analise_jp') {
            balanceteConfig?.classList.add('hidden');
            analiseConfig?.classList.remove('hidden');
            renderAnaliseOptions();
            
            // Se estiver editando, selecionar categoria e marcar checkboxes
            if (state.modal.mode === 'edit' && state.modal.config.category) {
                setTimeout(() => {
                    if (chartCategorySelect) {
                        chartCategorySelect.value = state.modal.config.category;
                        handleCategoryChange({ target: { value: state.modal.config.category } });
                    }
                    
                    // Marcar dimensões
                    state.modal.config.dimensions.forEach(dimension => {
                        const checkbox = dimensionOptionsContainer?.querySelector(`input[value="${dimension}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                    
                    // Marcar valores e preencher
                    state.modal.config.values.forEach(value => {
                        const container = valueOptionsContainer?.querySelector(`input[value="${value.key}"]`)?.closest('div');
                        if (container) {
                            const checkbox = container.querySelector('input[type="checkbox"]');
                            const labelInput = container.querySelector('input[type="text"]');
                            const colorInput = container.querySelector('input[type="color"]');
                            
                            if (checkbox) checkbox.checked = true;
                            if (labelInput) labelInput.value = value.label;
                            if (colorInput && value.color) colorInput.value = value.color;
                        }
                    });
                    
                    // Marcar linhas
                    state.modal.config.rows.forEach(rowIndex => {
                        const checkbox = rowOptionsContainer?.querySelector(`input[value="${rowIndex}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                }, 100);
            }
        }
    }

    function renderBalanceteOptions() {
        if (!state.dataset || !state.dataset.indicator_options) return;
        
        // Renderizar indicadores
        if (indicatorOptionsContainer) {
            indicatorOptionsContainer.innerHTML = state.dataset.indicator_options.map(ind => `
                <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" value="${ind.value}" class="rounded">
                    <span>${ind.label}</span>
                </label>
            `).join('');
        }
        
        // Renderizar métricas
        if (metricOptionsContainer) {
            const metrics = state.dataset.value_options || [];
            
            metricOptionsContainer.innerHTML = metrics.map((metric, index) => `
                <div class="flex items-center gap-3 p-3 rounded-lg border border-white/10">
                    <input type="checkbox" value="${metric.key}" class="rounded">
                    <input type="text" value="${metric.label}" placeholder="Rótulo" class="flex-1 bg-transparent border-none focus:outline-none text-sm">
                    <input type="color" value="${COLOR_PALETTE[index % COLOR_PALETTE.length]}" class="w-8 h-8 rounded cursor-pointer">
                </div>
            `).join('');
        }
    }

    function renderAnaliseOptions() {
        if (!chartCategorySelect) return;
        
        chartCategorySelect.innerHTML = state.categories.map(cat => 
            `<option value="${cat.slug}">${cat.nome}</option>`
        ).join('');
        
        if (state.categories.length > 0) {
            handleCategoryChange({ target: { value: state.categories[0].slug } });
        }
    }

    function handleCategoryChange(event) {
        const categorySlug = event.target.value;
        state.modal.config.category = categorySlug;
        
        const dataset = state.categoryDatasets.get(categorySlug);
        if (!dataset) return;
        
        // Renderizar dimensões (colunas não numéricas)
        if (dimensionOptionsContainer) {
            const dimensionFields = dataset.fields.filter(f => !dataset.numeric_fields.includes(f));
            dimensionOptionsContainer.innerHTML = dimensionFields.map(field => `
                <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" value="${field}" class="rounded">
                    <span>${field}</span>
                </label>
            `).join('');
        }
        
        // Renderizar valores (colunas numéricas)
        if (valueOptionsContainer) {
            valueOptionsContainer.innerHTML = dataset.numeric_fields.map((field, index) => `
                <div class="flex items-center gap-3 p-3 rounded-lg border border-white/10">
                    <input type="checkbox" value="${field}" class="rounded">
                    <input type="text" value="${field}" placeholder="Rótulo" class="flex-1 bg-transparent border-none focus:outline-none text-sm" data-field="${field}">
                    <input type="color" value="${COLOR_PALETTE[index % COLOR_PALETTE.length]}" class="w-8 h-8 rounded cursor-pointer" data-field="${field}">
                </div>
            `).join('');
        }
        
        // Renderizar linhas disponíveis
        if (rowOptionsContainer) {
            rowOptionsContainer.innerHTML = dataset.records.slice(0, 20).map((record, index) => {
                const label = Object.values(record).slice(0, 2).join(' - ');
                return `
                    <label class="inline-flex items-center gap-2 px-2 py-1 rounded border border-white/20 hover:bg-white/5 cursor-pointer">
                        <input type="checkbox" value="${index}" class="rounded">
                        <span>${label || `Linha ${index + 1}`}</span>
                    </label>
                `;
            }).join('');
            if (dataset.records.length > 20) {
                rowOptionsContainer.innerHTML += `<p class="text-xs opacity-60 mt-2">Mostrando 20 de ${dataset.records.length} linhas</p>`;
            }
        }
    }

    function handleIndicatorToggle(event) {
        const checkbox = event.target.closest('input[type="checkbox"]');
        if (!checkbox) return;
        
        const value = checkbox.value;
        if (checkbox.checked) {
            if (!state.modal.config.indicators.includes(value)) {
                state.modal.config.indicators.push(value);
            }
        } else {
            state.modal.config.indicators = state.modal.config.indicators.filter(v => v !== value);
        }
    }

    function handleMetricToggle(event) {
        const checkbox = event.target.closest('input[type="checkbox"]');
        if (!checkbox) return;
        
        const container = checkbox.closest('div');
        const key = checkbox.value;
        const labelInput = container.querySelector('input[type="text"]');
        const colorInput = container.querySelector('input[type="color"]');
        
        if (checkbox.checked) {
            const existing = state.modal.config.metrics.find(m => m.key === key);
            if (!existing) {
                state.modal.config.metrics.push({
                    key: key,
                    label: labelInput?.value || key,
                    color: colorInput?.value || COLOR_PALETTE[0]
                });
            }
        } else {
            state.modal.config.metrics = state.modal.config.metrics.filter(m => m.key !== key);
        }
    }

    function handleMetricInput(event) {
        const input = event.target;
        const container = input.closest('div');
        const checkbox = container?.querySelector('input[type="checkbox"]');
        
        if (!checkbox || !checkbox.checked) return;
        
        const key = checkbox.value;
        const metric = state.modal.config.metrics.find(m => m.key === key);
        
        if (metric) {
            if (input.type === 'text') {
                metric.label = input.value;
            } else if (input.type === 'color') {
                metric.color = input.value;
            }
        }
    }

    function handleDimensionToggle(event) {
        const checkbox = event.target.closest('input[type="checkbox"]');
        if (!checkbox) return;
        
        const value = checkbox.value;
        if (checkbox.checked) {
            if (!state.modal.config.dimensions.includes(value)) {
                state.modal.config.dimensions.push(value);
            }
        } else {
            state.modal.config.dimensions = state.modal.config.dimensions.filter(v => v !== value);
        }
    }

    function handleValueMetricToggle(event) {
        const checkbox = event.target.closest('input[type="checkbox"]');
        if (!checkbox) return;
        
        const container = checkbox.closest('div');
        const key = checkbox.value;
        const labelInput = container.querySelector('input[type="text"]');
        const colorInput = container.querySelector('input[type="color"]');
        
        if (checkbox.checked) {
            const existing = state.modal.config.values.find(v => v.key === key);
            if (!existing) {
                state.modal.config.values.push({
                    key: key,
                    label: labelInput?.value || key,
                    color: colorInput?.value || COLOR_PALETTE[0]
                });
            }
        } else {
            state.modal.config.values = state.modal.config.values.filter(v => v.key !== key);
        }
    }

    function handleValueMetricInput(event) {
        const input = event.target;
        const container = input.closest('div');
        const checkbox = container?.querySelector('input[type="checkbox"]');
        
        if (!checkbox || !checkbox.checked) return;
        
        const key = checkbox.value;
        const value = state.modal.config.values.find(v => v.key === key);
        
        if (value) {
            if (input.type === 'text') {
                value.label = input.value;
            } else if (input.type === 'color') {
                value.color = input.value;
            }
        }
    }

    function handleRowToggle(event) {
        const checkbox = event.target.closest('input[type="checkbox"]');
        if (!checkbox) return;
        
        const rowIndex = parseInt(checkbox.value);
        if (checkbox.checked) {
            if (!state.modal.config.rows.includes(rowIndex)) {
                state.modal.config.rows.push(rowIndex);
            }
        } else {
            state.modal.config.rows = state.modal.config.rows.filter(r => r !== rowIndex);
        }
    }

    function renderPreview() {
        console.log('renderPreview chamado');
        console.log('chartPreviewCanvas:', chartPreviewCanvas);
        console.log('ChartJs disponível:', typeof ChartJs);
        console.log('state.modal.config:', state.modal.config);
        
        if (!chartPreviewCanvas) {
            console.error('Canvas não encontrado!');
            return;
        }
        
        // Destruir preview anterior
        if (state.previewInstance) {
            state.previewInstance.destroy();
            state.previewInstance = null;
        }
        
        // Validar configuração
        const config = state.modal.config;
        if (!config.type || !config.name) {
            console.log('Configuração incompleta:', config);
            if (modalFeedback) {
                modalFeedback.textContent = 'Configure o nome e tipo do gráfico';
                modalFeedback.classList.remove('hidden');
            }
            return;
        }
        
        // Preparar dados de preview
        let labels = [];
        let datasets = [];
        
        if (state.workflowType === 'balancete') {
            console.log('Tipo balancete - indicators:', config.indicators, 'metrics:', config.metrics);
            if (!config.indicators || config.indicators.length === 0) {
                console.log('Nenhum indicador selecionado');
                if (modalFeedback) {
                    modalFeedback.textContent = 'Selecione pelo menos um indicador';
                    modalFeedback.classList.remove('hidden');
                }
                return;
            }
            if (!config.metrics || config.metrics.length === 0) {
                console.log('Nenhuma métrica selecionada');
                if (modalFeedback) {
                    modalFeedback.textContent = 'Selecione pelo menos uma métrica';
                    modalFeedback.classList.remove('hidden');
                }
                return;
            }
            
            labels = config.indicators;
            
            // Para pizza/donut, usar cores diferentes para cada fatia
            if (config.type === 'pie' || config.type === 'donut') {
                const colors = config.indicators.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length]);
                datasets = [{
                    label: config.metrics[0]?.label || 'Valores',
                    data: config.indicators.map(() => Math.random() * 1000),
                    backgroundColor: colors,
                    borderColor: colors.map(c => c),
                    borderWidth: 2
                }];
            } else {
                datasets = config.metrics.map(metric => ({
                    label: metric.label,
                    data: config.indicators.map(() => Math.random() * 1000),
                    backgroundColor: metric.color,
                    borderColor: metric.color,
                    borderWidth: 2
                }));
            }
        } else if (state.workflowType === 'analise_jp') {
            if (!config.dimensions || config.dimensions.length === 0) {
                if (modalFeedback) {
                    modalFeedback.textContent = 'Selecione pelo menos uma dimensão';
                    modalFeedback.classList.remove('hidden');
                }
                return;
            }
            if (!config.values || config.values.length === 0) {
                if (modalFeedback) {
                    modalFeedback.textContent = 'Selecione pelo menos um valor';
                    modalFeedback.classList.remove('hidden');
                }
                return;
            }
            
            labels = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'];
            
            // Para pizza/donut, usar cores diferentes para cada fatia
            if (config.type === 'pie' || config.type === 'donut') {
                const colors = labels.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length]);
                datasets = [{
                    label: config.values[0]?.label || 'Valores',
                    data: labels.map(() => Math.random() * 1000),
                    backgroundColor: colors,
                    borderColor: colors.map(c => c),
                    borderWidth: 2
                }];
            } else {
                datasets = config.values.map(value => ({
                    label: value.label,
                    data: labels.map(() => Math.random() * 1000),
                    backgroundColor: value.color,
                    borderColor: value.color,
                    borderWidth: 2
                }));
            }
        }
        
        // Criar preview
        console.log('Criando preview com labels:', labels, 'datasets:', datasets);
        const ctx = chartPreviewCanvas.getContext('2d');
        
        // Determinar tipo correto do Chart.js
        let chartType = config.type;
        if (config.type === 'bar-horizontal') {
            chartType = 'bar';
        } else if (config.type === 'donut') {
            chartType = 'doughnut';
        } else if (config.type === 'area') {
            chartType = 'line';
        }
        
        // Configurar datasets baseado no tipo
        const processedDatasets = datasets.map(dataset => {
            const processed = { ...dataset };
            
            if (config.type === 'area') {
                processed.fill = true;
                processed.tension = 0.4;
            } else if (config.type === 'line') {
                processed.fill = false;
                processed.tension = 0.4;
            } else if (config.type === 'bar' || config.type === 'bar-horizontal') {
                processed.borderWidth = 1;
            }
            
            return processed;
        });
        
        const chartConfig = {
            type: chartType,
            data: { labels, datasets: processedDatasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: config.type === 'bar-horizontal' ? 'y' : 'x',
                plugins: {
                    legend: { 
                        display: true, 
                        position: 'top',
                        labels: { color: 'rgba(255,255,255,0.9)' }
                    },
                    datalabels: { 
                        display: config.options.dataLabels,
                        color: '#fff',
                        font: { weight: 'bold', size: 10 },
                        formatter: (value) => {
                            if (value === null || value === undefined) return '';
                            return Math.round(value).toLocaleString('pt-BR');
                        }
                    }
                },
                scales: chartType === 'pie' || chartType === 'doughnut' ? undefined : {
                    x: { 
                        stacked: config.options.stacked,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: 'rgba(255,255,255,0.7)' }
                    },
                    y: { 
                        stacked: config.options.stacked,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: 'rgba(255,255,255,0.7)' },
                        beginAtZero: true
                    }
                },
                // Controlar espessura das barras
                barPercentage: config.type === 'bar-horizontal' ? 0.5 : 0.5,
                categoryPercentage: config.type === 'bar-horizontal' ? 0.6 : 0.7
            }
        };
        
        console.log('Configuração do gráfico:', chartConfig);
        try {
            state.previewInstance = new ChartJs(ctx, chartConfig);
            console.log('Gráfico criado com sucesso!');
        } catch (error) {
            console.error('Erro ao criar gráfico:', error);
            if (modalFeedback) {
                modalFeedback.textContent = 'Erro ao criar preview: ' + error.message;
                modalFeedback.classList.remove('hidden');
            }
            return;
        }
        
        if (modalFeedback) {
            modalFeedback.textContent = '';
            modalFeedback.classList.add('hidden');
        }
    }

    async function saveChart() {
        console.log('saveChart chamado');
        console.log('Config atual:', state.modal.config);
        
        try {
            // Validar configuração antes de salvar
            if (!state.modal.config.name) {
                if (modalFeedback) {
                    modalFeedback.textContent = 'Informe um nome para o gráfico';
                    modalFeedback.classList.remove('hidden');
                }
                return;
            }
            
            if (!state.modal.config.type) {
                if (modalFeedback) {
                    modalFeedback.textContent = 'Selecione um tipo de gráfico';
                    modalFeedback.classList.remove('hidden');
                }
                return;
            }
            
            // Preparar payload conforme esperado pelo backend
            const payload = {
                nome: state.modal.config.name,
                chart_type: state.modal.config.type,
                options: state.modal.config.options || {}
            };
            
            if (state.workflowType === 'balancete') {
                if (!state.modal.config.indicators || state.modal.config.indicators.length === 0) {
                    if (modalFeedback) {
                        modalFeedback.textContent = 'Selecione pelo menos um indicador';
                        modalFeedback.classList.remove('hidden');
                    }
                    return;
                }
                if (!state.modal.config.metrics || state.modal.config.metrics.length === 0) {
                    if (modalFeedback) {
                        modalFeedback.textContent = 'Selecione pelo menos uma métrica';
                        modalFeedback.classList.remove('hidden');
                    }
                    return;
                }
                payload.indicadores = state.modal.config.indicators;
                payload.metricas = state.modal.config.metrics;
            } else if (state.workflowType === 'analise_jp') {
                if (!state.modal.config.category) {
                    if (modalFeedback) {
                        modalFeedback.textContent = 'Selecione uma categoria';
                        modalFeedback.classList.remove('hidden');
                    }
                    return;
                }
                if (!state.modal.config.dimensions || state.modal.config.dimensions.length === 0) {
                    if (modalFeedback) {
                        modalFeedback.textContent = 'Selecione pelo menos uma dimensão';
                        modalFeedback.classList.remove('hidden');
                    }
                    return;
                }
                if (!state.modal.config.values || state.modal.config.values.length === 0) {
                    if (modalFeedback) {
                        modalFeedback.textContent = 'Selecione pelo menos um valor';
                        modalFeedback.classList.remove('hidden');
                    }
                    return;
                }
                payload.categoria = state.modal.config.category;
                payload.dimensoes = state.modal.config.dimensions;
                payload.metricas = state.modal.config.values;
                if (state.modal.config.rows && state.modal.config.rows.length > 0) {
                    payload.options.row_indices = state.modal.config.rows;
                }
            }
            
            console.log('Payload a ser enviado:', payload);
            
            // Determinar endpoint e método
            let endpoint;
            let method;
            
            if (state.modal.mode === 'edit') {
                // Modo edição - precisa do ID na URL
                const chartId = state.charts[state.modal.editIndex]?.id;
                
                if (!chartId) {
                    console.error('ID do gráfico não encontrado para edição');
                    if (modalFeedback) {
                        modalFeedback.textContent = 'Erro: ID do gráfico não encontrado';
                        modalFeedback.classList.remove('hidden');
                    }
                    return;
                }
                
                endpoint = state.workflowType === 'balancete'
                    ? `/api/workflows/${workflow.id}/balancete/charts/${chartId}`
                    : `/api/workflows/${workflow.id}/analise-jp/charts/${chartId}`;
                method = 'PUT';
            } else {
                // Modo criação
                endpoint = state.workflowType === 'balancete'
                    ? `/api/workflows/${workflow.id}/balancete/charts`
                    : `/api/workflows/${workflow.id}/analise-jp/charts`;
                method = 'POST';
            }
            
            console.log('Endpoint:', endpoint);
            console.log('Método:', method);
            
            const response = await apiRequest(endpoint, method, payload);
            
            console.log('Resposta do servidor:', response);
            
            if (response) {
                console.log('Gráfico salvo com sucesso!');
                // Recarregar lista de gráficos
                const chartsEndpoint = state.workflowType === 'balancete'
                    ? `/api/workflows/${workflow.id}/balancete/charts`
                    : `/api/workflows/${workflow.id}/analise-jp/charts`;
                
                const chartsResponse = await apiRequest(chartsEndpoint, 'GET');
                if (chartsResponse && chartsResponse.charts) {
                    state.charts = normalizeCharts(chartsResponse.charts);
                }
                
                renderChartGrid();
                closeModal();
            }
        } catch (error) {
            console.error('Erro ao salvar gráfico:', error);
            if (modalFeedback) {
                modalFeedback.textContent = 'Erro ao salvar gráfico: ' + error.message;
                modalFeedback.classList.remove('hidden');
            }
        }
    }

    window.editChart = function(index) {
        openModal('edit', index);
    };

    function openDeleteModal(index) {
        const chart = state.charts[index];
        const chartConfig = chart.config || chart.chart || chart;
        const chartName = chartConfig.nome || chartConfig.name || 'Gráfico sem nome';
        const chartType = chartConfig.chart_type || chartConfig.type || 'bar';
        
        // Mapear tipo para nome legível
        const typeNames = {
            'bar': 'Barras verticais',
            'bar-horizontal': 'Barras horizontais',
            'line': 'Linha',
            'area': 'Área',
            'pie': 'Pizza',
            'donut': 'Donut',
            'table': 'Tabela'
        };
        
        if (deleteChartName) deleteChartName.textContent = chartName;
        if (deleteChartType) deleteChartType.textContent = `Tipo: ${typeNames[chartType] || chartType}`;
        
        pendingDeleteIndex = index;
        deleteConfirmModal?.classList.remove('hidden');
    }
    
    function closeDeleteModal() {
        deleteConfirmModal?.classList.add('hidden');
        pendingDeleteIndex = null;
    }
    
    async function confirmDelete() {
        if (pendingDeleteIndex === null) return;
        
        const index = pendingDeleteIndex;
        closeDeleteModal();
        
        console.log('deleteChart confirmado para index:', index);
        console.log('Chart completo:', state.charts[index]);
        
        try {
            const chart = state.charts[index];
            
            // O ID pode estar em diferentes lugares dependendo da estrutura
            const chartId = chart.id || chart.chart?.id || (chart.config || chart.chart)?.id;
            
            console.log('Chart ID encontrado:', chartId);
            
            if (!chartId) {
                console.error('ID do gráfico não encontrado. Estrutura do chart:', chart);
                alert('Erro: ID do gráfico não encontrado. Verifique o console.');
                return;
            }
            
            const endpoint = state.workflowType === 'balancete' 
                ? `/api/workflows/${workflow.id}/balancete/charts/${chartId}`
                : `/api/workflows/${workflow.id}/analise-jp/charts/${chartId}`;
            
            console.log('Endpoint de exclusão:', endpoint);
            
            await apiRequest(endpoint, 'DELETE');
            
            console.log('Gráfico excluído com sucesso!');
            
            // Recarregar lista de gráficos
            const chartsEndpoint = state.workflowType === 'balancete'
                ? `/api/workflows/${workflow.id}/balancete/charts`
                : `/api/workflows/${workflow.id}/analise-jp/charts`;
            
            const chartsResponse = await apiRequest(chartsEndpoint, 'GET');
            if (chartsResponse && chartsResponse.charts) {
                state.charts = normalizeCharts(chartsResponse.charts);
            }
            
            renderChartGrid();
        } catch (error) {
            console.error('Erro ao excluir gráfico:', error);
            alert('Erro ao excluir gráfico: ' + error.message);
        }
    }
    
    window.deleteChart = function(index) {
        openDeleteModal(index);
    };
})();
