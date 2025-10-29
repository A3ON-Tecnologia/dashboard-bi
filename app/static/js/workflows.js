(() => {
    const { apiRequest } = window.dashboardUtils;
    const listContainer = document.getElementById('workflowList');
    const openCreateModalBtn = document.getElementById('openCreateModal');
    const createModal = document.getElementById('createModal');
    const createWorkflowNome = document.getElementById('createWorkflowNome');
    const createWorkflowDescricao = document.getElementById('createWorkflowDescricao');
    const createWorkflowTipo = document.getElementById('createWorkflowTipo');
    const createWorkflowFeedback = document.getElementById('createWorkflowFeedback');
    const confirmCreateBtn = document.getElementById('confirmCreate');
    const cancelCreateBtn = document.getElementById('cancelCreate');
    const deleteModal = document.getElementById('deleteModal');
    const deleteWorkflowName = document.getElementById('deleteWorkflowName');
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    const editModal = document.getElementById('editModal');
    const editWorkflowId = document.getElementById('editWorkflowId');
    const editWorkflowNome = document.getElementById('editWorkflowNome');
    const editWorkflowDescricao = document.getElementById('editWorkflowDescricao');
    const editWorkflowTipo = document.getElementById('editWorkflowTipo');
    const editWorkflowFeedback = document.getElementById('editWorkflowFeedback');
    const confirmEditBtn = document.getElementById('confirmEdit');
    const cancelEditBtn = document.getElementById('cancelEdit');

    const state = {
        workflows: Array.isArray(window.__WORKFLOWS__) ? [...window.__WORKFLOWS__] : [],
        pendingDeleteId: null,
    };

    function setCreateFeedback(message, success = true) {
        if (!createWorkflowFeedback) return;
        createWorkflowFeedback.textContent = message;
        createWorkflowFeedback.classList.toggle('hidden', !message);
        createWorkflowFeedback.classList.toggle('text-emerald-300', success);
        createWorkflowFeedback.classList.toggle('text-rose-300', !success);
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
                    <article class="rounded-xl border border-white/10 bg-black/10 backdrop-blur px-5 py-4 flex flex-col gap-4">
                        <div>
                            <p class="text-sm uppercase tracking-wide opacity-60">${wf.tipo.replace('_', ' ')}</p>
                            <h3 class="text-lg font-semibold">${wf.nome}</h3>
                            <p class="text-sm opacity-70">${wf.descricao || 'Sem descrição informada.'}</p>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <a href="/workflows/${wf.id}" class="px-4 py-2 rounded-lg border border-white/15 hover:border-white/40 transition text-sm">Abrir</a>
                            <button class="px-4 py-2 rounded-lg border border-blue-400/40 text-blue-200 hover:border-blue-400 hover:text-blue-100 transition text-sm" data-action="edit-workflow" data-workflow-id="${wf.id}">
                                Editar
                            </button>
                            <button class="px-4 py-2 rounded-lg border border-red-400/40 text-red-200 hover:border-red-400 hover:text-red-100 transition text-sm" data-action="delete-workflow" data-workflow-id="${wf.id}">
                                Excluir
                            </button>
                        </div>
                    </article>
                `
            )
            .join('');
    }

    function showCreateModal() {
        if (!createModal) return;
        createWorkflowNome.value = '';
        createWorkflowDescricao.value = '';
        createWorkflowTipo.value = '';
        setCreateFeedback('');
        createModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            createWorkflowNome.focus();
        });
    }

    function hideCreateModal() {
        if (!createModal) return;
        createModal.classList.add('hidden');
        setCreateFeedback('');
    }

    async function confirmCreate() {
        const nome = createWorkflowNome.value.trim();
        const descricao = createWorkflowDescricao.value.trim();
        const tipo = createWorkflowTipo.value;

        if (!nome || !tipo) {
            setCreateFeedback('Preencha todos os campos obrigatórios.', false);
            return;
        }

        try {
            const response = await apiRequest('/api/workflows', 'POST', {
                nome,
                descricao,
                tipo,
            });
            
            if (response?.workflow) {
                state.workflows.unshift(response.workflow);
                renderList();
                hideCreateModal();
            }
        } catch (error) {
            setCreateFeedback(error.message, false);
        }
    }

    function showDeleteModal(workflowId) {
        const workflow = state.workflows.find((item) => item.id === workflowId);
        if (!workflow || !deleteModal || !deleteWorkflowName) return;

        state.pendingDeleteId = workflowId;
        deleteWorkflowName.textContent = workflow.nome;
        deleteModal.classList.remove('hidden');
    }

    function hideDeleteModal() {
        if (!deleteModal) return;
        deleteModal.classList.add('hidden');
        state.pendingDeleteId = null;
    }

    async function confirmDelete() {
        if (!state.pendingDeleteId) return;

        try {
            await apiRequest(`/api/workflows/${state.pendingDeleteId}`, 'DELETE');
            state.workflows = state.workflows.filter((item) => item.id !== state.pendingDeleteId);
            renderList();
            hideDeleteModal();
        } catch (error) {
            alert(error.message);
            hideDeleteModal();
        }
    }

    function setEditFeedback(message, success = true) {
        if (!editWorkflowFeedback) return;
        editWorkflowFeedback.textContent = message;
        editWorkflowFeedback.classList.toggle('hidden', !message);
        editWorkflowFeedback.classList.toggle('text-emerald-300', success);
        editWorkflowFeedback.classList.toggle('text-rose-300', !success);
    }

    function showEditModal(workflowId) {
        const workflow = state.workflows.find((item) => item.id === workflowId);
        if (!workflow || !editModal) return;

        editWorkflowId.value = workflowId;
        editWorkflowNome.value = workflow.nome;
        editWorkflowDescricao.value = workflow.descricao || '';
        editWorkflowTipo.value = workflow.tipo;
        setEditFeedback('');
        editModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            editWorkflowNome.focus();
        });
    }

    function hideEditModal() {
        if (!editModal) return;
        editModal.classList.add('hidden');
        setEditFeedback('');
    }

    async function confirmEdit() {
        const workflowId = Number(editWorkflowId.value);
        if (!workflowId) return;

        const nome = editWorkflowNome.value.trim();
        const descricao = editWorkflowDescricao.value.trim();
        const tipo = editWorkflowTipo.value;

        if (!nome || !tipo) {
            setEditFeedback('Preencha todos os campos obrigatórios.', false);
            return;
        }

        try {
            const response = await apiRequest(`/api/workflows/${workflowId}`, 'PUT', {
                nome,
                descricao,
                tipo,
            });
            
            if (response?.workflow) {
                const index = state.workflows.findIndex((item) => item.id === workflowId);
                if (index !== -1) {
                    state.workflows[index] = response.workflow;
                }
                renderList();
                hideEditModal();
            }
        } catch (error) {
            setEditFeedback(error.message, false);
        }
    }

    function handleDelete(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.action !== 'delete-workflow') return;

        const workflowId = Number(target.dataset.workflowId);
        if (!workflowId) return;

        showDeleteModal(workflowId);
    }

    function handleEdit(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.action !== 'edit-workflow') return;

        const workflowId = Number(target.dataset.workflowId);
        if (!workflowId) return;

        showEditModal(workflowId);
    }

    if (openCreateModalBtn) openCreateModalBtn.addEventListener('click', showCreateModal);
    if (confirmCreateBtn) confirmCreateBtn.addEventListener('click', confirmCreate);
    if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', hideCreateModal);
    if (listContainer) {
        listContainer.addEventListener('click', handleDelete);
        listContainer.addEventListener('click', handleEdit);
    }
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    if (confirmEditBtn) confirmEditBtn.addEventListener('click', confirmEdit);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', hideEditModal);
    
    // Fechar modais ao clicar no backdrop
    if (createModal) {
        createModal.addEventListener('click', (e) => {
            if (e.target === createModal) hideCreateModal();
        });
    }
    if (deleteModal) {
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) hideDeleteModal();
        });
    }
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) hideEditModal();
        });
    }

    renderList();
})();
