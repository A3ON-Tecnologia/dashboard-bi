(() => {
  const { apiRequest, showToast, navigateWithToast, reloadWithToast } = window.dashboardUtils;
  const empresaId = Number(window.__EMPRESA_ID__);
  const listContainer = document.getElementById('empresaWorkflowList');

  // Create Workflow Elements
  const openCreateBtn = document.getElementById('openCreateWorkflowEmpresa');
  const createModal = document.getElementById('createWorkflowModal');
  const createNome = document.getElementById('createWorkflowNome');
  const createDescricao = document.getElementById('createWorkflowDescricao');
  const createTipo = document.getElementById('createWorkflowTipo');
  const createFeedback = document.getElementById('createWorkflowFeedback');

  // Edit Empresa Elements
  const openEditEmpresaBtn = document.getElementById('openEditEmpresa');
  const openDeleteEmpresaBtn = document.getElementById('openDeleteEmpresa');
  const editModal = document.getElementById('editEmpresaModal');
  const editNome = document.getElementById('editEmpresaNome');
  const editDescricao = document.getElementById('editEmpresaDescricao');
  const editFeedback = document.getElementById('editEmpresaFeedback');
  const deleteModal = document.getElementById('deleteEmpresaModal');

  // Delete Workflow Elements
  const deleteWfModal = document.getElementById('deleteWorkflowModal');
  const deleteWfName = document.getElementById('deleteWorkflowName');

  // Edit Workflow Elements (New)
  const editWfModal = document.getElementById('editWorkflowModal');
  const editWfNome = document.getElementById('editWorkflowNome');
  const editWfDescricao = document.getElementById('editWorkflowDescricao');
  const editWfFeedback = document.getElementById('editWorkflowFeedback');

  const state = {
    workflows: Array.isArray(window.__WORKFLOWS__) ? [...window.__WORKFLOWS__] : [],
    toDeleteWorkflowId: null,
    toEditWorkflowId: null,
  };

  function setFeedback(el, text, ok = true) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('hidden', !text);
    el.classList.toggle('text-emerald-300', ok);
    el.classList.toggle('text-rose-300', !ok);
  }

  function renderList() {
    if (!listContainer) return;
    if (!state.workflows.length) {
      listContainer.innerHTML = '<p class="text-sm opacity-70">Nenhum workflow desta empresa ainda.</p>';
      return;
    }
    listContainer.innerHTML = state.workflows.map((wf) => `
      <article class="rounded-xl border border-white/10 bg-black/10 backdrop-blur px-5 py-4 flex flex-col gap-4">
        <div>
          <p class="text-sm uppercase tracking-wide opacity-60">${wf.tipo.replace('_', ' ')}</p>
          <h3 class="text-lg font-semibold">${wf.nome}</h3>
          <p class="text-sm opacity-70">${wf.descricao || 'Sem descrição informada.'}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <a href="/workflows/${wf.id}" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-emerald-400/40 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100 transition text-sm">Abrir</a>
          <button class="px-4 py-2 rounded-lg border border-blue-400/40 text-blue-200 hover:border-blue-400 hover:text-blue-100 transition text-sm" data-action="edit-workflow" data-workflow-id="${wf.id}">Editar</button>
          <button class="px-4 py-2 rounded-lg border border-red-400/40 text-red-200 hover:border-red-400 hover:text-red-100 transition text-sm" data-action="delete-workflow-modal" data-workflow-id="${wf.id}">Excluir</button>
        </div>
      </article>
    `).join('');
  }

  // --- Create Workflow Logic ---
  function showCreate() {
    if (!createModal) return;
    createNome.value = '';
    createDescricao.value = '';
    createTipo.value = '';
    setFeedback(createFeedback, '');
    createModal.classList.remove('hidden');
    requestAnimationFrame(() => createNome.focus());
  }

  function hideCreate() {
    if (createModal) createModal.classList.add('hidden');
    setFeedback(createFeedback, '');
  }

  async function confirmCreate() {
    const nome = createNome.value.trim();
    const descricao = createDescricao.value.trim();
    const tipo = createTipo.value;
    if (!nome || !tipo) {
      setFeedback(createFeedback, 'Preencha os campos obrigatórios.', false);
      return;
    }
    try {
      const res = await apiRequest('/api/workflows', 'POST', { nome, descricao, tipo, empresa_id: empresaId });
      if (res?.workflow) {
        const wfId = res.workflow.id;
        hideCreate();
        navigateWithToast(`/workflows/${wfId}`, { message: 'Workflow criado com sucesso.', type: 'success', duration: 3000 });
      }
    } catch (e) {
      setFeedback(createFeedback, e.message || 'Erro', false);
    }
  }

  // --- Edit Empresa Logic ---
  function showEditEmpresa() { if (editModal) editModal.classList.remove('hidden'); }
  function hideEditEmpresa() { if (editModal) editModal.classList.add('hidden'); setFeedback(editFeedback, ''); }

  async function confirmEditEmpresa() {
    const nome = editNome.value.trim();
    const descricao = editDescricao.value.trim();
    if (!nome) { setFeedback(editFeedback, 'Informe o nome.', false); return; }
    try {
      await apiRequest(`/api/empresas/${empresaId}`, 'PUT', { nome, descricao });
      hideEditEmpresa();
      reloadWithToast({ message: 'Empresa atualizada com sucesso.', type: 'info', duration: 3000 });
    } catch (e) {
      setFeedback(editFeedback, e.message || 'Erro', false);
      showToast({ message: e.message || 'Falha ao atualizar empresa.', type: 'error', duration: 3000 });
    }
  }

  // --- Delete Empresa Logic ---
  function showDeleteEmpresa() { if (deleteModal) deleteModal.classList.remove('hidden'); }
  function hideDeleteEmpresa() { if (deleteModal) deleteModal.classList.add('hidden'); }

  async function confirmDeleteEmpresa() {
    try {
      await apiRequest(`/api/empresas/${empresaId}`, 'DELETE');
      navigateWithToast('/empresas', { message: 'Empresa excluída com sucesso.', type: 'error', duration: 3000 });
    } catch (e) {
      showToast({ message: e.message || 'Falha ao excluir empresa.', type: 'error', duration: 3000 });
      hideDeleteEmpresa();
    }
  }

  // --- Delete Workflow Logic ---
  function showDeleteWorkflow(wf) {
    if (!deleteWfModal) return;
    state.toDeleteWorkflowId = wf.id;
    if (deleteWfName) deleteWfName.textContent = wf.nome || `#${wf.id}`;
    deleteWfModal.classList.remove('hidden');
  }

  function hideDeleteWorkflow() {
    if (deleteWfModal) deleteWfModal.classList.add('hidden');
    state.toDeleteWorkflowId = null;
  }

  async function confirmDeleteWorkflow() {
    const id = Number(state.toDeleteWorkflowId);
    if (!id) { hideDeleteWorkflow(); return; }
    const idx = state.workflows.findIndex(w => Number(w.id) === id);
    try {
      await apiRequest(`/api/workflows/${id}`, 'DELETE');
      if (idx >= 0) {
        state.workflows.splice(idx, 1);
        renderList();
      }
      showToast({ message: 'Workflow excluído com sucesso.', type: 'success', duration: 3000 });
    } catch (e) {
      showToast({ message: e.message || 'Falha ao excluir workflow.', type: 'error', duration: 3000 });
    } finally {
      hideDeleteWorkflow();
    }
  }

  // --- Edit Workflow Logic (New) ---
  function showEditWorkflow(wf) {
    if (!editWfModal) return;
    state.toEditWorkflowId = wf.id;
    editWfNome.value = wf.nome || '';
    editWfDescricao.value = wf.descricao || '';
    setFeedback(editWfFeedback, '');
    editWfModal.classList.remove('hidden');
  }

  function hideEditWorkflow() {
    if (editWfModal) editWfModal.classList.add('hidden');
    state.toEditWorkflowId = null;
    setFeedback(editWfFeedback, '');
  }

  async function confirmEditWorkflow() {
    const id = Number(state.toEditWorkflowId);
    if (!id) { hideEditWorkflow(); return; }
    const nome = editWfNome.value.trim();
    const descricao = editWfDescricao.value.trim();
    
    if (!nome) {
        setFeedback(editWfFeedback, 'O nome é obrigatório.', false);
        return;
    }

    const idx = state.workflows.findIndex(w => Number(w.id) === id);
    const wf = state.workflows[idx];

    try {
      const payload = { nome, descricao, tipo: wf.tipo, empresa_id: empresaId };
      const res = await apiRequest(`/api/workflows/${id}`, 'PUT', payload);
      if (res?.workflow) {
        state.workflows[idx] = res.workflow;
        renderList();
        showToast({ message: 'Workflow atualizado com sucesso.', type: 'success', duration: 3000 });
        hideEditWorkflow();
      }
    } catch (e) {
      setFeedback(editWfFeedback, e.message || 'Falha ao editar workflow.', false);
    }
  }

  // --- Event Listeners ---

  // Backdrop close
  if (createModal) createModal.addEventListener('click', e => { if (e.target === createModal) hideCreate(); });
  if (editModal) editModal.addEventListener('click', e => { if (e.target === editModal) hideEditEmpresa(); });
  if (deleteModal) deleteModal.addEventListener('click', e => { if (e.target === deleteModal) hideDeleteEmpresa(); });
  if (deleteWfModal) deleteWfModal.addEventListener('click', e => { if (e.target === deleteWfModal) hideDeleteWorkflow(); });
  if (editWfModal) editWfModal.addEventListener('click', e => { if (e.target === editWfModal) hideEditWorkflow(); });

  // Buttons
  if (openCreateBtn) openCreateBtn.addEventListener('click', showCreate);
  const btnCancelCreate = document.querySelector('[data-action="cancel-create-wf"]');
  const btnConfirmCreate = document.querySelector('[data-action="confirm-create-wf"]');
  if (btnCancelCreate) btnCancelCreate.addEventListener('click', hideCreate);
  if (btnConfirmCreate) btnConfirmCreate.addEventListener('click', confirmCreate);

  if (openEditEmpresaBtn) openEditEmpresaBtn.addEventListener('click', (e) => { e.preventDefault(); showEditEmpresa(); });
  if (openDeleteEmpresaBtn) openDeleteEmpresaBtn.addEventListener('click', (e) => { e.preventDefault(); showDeleteEmpresa(); });

  const btnCancelEdit = document.querySelector('[data-action="cancel-edit"]');
  const btnConfirmEdit = document.querySelector('[data-action="confirm-edit"]');
  const btnCancelDelete = document.querySelector('[data-action="cancel-delete"]');
  const btnConfirmDelete = document.querySelector('[data-action="confirm-delete"]');

  if (btnCancelEdit) btnCancelEdit.addEventListener('click', hideEditEmpresa);
  if (btnConfirmEdit) btnConfirmEdit.addEventListener('click', confirmEditEmpresa);
  if (btnCancelDelete) btnCancelDelete.addEventListener('click', hideDeleteEmpresa);
  if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', confirmDeleteEmpresa);

  // Edit Workflow Buttons
  const btnCancelEditWf = document.querySelector('[data-action="cancel-edit-wf"]');
  const btnConfirmEditWf = document.querySelector('[data-action="confirm-edit-wf"]');
  if (btnCancelEditWf) btnCancelEditWf.addEventListener('click', hideEditWorkflow);
  if (btnConfirmEditWf) btnConfirmEditWf.addEventListener('click', confirmEditWorkflow);


  // List Actions
  if (listContainer) {
    listContainer.addEventListener('click', async (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      const action = el.getAttribute('data-action');
      const idAttr = el.getAttribute('data-workflow-id');
      const id = idAttr ? Number(idAttr) : 0;

      if (!action || !id) return;

      const idx = state.workflows.findIndex((w) => Number(w.id) === id);
      if (idx < 0) return;
      const wf = state.workflows[idx];

      if (action === 'delete-workflow-modal') {
        showDeleteWorkflow(wf);
        return;
      }

      if (action === 'edit-workflow') {
        showEditWorkflow(wf);
        return;
      }
    });
  }

  // Expose functions for inline onclick handlers in HTML (legacy support for delete modal)
  window.confirmDeleteWorkflowModal = confirmDeleteWorkflow;
  window.hideDeleteWorkflowModal = hideDeleteWorkflow;

  renderList();
})();