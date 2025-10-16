(() => {
    const { apiRequest } = window.dashboardUtils;
    const form = document.getElementById('createWorkflowForm');
    const feedback = document.getElementById('createWorkflowFeedback');
    const listContainer = document.getElementById('workflowList');

    const state = {
        workflows: Array.isArray(window.__WORKFLOWS__) ? [...window.__WORKFLOWS__] : [],
    };

    function setFeedback(message, success = true) {
        if (!feedback) return;
        feedback.textContent = message;
        feedback.classList.toggle('hidden', !message);
        feedback.classList.toggle('text-emerald-300', success);
        feedback.classList.toggle('text-rose-300', !success);
    }

    function renderList() {
        if (!listContainer) return;
        if (!state.workflows.length) {
            listContainer.innerHTML = '<p class="text-sm opacity-70">Nenhum workflow cadastrado até o momento.</p>';
            return;
        }

        listContainer.innerHTML = state.workflows
            .map(
                (wf) => `
                    <article class="rounded-xl border border-white/10 bg-black/10 backdrop-blur px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p class="text-sm uppercase tracking-wide opacity-60">${wf.tipo.replace('_', ' ')}</p>
                            <h3 class="text-lg font-semibold">${wf.nome}</h3>
                            <p class="text-sm opacity-70">${wf.descricao || 'Sem descrição informada.'}</p>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <a href="/workflows/${wf.id}" class="px-4 py-2 rounded-lg border border-white/15 hover:border-white/40 transition text-sm">Abrir</a>
                            <button class="px-4 py-2 rounded-lg border border-red-400/40 text-red-200 hover:border-red-400 hover:text-red-100 transition text-sm" data-action="delete-workflow" data-workflow-id="${wf.id}">
                                Excluir
                            </button>
                        </div>
                    </article>
                `
            )
            .join('');
    }

    async function handleCreate(event) {
        event.preventDefault();
        if (!form) return;

        setFeedback('');
        const formData = new FormData(form);
        const payload = Object.fromEntries(formData.entries());

        try {
            const response = await apiRequest('/api/workflows', {
                method: 'POST',
                body: payload,
            });
            if (response?.workflow) {
                state.workflows.unshift(response.workflow);
                renderList();
                form.reset();
                setFeedback('Workflow criado com sucesso.', true);
            }
        } catch (error) {
            setFeedback(error.message, false);
        }
    }

    async function handleDelete(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.action !== 'delete-workflow') return;

        const workflowId = Number(target.dataset.workflowId);
        if (!workflowId) return;

        const workflow = state.workflows.find((item) => item.id === workflowId);
        const confirmed = window.confirm(`Deseja realmente remover o workflow "${workflow?.nome || workflowId}"? Esta ação é permanente.`);
        if (!confirmed) return;

        try {
            await apiRequest(`/api/workflows/${workflowId}`, { method: 'DELETE' });
            state.workflows = state.workflows.filter((item) => item.id !== workflowId);
            renderList();
        } catch (error) {
            alert(error.message);
        }
    }

    if (form) form.addEventListener('submit', handleCreate);
    if (listContainer) listContainer.addEventListener('click', handleDelete);

    renderList();
})();
