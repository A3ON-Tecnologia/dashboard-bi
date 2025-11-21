(() => {
  const { apiRequest, showToast, navigateWithToast } = window.dashboardUtils;

  const listContainer = document.getElementById('empresaList');
  const openCreateBtn = document.getElementById('openCreateEmpresaModal');
  const createModal = document.getElementById('createEmpresaModal');
  const createNome = document.getElementById('createEmpresaNome');
  const createDescricao = document.getElementById('createEmpresaDescricao');
  const createFeedback = document.getElementById('createEmpresaFeedback');
  const confirmCreateBtn = document.getElementById('confirmCreateEmpresa');
  const cancelCreateBtn = document.getElementById('cancelCreateEmpresa');

  const editModal = document.getElementById('editEmpresaModal');
  const editId = document.getElementById('editEmpresaId');
  const editNome = document.getElementById('editEmpresaNome');
  const editDescricao = document.getElementById('editEmpresaDescricao');
  const editFeedback = document.getElementById('editEmpresaFeedback');
  const confirmEditBtn = document.getElementById('confirmEditEmpresa');
  const cancelEditBtn = document.getElementById('cancelEditEmpresa');

  const deleteModal = document.getElementById('deleteEmpresaModal');
  const deleteName = document.getElementById('deleteEmpresaName');
  const confirmDeleteBtn = document.getElementById('confirmDeleteEmpresa');
  const cancelDeleteBtn = document.getElementById('cancelDeleteEmpresa');

  const state = {
    empresas: Array.isArray(window.__EMPRESAS__) ? [...window.__EMPRESAS__] : [],
    pendingDeleteId: null,
  };

  function renderList() {
    if (!listContainer) return;
    if (!state.empresas.length) {
      listContainer.innerHTML = '<p class="text-sm opacity-70">Nenhuma empresa cadastrada até o momento.</p>';
      return;
    }
    listContainer.innerHTML = state.empresas.map((e) => `
      <article class="rounded-xl border border-white/10 bg-black/10 backdrop-blur px-5 py-4 flex flex-col gap-4">
        <div>
          <h3 class="text-lg font-semibold">${e.nome}</h3>
          <p class="text-sm opacity-70">${e.descricao || 'Sem descrição informada.'}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <a href="/empresas/${e.id}" class="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-emerald-400/40 text-emerald-200 hover:border-emerald-400 hover:text-emerald-100 transition text-sm">Abrir</a>
          <button data-action="edit-empresa" data-empresa-id="${e.id}" class="px-4 py-2 rounded-lg border border-blue-400/40 text-blue-200 hover:border-blue-400 hover:text-blue-100 transition text-sm">Editar</button>
          <button data-action="delete-empresa" data-empresa-id="${e.id}" class="px-4 py-2 rounded-lg border border-red-400/40 text-red-200 hover:border-red-400 hover:text-red-100 transition text-sm">Excluir</button>
        </div>
      </article>
    `).join('');
  }

  function setFeedback(el, text, ok = true) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('hidden', !text);
    el.classList.toggle('text-emerald-300', ok);
    el.classList.toggle('text-rose-300', !ok);
  }

  function showCreate() {
    createNome.value = '';
    createDescricao.value = '';
    setFeedback(createFeedback, '');
    createModal?.classList.remove('hidden');
    requestAnimationFrame(() => createNome.focus());
  }
  function hideCreate() { createModal?.classList.add('hidden'); setFeedback(createFeedback, ''); }

  async function confirmCreate() {
    const nome = createNome.value.trim();
    const descricao = createDescricao.value.trim();
    if (!nome) { setFeedback(createFeedback, 'Informe o nome da empresa.', false); return; }
    try {
      const res = await apiRequest('/api/empresas', 'POST', { nome, descricao });
      if (res?.empresa) {
        hideCreate();
        navigateWithToast(`/empresas/${res.empresa.id}`, { message: 'Empresa criada com sucesso.', type: 'success', duration: 3000 });
      }
    } catch (e) {
      setFeedback(createFeedback, e.message || 'Erro', false);
      showToast({ message: e.message || 'Falha ao criar empresa.', type: 'error', duration: 3000 });
    }
  }

  function showEdit(id) {
    const emp = state.empresas.find(x => x.id === id);
    if (!emp) return;
    editId.value = String(emp.id);
    editNome.value = emp.nome;
    editDescricao.value = emp.descricao || '';
    setFeedback(editFeedback, '');
    editModal?.classList.remove('hidden');
    requestAnimationFrame(() => editNome.focus());
  }
  function hideEdit() { editModal?.classList.add('hidden'); setFeedback(editFeedback, ''); }

  async function confirmEdit() {
    const id = Number(editId.value);
    const nome = editNome.value.trim();
    const descricao = editDescricao.value.trim();
    if (!id || !nome) { setFeedback(editFeedback, 'Informe o nome.', false); return; }
    try {
      const res = await apiRequest(`/api/empresas/${id}`, 'PUT', { nome, descricao });
      if (res?.empresa) {
        hideEdit();
        navigateWithToast(`/empresas/${id}`, { message: 'Empresa atualizada com sucesso.', type: 'info', duration: 3000 });
      }
    } catch (e) {
      setFeedback(editFeedback, e.message || 'Erro', false);
      showToast({ message: e.message || 'Falha ao atualizar empresa.', type: 'error', duration: 3000 });
    }
  }

  function showDelete(id) {
    const emp = state.empresas.find(x => x.id === id);
    if (!emp) return;
    state.pendingDeleteId = id;
    deleteName.textContent = emp.nome;
    deleteModal?.classList.remove('hidden');
  }
  function hideDelete() { deleteModal?.classList.add('hidden'); state.pendingDeleteId = null; }

  async function confirmDelete() {
    if (!state.pendingDeleteId) return;
    try {
      await apiRequest(`/api/empresas/${state.pendingDeleteId}`, 'DELETE');
      state.empresas = state.empresas.filter(e => e.id !== state.pendingDeleteId);
      hideDelete();
      navigateWithToast('/empresas', { message: 'Empresa excluída com sucesso.', type: 'error', duration: 3000 });
    } catch (e) {
      showToast({ message: e.message || 'Falha ao excluir empresa.', type: 'error', duration: 3000 });
      hideDelete();
    }
  }

  function handleListClick(ev) {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    const id = Number(t.dataset.empresaId);
    if (!id) return;
    if (t.dataset.action === 'edit-empresa') showEdit(id);
    if (t.dataset.action === 'delete-empresa') showDelete(id);
  }

  // Backdrop close
  if (createModal) createModal.addEventListener('click', e => { if (e.target === createModal) hideCreate(); });
  if (editModal) editModal.addEventListener('click', e => { if (e.target === editModal) hideEdit(); });
  if (deleteModal) deleteModal.addEventListener('click', e => { if (e.target === deleteModal) hideDelete(); });

  if (openCreateBtn) openCreateBtn.addEventListener('click', showCreate);
  if (confirmCreateBtn) confirmCreateBtn.addEventListener('click', confirmCreate);
  if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', hideCreate);
  if (listContainer) listContainer.addEventListener('click', handleListClick);
  if (confirmEditBtn) confirmEditBtn.addEventListener('click', confirmEdit);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', hideEdit);
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', hideDelete);

  renderList();
})();
