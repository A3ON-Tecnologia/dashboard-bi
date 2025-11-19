(() => {
  const { apiRequest } = window.dashboardUtils;
  const empresa = window.__EMPRESA__ || {};
  const empresaId = Number(window.__EMPRESA_ID__);

  const listContainer = document.getElementById('empresaWorkflowList');
  const openCreateBtn = document.getElementById('openCreateWorkflowEmpresa');
  const createModal = document.getElementById('createWorkflowModal');
  const createNome = document.getElementById('createWorkflowNome');
  const createDescricao = document.getElementById('createWorkflowDescricao');
  const createTipo = document.getElementById('createWorkflowTipo');
  const createFeedback = document.getElementById('createWorkflowFeedback');

  const openEditEmpresaBtn = document.getElementById('openEditEmpresa');
  const openDeleteEmpresaBtn = document.getElementById('openDeleteEmpresa');
  const editModal = document.getElementById('editEmpresaModal');
  const editNome = document.getElementById('editEmpresaNome');
  const editDescricao = document.getElementById('editEmpresaDescricao');
  const editFeedback = document.getElementById('editEmpresaFeedback');
  const deleteModal = document.getElementById('deleteEmpresaModal');

  let state = {
    workflows: Array.isArray(window.__WORKFLOWS__) ? [...window.__WORKFLOWS__] : [],
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
      <article class=\"rounded-xl border border-white/10 bg-black/10 backdrop-blur px-5 py-4 flex flex-col gap-4\">
        <div>
          <p class=\"text-sm uppercase tracking-wide opacity-60\">${wf.tipo.replace('_', ' ')}</p>
          <h3 class=\"text-lg font-semibold\">${wf.nome}</h3>
          <p class=\"text-sm opacity-70\">${wf.descricao || 'Sem descri√ß√£o informada.'}</p>
        </div>
        <div class=\"flex flex-wrap gap-3\">
          <a href=\"/workflows/${wf.id}\" class=\"inline-flex items-center justify-center px-4 py-2 rounded-lg border border-emerald-400/40 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100 transition text-sm\">Abrir</a>`r`n          <button class=\"px-4 py-2 rounded-lg border border-blue-400/40 text-blue-200 hover:border-blue-400 hover:text-blue-100 transition text-sm\" data-action=\"edit-workflow\" data-workflow-id=\"${wf.id}\">Editar</button>`r`n          <button class=\"px-4 py-2 rounded-lg border border-red-400/40 text-red-200 hover:border-red-400 hover:text-red-100 transition text-sm\" data-action=\"delete-workflow\" data-workflow-id=\"${wf.id}\">Excluir</button>`r`n        </div>
      </article>
    `).join('');
  }

  function showCreate() {
    createNome.value = '';
    createDescricao.value = '';
    createTipo.value = '';
    setFeedback(createFeedback, '');
    createModal?.classList.remove('hidden');
    requestAnimationFrame(() => createNome.focus());
  }
  function hideCreate() { createModal?.classList.add('hidden'); setFeedback(createFeedback, ''); }

  async function confirmCreate() {
    const nome = createNome.value.trim();
    const descricao = createDescricao.value.trim();
    const tipo = createTipo.value;
    if (!nome || !tipo) { setFeedback(createFeedback, 'Preencha os campos obrigat√≥rios.', false); return; }
    try {
      const res = await apiRequest('/api/workflows', 'POST', { nome, descricao, tipo, empresa_id: empresaId });
      if (res?.workflow) {
        state.workflows.unshift(res.workflow);
        renderList();
        hideCreate();
      }
    } catch (e) { setFeedback(createFeedback, e.message || 'Erro', false); }
  }

  // Empresa edit/delete handling
  function showEditEmpresa() { editModal?.classList.remove('hidden'); }
  function hideEditEmpresa() { editModal?.classList.add('hidden'); setFeedback(editFeedback, ''); }
  async function confirmEditEmpresa() {
    const nome = editNome.value.trim();
    const descricao = editDescricao.value.trim();
    if (!nome) { setFeedback(editFeedback, 'Informe o nome.', false); return; }
    try {
      await apiRequest(`/api/empresas/${empresaId}`, 'PUT', { nome, descricao });
      hideEditEmpresa();
      location.reload();
    } catch (e) { setFeedback(editFeedback, e.message || 'Erro', false); }
  }

  function showDeleteEmpresa() { deleteModal?.classList.remove('hidden'); }
  function hideDeleteEmpresa() { deleteModal?.classList.add('hidden'); }
  async function confirmDeleteEmpresa() {
    try {
      await apiRequest(`/api/empresas/${empresaId}`, 'DELETE');
      window.location.href = '/empresas';
    } catch (e) { alert(e.message || 'Erro'); hideDeleteEmpresa(); }
  }

  // Backdrop close
  if (createModal) createModal.addEventListener('click', e => { if (e.target === createModal) hideCreate(); });
  if (editModal) editModal.addEventListener('click', e => { if (e.target === editModal) hideEditEmpresa(); });
  const deleteModalEl = document.getElementById('deleteEmpresaModal');
  if (deleteModalEl) deleteModalEl.addEventListener('click', e => { if (e.target === deleteModalEl) hideDeleteEmpresa(); });

  if (openCreateBtn) openCreateBtn.addEventListener('click', showCreate);
  const btnCancelCreate = document.querySelector('[data-action="cancel-create-wf"]');
  const btnConfirmCreate = document.querySelector('[data-action="confirm-create-wf"]');
  if (btnCancelCreate) btnCancelCreate.addEventListener('click', hideCreate);
  if (btnConfirmCreate) btnConfirmCreate.addEventListener('click', confirmCreate);

  if (openEditEmpresaBtn) openEditEmpresaBtn.addEventListener('click', showEditEmpresa);
  if (openDeleteEmpresaBtn) openDeleteEmpresaBtn.addEventListener('click', showDeleteEmpresa);
  const btnCancelEdit = document.querySelector('[data-action="cancel-edit"]');
  const btnConfirmEdit = document.querySelector('[data-action="confirm-edit"]');
  const btnCancelDelete = document.querySelector('[data-action="cancel-delete"]');
  const btnConfirmDelete = document.querySelector('[data-action="confirm-delete"]');
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', hideEditEmpresa);
  if (btnConfirmEdit) btnConfirmEdit.addEventListener('click', confirmEditEmpresa);
  if (btnCancelDelete) btnCancelDelete.addEventListener('click', hideDeleteEmpresa);
  if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', confirmDeleteEmpresa);

  renderList();
})();






  // Editar/Excluir workflows na lista da empresa
  if (listContainer) {
    listContainer.addEventListener("click", async (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      const action = el.getAttribute("data-action");
      const idAttr = el.getAttribute("data-workflow-id");
      const id = idAttr ? Number(idAttr) : 0;
      if (!action || !id) return;

      const idx = state.workflows.findIndex((w) => Number(w.id) === id);
      if (idx < 0) return;
      const wf = state.workflows[idx];

      if (action === "delete-workflow") {
        if (!confirm(`Excluir o workflow "${wf.nome}"?`)) return;
        try {
          await apiRequest(`/api/workflows/${id}`, 'DELETE');
          state.workflows.splice(idx, 1);
          renderList();
        } catch (err) {
          alert(err.message || 'Falha ao excluir workflow');
        }
        return;
      }

      if (action === "edit-workflow") {
        const novoNome = prompt('Nome do workflow:', wf.nome);
        if (novoNome === null) return;
        const novaDesc = prompt('DescriÁ„o (opcional):', wf.descricao || '');
        try {
          const payload = { nome: (novoNome || '').trim(), descricao: (novaDesc || '').trim(), tipo: wf.tipo, empresa_id: empresaId };
          const res = await apiRequest(`/api/workflows/${id}`, 'PUT', payload);
          if (res?.workflow) {
            state.workflows[idx] = res.workflow;
            renderList();
          }
        } catch (err) {
          alert(err.message || 'Falha ao editar workflow');
        }
      }
    });
  }
