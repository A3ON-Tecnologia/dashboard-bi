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

    // Plugin para efeito neon nas barras
    const neonGlowPlugin = {
        id: 'neonGlow',
        beforeDatasetsDraw: (chart) => {
            const ctx = chart.ctx;
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                if (dataset.shadowBlur && (chart.config.type === 'bar')) {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta.hidden) {
                        ctx.save();
                        ctx.shadowBlur = dataset.shadowBlur;
                        ctx.shadowColor = dataset.shadowColor || dataset.backgroundColor;
                        meta.data.forEach((bar) => {
                            const { x, y, base, width, height } = bar.getProps(['x', 'y', 'base', 'width', 'height'], true);
                            ctx.fillStyle = dataset.backgroundColor;
                            
                            // Desenhar retângulo com bordas arredondadas
                            const borderRadius = dataset.borderRadius || 0;
                            ctx.beginPath();
                            
                            if (chart.config.options.indexAxis === 'y') {
                                // Barras horizontais
                                const barHeight = height;
                                const barWidth = x - base;
                                const startX = base;
                                const startY = y - barHeight / 2;
                                
                                ctx.roundRect(startX, startY, barWidth, barHeight, borderRadius);
                            } else {
                                // Barras verticais
                                const barWidth = width;
                                const barHeight = base - y;
                                const startX = x - barWidth / 2;
                                const startY = y;
                                
                                ctx.roundRect(startX, startY, barWidth, barHeight, borderRadius);
                            }
                            
                            ctx.fill();
                        });
                        ctx.restore();
                    }
                }
            });
        }
    };

    if (ChartJs && ChartJs.register) {
        ChartJs.register(neonGlowPlugin);
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

    // Estado global para tooltip fixo
    let pinnedTooltip = null;

    // Função para criar tooltip HTML customizado
    function createCustomTooltip(chart, point) {
        // Remover tooltip anterior se existir
        removeCustomTooltip();

        const tooltip = document.createElement('div');
        tooltip.id = 'custom-chart-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: bold;
            pointer-events: auto;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 200px;
        `;

        // Extrair informações do ponto clicado
        const datasetIndex = point.datasetIndex;
        const dataIndex = point.index;
        const dataset = chart.data.datasets[datasetIndex];
        const label = dataset.label || '';
        const value = dataset.data[dataIndex];
        const valueKind = dataset.valueKind || 'number';
        const indicatorLabel = chart.data.labels[dataIndex];
        
        let formattedValue = '';
        if (valueKind === 'currency') {
            formattedValue = formatCurrency(value);
        } else if (valueKind === 'percentage') {
            formattedValue = formatPercentage(value);
        } else {
            formattedValue = value !== null ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';
        }

        tooltip.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 16px;">
                <div>
                    <div style="font-size: 16px; margin-bottom: 4px;">${indicatorLabel}</div>
                    <div style="font-size: 14px;">${label}: ${formattedValue}</div>
                </div>
                <button id="close-tooltip" style="
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
            </div>
        `;

        document.body.appendChild(tooltip);

        // Posicionar tooltip
        const canvasRect = chart.canvas.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Calcular posição (acima e centralizado com a barra)
        const element = chart.getDatasetMeta(datasetIndex).data[dataIndex];
        const x = canvasRect.left + element.x;
        const y = canvasRect.top + element.y;
        
        tooltip.style.left = (x - tooltipRect.width / 2) + 'px';
        tooltip.style.top = (y - tooltipRect.height - 10) + 'px';

        // Adicionar evento de fechar
        document.getElementById('close-tooltip').addEventListener('click', removeCustomTooltip);

        pinnedTooltip = tooltip;
    }

    function removeCustomTooltip() {
        if (pinnedTooltip) {
            pinnedTooltip.remove();
            pinnedTooltip = null;
        }
    }

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
    const chartOptionXOffset = document.getElementById('chartOptionXOffset');
    const chartOptionYMin = document.getElementById('chartOptionYMin');
    const chartOptionYMax = document.getElementById('chartOptionYMax');
    const chartOptionYStep = document.getElementById('chartOptionYStep');
    const yAxisConfigContainer = document.getElementById('yAxisConfigContainer');
    
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
        if (chartOptionXOffset) {
            chartOptionXOffset.addEventListener('change', (event) => {
                state.modal.config.options.xOffset = event.target.checked;
                if (state.modal.step === 3) renderPreview();
            });
        }
        if (chartOptionYMin) {
            chartOptionYMin.addEventListener('input', (event) => {
                const value = event.target.value.trim();
                state.modal.config.options.yMin = value === '' ? null : parseFloat(value);
                if (state.modal.step === 3) renderPreview();
            });
        }
        if (chartOptionYMax) {
            chartOptionYMax.addEventListener('input', (event) => {
                const value = event.target.value.trim();
                state.modal.config.options.yMax = value === '' ? null : parseFloat(value);
                if (state.modal.step === 3) renderPreview();
            });
        }
        if (chartOptionYStep) {
            chartOptionYStep.addEventListener('input', (event) => {
                const value = event.target.value.trim();
                state.modal.config.options.yStep = value === '' ? null : parseFloat(value);
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
        indicatorOptionsContainer?.addEventListener('change', (event) => {
            if (event.target.matches('.indicator-color-picker')) {
                const indicador = event.target.dataset.indicador;
                const cor = event.target.value;
                if (state.modal.config.indicators.includes(indicador)) {
                    if (!state.modal.config.indicatorColors) state.modal.config.indicatorColors = {};
                    state.modal.config.indicatorColors[indicador] = cor;
                }
            }
        });
        metricOptionsContainer?.addEventListener('change', (event) => {
            if (event.target.matches('.metric-color-picker')) {
                const metricKey = event.target.dataset.metric;
                const cor = event.target.value;
                const metric = state.modal.config.metrics.find(m => m.key === metricKey);
                if (metric) {
                    metric.color = cor;
                }
            }
        });
        
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
                            <button class="px-3 py-1 rounded-lg border border-white/15 hover:border-white/40 hover:bg-white/5 transition text-xs" onclick="editChart(${index})">Editar</button>
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
            
            // Adicionar evento de clique para fixar tooltip
            container.onclick = (evt) => {
                const points = instance.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
                if (points.length) {
                    const firstPoint = points[0];
                    createCustomTooltip(instance, firstPoint);
                }
            };
            
            console.log('Gráfico', index, 'renderizado com sucesso');
        } catch (error) {
            console.error('Erro ao renderizar gráfico', index, error);
        }
    }

    function prepareLineAreaChartData(chartData, chartConfig) {
        // Lógica exclusiva para balancete linha/área
        let labels = chartData.labels || [];
        let series = chartData.series || [];
        const chartType = chartConfig.chart_type || chartConfig.type || 'line';
        const periodMetrics = series.filter(s =>
            s.key === 'valor_periodo_1' ||
            s.key === 'valor_periodo_2' ||
            s.label?.toLowerCase().includes('período') ||
            s.label?.toLowerCase().includes('periodo')
        );
        if (periodMetrics.length === series.length && periodMetrics.length > 1) {
            // labels = períodos, datasets = indicadores
            const temporalLabels = periodMetrics.map(s => s.label);
            const numIndicators = labels.length;
            const combinedSeries = [];
            const indicatorColorMap = (chartConfig.indicatorColors) || (chartConfig.options && chartConfig.options.indicator_colors) || {};
            for (let i = 0; i < numIndicators; i++) {
                const indicatorLabel = labels[i];
                const corPersonalizada = indicatorColorMap[indicatorLabel] || COLOR_PALETTE[i % COLOR_PALETTE.length];
                const temporalValues = periodMetrics.map(metric => metric.values[i]);
                combinedSeries.push({
                    label: indicatorLabel,
                    values: temporalValues,
                    // Usar a cor do indicador para a linha
                    color: corPersonalizada,
                    value_kind: periodMetrics[0].value_kind || 'number'
                });
            }
            labels = temporalLabels;
            series = combinedSeries;
        }
        return { labels, series };
    }
    
    function prepareBarChartData(chartData, chartConfig) {
        // Fluxo original para barras
        let labels = chartData.labels || [];
        let series = chartData.series || [];
        const chartType = chartConfig.chart_type || chartConfig.type || 'bar';
        if (chartType === 'bar' && series.length > 1) {
            const periodMetrics = series.filter(s =>
                s.key === 'valor_periodo_1' ||
                s.key === 'valor_periodo_2' ||
                s.label?.toLowerCase().includes('período') ||
                s.label?.toLowerCase().includes('periodo')
            );
            if (periodMetrics.length === series.length && periodMetrics.length > 1) {
                const indicatorLabels = labels;
                const combinedSeries = [];
                periodMetrics.forEach((metric, metricIndex) => {
                    combinedSeries.push({
                        label: metric.label,
                        values: metric.values,
                        color: metric.color || COLOR_PALETTE[metricIndex % COLOR_PALETTE.length],
                        value_kind: metric.value_kind || 'number'
                    });
                });
                labels = indicatorLabels;
                series = combinedSeries;
            }
        }
        // Nunca muda para bar-horizontal
        return { labels, series };
    }
    
    function prepareGenericChartData(chartData) {
        // Mantém a estrutura do backend
        return {
            labels: chartData.labels || [],
            series: chartData.series || []
        };
    }
    
    function prepareChartData(chart) {
        const chartData = chart.data || {};
        const chartConfig = chart.config || chart.chart || chart;
        const chartType = chartConfig.chart_type || chartConfig.type || 'bar';
        const isBalancete = window.__WORKFLOW__?.tipo === 'balancete' || state?.workflowType === 'balancete';

        let labels = [];
        let series = [];

        // Separação absoluta de lógica!
        if (isBalancete && (chartType === 'line' || chartType === 'area')) {
            ({ labels, series } = prepareLineAreaChartData(chartData, chartConfig));
        } else if (chartType === 'bar' || chartType === 'bar-horizontal') {
            ({ labels, series } = prepareBarChartData(chartData, chartConfig));
        } else {
            ({ labels, series } = prepareGenericChartData(chartData));
        }

        const datasets = series.map((s, index) => {
            const color = s.color || COLOR_PALETTE[index % COLOR_PALETTE.length];
            const dataset = {
                label: s.label,
                data: s.values || [],
                backgroundColor: color,
                borderColor: color,
                borderWidth: 2,
                valueKind: s.value_kind || 'number'
            };
            if (chartType === 'area') {
                dataset.fill = true;
                dataset.tension = 0.4;
            } else if (chartType === 'line') {
                dataset.fill = false;
                dataset.tension = 0.4;
            } else if (chartType === 'bar' || chartType === 'bar-horizontal') {
                dataset.borderRadius = 8;
                dataset.borderSkipped = false;
                dataset.borderWidth = 3;
                dataset.shadowBlur = 20;
                dataset.shadowColor = color;
            }
            return dataset;
        });

        let finalType = chartType;
        if (chartType === 'bar-horizontal') {
            finalType = 'bar';
        } else if (chartType === 'donut') {
            finalType = 'doughnut';
        } else if (chartType === 'area') {
            finalType = 'line';
        }

        // Config básica de datalabels branca para barras:
        let pluginsConfig = {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: 'rgba(255,255,255,0.9)',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            tooltip: {
                position: 'average',
                yAlign: 'bottom',
                xAlign: 'center',
                bodyFont: {
                    size: 14,
                    weight: 'bold'
                },
                titleFont: {
                    size: 16,
                    weight: 'bold'
                },
                padding: 12,
            }
        };
        if (chartType === 'bar' || chartType === 'bar-horizontal') {
            pluginsConfig.datalabels = {
                display: true,
                color: '#fff',
                font: { weight: 'bold', size: 14 },
                formatter: (value, context) => {
                    if (value == null) return '';
                    // Formatação monetária com R$
                    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                },
            };
        } else if (isBalancete && (chartType === 'line' || chartType === 'area')) {
            // Configuração de datalabels para linha e área do balancete
            pluginsConfig.datalabels = {
                display: true,
                color: '#fff',
                font: { weight: 'bold', size: 12 },
                align: 'top',
                anchor: 'end',
                formatter: (value, context) => {
                    if (value == null) return '';
                    // Formatação monetária compacta
                    if (Math.abs(value) >= 1000000) {
                        return 'R$ ' + (value / 1000000).toFixed(2) + 'M';
                    } else if (Math.abs(value) >= 1000) {
                        return 'R$ ' + (value / 1000).toFixed(2) + 'K';
                    }
                    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                },
            };
        }

        // Configurar scales com base nas opções do gráfico
        const chartOptions = chart.config?.options || chart.chart?.options || chart.options || {};
        const scalesConfig = {
            x: {
                beginAtZero: true,
                ticks: { color: 'rgba(255,255,255,0.9)' },
                // Aplicar offset para gráficos de linha/área
                offset: (chartType === 'line' || chartType === 'area') && chartOptions.xOffset !== false
            },
            y: {
                beginAtZero: true,
                ticks: { color: 'rgba(255,255,255,0.9)' }
            }
        };

        // Aplicar configurações personalizadas do eixo Y
        if (chartOptions.yMin !== null && chartOptions.yMin !== undefined) {
            scalesConfig.y.min = chartOptions.yMin;
        }
        if (chartOptions.yMax !== null && chartOptions.yMax !== undefined) {
            scalesConfig.y.max = chartOptions.yMax;
        }
        if (chartOptions.yStep !== null && chartOptions.yStep !== undefined) {
            scalesConfig.y.ticks.stepSize = chartOptions.yStep;
        }

        return {
            type: finalType,
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: chartType === 'bar-horizontal' ? 'y' : 'x',
                plugins: pluginsConfig,
                scales: scalesConfig,
            },
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
                    dataLabels: true,
                    xOffset: true,
                    yMin: null,
                    yMax: null,
                    yStep: null
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
                    dataLabels: chartConfig.options?.dataLabels !== false,
                    xOffset: chartConfig.options?.xOffset !== false,
                    yMin: chartConfig.options?.yMin || null,
                    yMax: chartConfig.options?.yMax || null,
                    yStep: chartConfig.options?.yStep || null
                },
                // Importar cores dos indicadores salvas no backend
                indicatorColors: { ...(chartConfig.options?.indicator_colors || {}) }
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
            requestAnimationFrame(() => {
                const button = chartTypeChoices?.querySelector(`[data-chart-type="${state.modal.config.type}"]`);
                if (button) {
                    button.classList.add('ring-2', 'ring-blue-500', 'bg-blue-500/10');
                }
            });
        }
        
        // Se for passo 3, preencher os campos de opções
        if (step === 3) {
            if (chartOptionStacked) chartOptionStacked.checked = state.modal.config.options.stacked || false;
            if (chartOptionDataLabels) chartOptionDataLabels.checked = state.modal.config.options.dataLabels !== false;
            if (chartOptionXOffset) chartOptionXOffset.checked = state.modal.config.options.xOffset !== false;
            if (chartOptionYMin) chartOptionYMin.value = state.modal.config.options.yMin !== null && state.modal.config.options.yMin !== undefined ? state.modal.config.options.yMin : '';
            if (chartOptionYMax) chartOptionYMax.value = state.modal.config.options.yMax !== null && state.modal.config.options.yMax !== undefined ? state.modal.config.options.yMax : '';
            if (chartOptionYStep) chartOptionYStep.value = state.modal.config.options.yStep !== null && state.modal.config.options.yStep !== undefined ? state.modal.config.options.yStep : '';
            
            // Mostrar/ocultar campos de eixo Y baseado no tipo de gráfico
            const chartType = state.modal.config.type;
            const showYAxisConfig = chartType === 'line' || chartType === 'area';
            if (yAxisConfigContainer) {
                yAxisConfigContainer.classList.toggle('hidden', !showYAxisConfig);
            }
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
                requestAnimationFrame(() => {
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
                });
            }
        } else if (state.workflowType === 'analise_jp') {
            balanceteConfig?.classList.add('hidden');
            analiseConfig?.classList.remove('hidden');
            renderAnaliseOptions();
            
            // Se estiver editando, selecionar categoria e marcar checkboxes
            if (state.modal.mode === 'edit' && state.modal.config.category) {
                requestAnimationFrame(() => {
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
                });
            }
        }
    }

    function renderBalanceteOptions() {
        if (!state.dataset || !state.dataset.indicator_options) return;
        
        // Renderizar indicadores COM input de cor apenas para linha/área
        if (indicatorOptionsContainer) {
            const chartType = state.modal.config.type;
            const showIndicatorColors = chartType === 'line' || chartType === 'area';
            
            indicatorOptionsContainer.innerHTML = state.dataset.indicator_options.map(ind => {
                const color = state.modal.config.indicatorColors?.[ind.value] || COLOR_PALETTE[0];
                return `
                    <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 hover:bg-white/5 cursor-pointer">
                        <input type="checkbox" value="${ind.value}" class="rounded">
                        <span>${ind.label}</span>
                        ${showIndicatorColors ? `<input type="color" value="${color}" class="w-8 h-8 rounded cursor-pointer indicator-color-picker" data-indicador="${ind.value}">` : ''}
                    </label>
                `;
            }).join('');
        }
        
        // Renderizar métricas
        if (metricOptionsContainer) {
            const metrics = state.dataset.value_options || [];
            const chartType = state.modal.config.type;
            const showMetricColors = chartType === 'bar' || chartType === 'bar-horizontal';
            
            metricOptionsContainer.innerHTML = metrics.map((metric, index) => {
                const metricColor = state.modal.config.metrics.find(m => m.key === metric.key)?.color || COLOR_PALETTE[index % COLOR_PALETTE.length];
                return `
                    <div class="flex items-center gap-3 p-3 rounded-lg border border-white/10">
                        <input type="checkbox" value="${metric.key}" class="rounded">
                        <input type="text" value="${metric.label}" placeholder="Rótulo" class="flex-1 bg-transparent border-none focus:outline-none text-sm">
                        ${showMetricColors ? `<input type="color" value="${metricColor}" class="w-8 h-8 rounded cursor-pointer metric-color-picker" data-metric="${metric.key}">` : ''}
                    </div>
                `;
            }).join('');
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
        const container = checkbox.closest('label');
        const colorInput = container.querySelector('input[type="color"]');
        if (checkbox.checked) {
            if (!state.modal.config.indicators.includes(value)) {
                state.modal.config.indicators.push(value);
            }
            if (!state.modal.config.indicatorColors) state.modal.config.indicatorColors = {};
            state.modal.config.indicatorColors[value] = colorInput?.value || COLOR_PALETTE[0];
        } else {
            state.modal.config.indicators = state.modal.config.indicators.filter(v => v !== value);
            if (state.modal.config.indicatorColors) delete state.modal.config.indicatorColors[value];
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
                const metricData = {
                    key: key,
                    label: labelInput?.value || key
                };
                // Adicionar cor apenas se o input de cor existir (gráficos de barras)
                if (colorInput) {
                    metricData.color = colorInput.value;
                }
                state.modal.config.metrics.push(metricData);
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
            
            // Buscar valores reais do dataset
            const getValueForIndicatorAndMetric = (indicator, metricKey) => {
                if (!state.dataset || !state.dataset.records) return 0;
                const record = state.dataset.records.find(r => r.indicador === indicator);
                if (!record) return 0;
                return record[metricKey] || 0;
            };
            
            // Para pizza/donut, usar cores diferentes para cada fatia
            if (config.type === 'pie' || config.type === 'donut') {
                const colors = config.indicators.map((_, i) => COLOR_PALETTE[i % COLOR_PALETTE.length]);
                const metricKey = config.metrics[0]?.key || 'valor_periodo_1';
                datasets = [{
                    label: config.metrics[0]?.label || 'Valores',
                    data: config.indicators.map(ind => getValueForIndicatorAndMetric(ind, metricKey)),
                    backgroundColor: colors,
                    borderColor: colors.map(c => c),
                    borderWidth: 2
                }];
            } else if ((config.type === 'line' || config.type === 'area') && config.metrics.length > 1) {
                // Para linha/área com múltiplos períodos, criar séries temporais
                const temporalLabels = config.metrics.map(m => m.label);
                
                datasets = config.indicators.map((indicator, i) => ({
                    label: indicator,
                    data: config.metrics.map(m => getValueForIndicatorAndMetric(indicator, m.key)),
                    backgroundColor: config.indicatorColors[indicator] || COLOR_PALETTE[i % COLOR_PALETTE.length],
                    borderColor: config.indicatorColors[indicator] || COLOR_PALETTE[i % COLOR_PALETTE.length],
                    borderWidth: 2
                }));
                
                labels = temporalLabels;
            } else if (config.type === 'bar' && config.metrics.length > 1) {
                // Para barras VERTICAIS: períodos na legenda (com cores), indicadores no eixo X
                labels = config.indicators; // Indicadores no eixo X
                datasets = config.metrics.map(metric => ({
                    label: metric.label, // Período na legenda (2024, 2025)
                    data: config.indicators.map(ind => getValueForIndicatorAndMetric(ind, metric.key)),
                    backgroundColor: metric.color, // Usar cor escolhida
                    borderColor: metric.color,
                    borderWidth: 2
                }));
            } else {
                // Para barras HORIZONTAIS e outros: manter estrutura original
                datasets = config.metrics.map(metric => ({
                    label: metric.label,
                    data: config.indicators.map(ind => getValueForIndicatorAndMetric(ind, metric.key)),
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
                processed.borderWidth = 3;
                processed.borderRadius = 8;
                processed.borderSkipped = false;
                // Efeito neon com sombra brilhante
                processed.shadowBlur = 20;
                processed.shadowColor = processed.backgroundColor;
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
                        labels: { 
                            color: 'rgba(255,255,255,0.9)',
                            font: {
                                size: 16,
                                weight: 'bold'
                            }
                        }
                    },
                    tooltip: {
                        position: 'average',
                        yAlign: 'bottom',
                        xAlign: 'center',
                        bodyFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        titleFont: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                const value = config.type === 'bar-horizontal' 
                                    ? context.parsed.x 
                                    : (context.parsed.y !== undefined ? context.parsed.y : context.parsed);
                                
                                // Detectar tipo de valor pela métrica
                                const metricKey = config.metrics?.[context.datasetIndex]?.key;
                                if (metricKey === 'diferenca_percentual') {
                                    label += formatPercentage(value);
                                } else if (metricKey && metricKey !== 'diferenca_percentual') {
                                    label += formatCurrency(value);
                                } else {
                                    label += value !== null ? value.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '';
                                }
                                return label;
                            }
                        }
                    },
                    datalabels: { 
                        display: config.options.dataLabels,
                        color: '#fff',
                        font: { weight: 'bold', size: (config.type === 'line' || config.type === 'area') ? 12 : 14 },
                        align: (config.type === 'line' || config.type === 'area') ? 'top' : 'center',
                        anchor: (config.type === 'line' || config.type === 'area') ? 'end' : 'center',
                        formatter: (value, context) => {
                            if (value === null || value === undefined) return '';
                            
                            // Detectar tipo de valor pela métrica
                            const metricKey = config.metrics?.[context.datasetIndex]?.key;
                            if (metricKey === 'diferenca_percentual') {
                                return value.toFixed(2) + '%';
                            } else if (metricKey && metricKey !== 'diferenca_percentual') {
                                // Formato compacto para moeda (sem arredondamento)
                                if (Math.abs(value) >= 1000000) {
                                    return 'R$ ' + (value / 1000000).toFixed(2) + 'M';
                                } else if (Math.abs(value) >= 1000) {
                                    return 'R$ ' + (value / 1000).toFixed(2) + 'K';
                                }
                                return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                            }
                            return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        }
                    }
                },
                scales: chartType === 'pie' || chartType === 'doughnut' ? undefined : {
                    x: { 
                        stacked: config.options.stacked,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        // Aplicar offset para gráficos de linha/área
                        offset: (config.type === 'line' || config.type === 'area') && config.options.xOffset !== false,
                        ticks: { 
                            color: '#ffffff',
                            font: { size: 14, weight: 'bold' },
                            callback: function(value) {
                                // Para barras horizontais, eixo X tem valores (formatar)
                                if (config.type === 'bar-horizontal') {
                                    // Detectar se é percentual ou moeda
                                    const hasPercentage = config.metrics?.some(m => m.key === 'diferenca_percentual');
                                    const hasCurrency = config.metrics?.some(m => m.key !== 'diferenca_percentual');
                                    
                                    if (hasCurrency) {
                                        if (Math.abs(value) >= 1000000) {
                                            return 'R$ ' + (value / 1000000).toFixed(2) + 'M';
                                        } else if (Math.abs(value) >= 1000) {
                                            return 'R$ ' + (value / 1000).toFixed(2) + 'K';
                                        }
                                        return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                    } else if (hasPercentage) {
                                        return value.toFixed(2) + '%';
                                    }
                                }
                                // Para outros gráficos (barras verticais), eixo X tem labels dos indicadores
                                return this.getLabelForValue(value);
                            }
                        },
                        beginAtZero: config.type === 'bar-horizontal'
                    },
                    y: { 
                        stacked: config.options.stacked,
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        min: config.options.yMin !== null && config.options.yMin !== undefined ? config.options.yMin : undefined,
                        max: config.options.yMax !== null && config.options.yMax !== undefined ? config.options.yMax : undefined,
                        ticks: { 
                            color: '#ffffff',
                            font: { size: 14, weight: 'bold' },
                            stepSize: config.options.yStep !== null && config.options.yStep !== undefined ? config.options.yStep : undefined,
                            callback: function(value, index, ticks) {
                                // Para barras horizontais, retornar o label correspondente
                                if (config.type === 'bar-horizontal') {
                                    return this.getLabelForValue(value);
                                }
                                return value;
                            }
                        },
                        beginAtZero: config.type !== 'bar-horizontal'
                    }
                },
                // Controlar espessura das barras
                barPercentage: config.type === 'bar-horizontal' ? 0.65 : 0.45,
                categoryPercentage: config.type === 'bar-horizontal' ? 0.7 : 0.7
            }
        };
        
        console.log('Configuração do gráfico:', chartConfig);
        try {
            state.previewInstance = new ChartJs(ctx, chartConfig);
            
            // Adicionar evento de clique para fixar tooltip no preview
            chartPreviewCanvas.onclick = (evt) => {
                const points = state.previewInstance.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
                if (points.length) {
                    const firstPoint = points[0];
                    createCustomTooltip(state.previewInstance, firstPoint);
                }
            };
            
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
                payload.indicador_cores = state.modal.config.indicatorColors || {};
                console.log('Métricas sendo salvas:', payload.metricas);
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
