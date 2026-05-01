// ICC v2.0 - Iago Command Center JS Core

const SUPABASE_URL = ICC_CONFIG.supabaseUrl;
const SUPABASE_KEY = ICC_CONFIG.supabaseKey;

const PAGE_SIZE = 20;
let leadsPage = 0;
let repairsPage = 0;
let productsPage = 0;

let iccClient = null;

document.addEventListener('DOMContentLoaded', () => {
  if (SUPABASE_URL) {
    iccClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    checkSession();
  }
});

// Autenticação
const loginForm = document.getElementById('login-form');
const loginOverlay = document.getElementById('login-overlay');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-pass').value;

  if (!iccClient) {
    alert('Erro: Supabase não inicializado.');
    return;
  }

  const { error } = await iccClient.auth.signInWithPassword({ email, password });

  if (error) {
    alert('Erro no login: ' + error.message);
  } else {
    loginOverlay.style.display = 'none';
    initDashboard();
  }
});

async function checkSession() {
  const { data: { session } } = await iccClient.auth.getSession();
  if (session) {
    loginOverlay.style.display = 'none';
    initDashboard();
  }
}

async function logout() {
  await iccClient.auth.signOut();
  window.location.reload();
}

// Navegação (adaptada para o Header)
function showPage(pageId, el) {
  const pages = ['dashboard', 'leads', 'customers', 'repairs', 'inventory', 'wiki', 'settings'];
  pages.forEach(p => {
    const pageEl = document.getElementById('page-' + p);
    if (pageEl) pageEl.style.display = 'none';
  });

  const target = document.getElementById('page-' + pageId);
  if (target) target.style.display = pageId === 'wiki' ? 'flex' : 'block';

  // Atualiza estado ativo no header
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => link.classList.remove('active'));
  if (el) el.classList.add('active');

  // Carrega dados ao navegar
  if (pageId === 'customers') fetchCustomers(0);
  if (pageId === 'leads')     fetchLeads(document.getElementById('lead-filter')?.value || 'Novo', 0);
  if (pageId === 'repairs')   fetchRepairs(0);
  if (pageId === 'inventory') fetchProducts(0);
  if (pageId === 'wiki')      initCopilotSidebar();
}

function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('open');
  document.getElementById('mobile-overlay').classList.toggle('open');
}

// Dashboard
async function initDashboard() {
  if (!iccClient) return;

  // Garante que o Dashboard fica visivel e ativo
  document.getElementById('page-dashboard').style.display = 'block';
  const firstNav = document.querySelector('.nav-link');
  if (firstNav) firstNav.classList.add('active');

  // Preenche a badge de data
  const now = new Date();
  const dateEl = document.getElementById('current-date');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^./, s => s.toUpperCase());
  }

  // Pre-load da IA em background
  getEmbedder().then(() => console.log('Copilot AI Brain: Pronto.')).catch(e => console.error('Erro pre-load IA:', e));

  fetchLeads();
  fetchRepairs();
  fetchProducts();

  const { data: leadsCount } = await iccClient
    .from('leads').select('*', { count: 'exact' }).eq('status', 'Novo');
  const { data: repairsCount } = await iccClient
    .from('repairs').select('*', { count: 'exact' }).neq('status', 'Entregue');

  document.getElementById('stat-leads').innerText = leadsCount ? leadsCount.length : 0;
  document.getElementById('stat-repairs').innerText = repairsCount ? repairsCount.length : 0;

  const yr = now.getFullYear();
  const mo = now.getMonth() + 1;
  const currentMonthStr = yr + '-' + String(mo).padStart(2, '0');
  const lastMonthStr = mo === 1 ? (yr - 1) + '-12' : yr + '-' + String(mo - 1).padStart(2, '0');

  const { data: deliveredRepairs } = await iccClient
    .from('repairs').select('*').eq('status', 'Entregue');

  let currentRevenue = 0; let lastRevenue = 0; let currentCost = 0;

  if (deliveredRepairs) {
    deliveredRepairs.forEach(r => {
      if (!r.exit_date) return;
      const val = parseFloat(r.price) || 0;
      const cost = parseFloat(r.part_cost) || 0;
      if (r.exit_date.startsWith(currentMonthStr)) { currentRevenue += val; currentCost += cost; }
      else if (r.exit_date.startsWith(lastMonthStr)) { lastRevenue += val; }
    });
  }

  document.getElementById('stat-revenue').innerText =
    currentRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const profitEl = document.getElementById('stat-profit');
  if (profitEl) {
    profitEl.innerText = (currentRevenue - currentCost)
      .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const trendEl = document.getElementById('stat-revenue-trend');
  if (lastRevenue === 0) {
    trendEl.innerText = currentRevenue > 0 ? '+100% vs mes anterior' : 'Sem dados do mes anterior';
    trendEl.style.color = currentRevenue > 0 ? 'var(--success)' : 'var(--text-dim)';
  } else {
    const diff = ((currentRevenue - lastRevenue) / lastRevenue) * 100;
    trendEl.innerText = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '% vs mes anterior';
    trendEl.style.color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
  }

  fetchRecentActivity();
}

// ==========================================
// Módulo de Leads — com paginação
// ==========================================
async function fetchLeads(filter = 'Novo', page = 0) {
  leadsPage = page;
  const tableBody = document.getElementById('leads-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando...</td></tr>';

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = iccClient.from('leads').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  query = filter === 'Novo' ? query.neq('status', 'Arquivado') : query.eq('status', 'Arquivado');

  const { data: leads, error, count } = await query;

  if (error) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erro ao carregar dados.</td></tr>';
    return;
  }

  if (!leads || leads.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum lead encontrado.</td></tr>';
    renderPagination('leads-pagination', page, count, (p) => fetchLeads(filter, p));
    return;
  }

  tableBody.innerHTML = leads.map(l => `
    <tr>
      <td>${new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
      <td>
        <div style="font-weight:600;">${escapeHtml(l.name)}</div>
        <div style="font-size:0.8rem; color:var(--text-dim);">${l.client_type || 'Pessoa Física'}</div>
      </td>
      <td>${escapeHtml(l.service_category)}</td>
      <td><span class="badge badge-urgency-${(l.urgency || 'media').toLowerCase()}">${l.urgency || 'Média'}</span></td>
      <td>${l.status}</td>
      <td>
        <div class="action-btns">
          <a href="https://wa.me/55${l.whatsapp.replace(/\D/g,'')}?text=Ol%C3%A1%20${encodeURIComponent(l.name)}%2C%20aqui%20%C3%A9%20o%20Iago%20da%20Iago%20Costa%20TI.%20Recebi%20seu%20contato!" target="_blank" class="btn-icon wa" title="Chamar no WhatsApp"><i class="ph ph-whatsapp-logo"></i></a>
          <button class="btn-icon" onclick="convertToCustomer('${l.id}')" title="Converter em Cliente"><i class="ph ph-user-plus"></i></button>
          <button class="btn-icon archive" onclick="archiveLead('${l.id}')" title="Arquivar"><i class="ph ph-archive"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  renderPagination('leads-pagination', page, count, (p) => fetchLeads(filter, p));
}

async function archiveLead(id) {
  if (!confirm('Deseja arquivar este lead?')) return;
  const { error } = await iccClient.from('leads').update({ status: 'Arquivado' }).eq('id', id);
  if (!error) fetchLeads(document.getElementById('lead-filter')?.value || 'Novo', leadsPage);
}

async function convertToCustomer(leadId) {
  const { data: lead } = await iccClient.from('leads').select('*').eq('id', leadId).single();
  if (!lead) return;

  // Verifica se já existe cliente com esse WhatsApp
  const { data: existing } = await iccClient
    .from('customers').select('id, name').eq('whatsapp', lead.whatsapp).single();

  if (existing) {
    if (confirm(`Cliente "${existing.name}" já existe com esse WhatsApp. Deseja apenas arquivar o lead?`)) {
      await archiveLead(leadId);
    }
    return;
  }

  // Pré-preenche o modal de cliente com os dados do lead
  openCustomerModal();
  document.getElementById('cust-name').value = lead.name;
  document.getElementById('cust-whatsapp').value = lead.whatsapp;
  document.getElementById('cust-type').value = lead.client_type || 'Pessoa Física';
  document.getElementById('customer-modal-title').textContent = 'Converter Lead em Cliente';

  // Após salvar, arquiva o lead automaticamente
  document.getElementById('customer-form').dataset.convertLeadId = leadId;
}

async function fetchRecentActivity() {
  const feed = document.getElementById('activity-feed');
  if (!feed) return;

  const { data: leads, error } = await iccClient
    .from('leads').select('*').order('created_at', { ascending: false }).limit(5);

  if (error) {
    feed.innerHTML = '<p style="padding:1rem;">Erro ao carregar atividades.</p>';
    return;
  }

  if (leads && leads.length > 0) {
    feed.innerHTML = leads.map(l => `
      <div class="activity-item">
        <div class="activity-icon"><i class="ph ph-user-plus"></i></div>
        <div class="activity-info">
          <p><strong>Novo Lead:</strong> ${escapeHtml(l.name)} solicitou orçamento para ${escapeHtml(l.service_category)}</p>
          <span style="font-size:0.7rem; color:var(--text-dim);">${new Date(l.created_at).toLocaleTimeString('pt-BR')}</span>
        </div>
      </div>
    `).join('');
  } else {
    feed.innerHTML = '<p style="padding:1rem;">Nenhuma atividade recente.</p>';
  }
}

// ==========================================
// Módulo de Reparos (O.S.) — com paginação
// ==========================================
async function openOSModal() { 
  document.getElementById('os-modal').style.display = 'flex'; 
  const customerSelect = document.getElementById('os-customer');
  customerSelect.innerHTML = '<option value="" disabled selected>Carregando clientes...</option>';
  
  const { data: customers } = await iccClient.from('customers').select('id, name, whatsapp').order('name');
  if (customers) {
    customerSelect.innerHTML = '<option value="" disabled selected>Selecione um cliente...</option>' + 
      customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.whatsapp})</option>`).join('');
  }
}

function closeOSModal() { document.getElementById('os-modal').style.display = 'none'; }

// Mapa de prioridade para ordenação e estilo
const PRIORITY_ORDER = { 'Urgente': 1, 'Alta': 2, 'Normal': 3, 'Baixa': 4 };
const PRIORITY_STYLE = {
  'Urgente': 'background:rgba(239,68,68,0.15);color:#f87171;border-color:rgba(239,68,68,0.3);',
  'Alta':    'background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.3);',
  'Normal':  'background:rgba(16,185,129,0.15);color:#34d399;border-color:rgba(16,185,129,0.3);',
  'Baixa':   'background:rgba(160,171,184,0.1);color:#a0abb8;border-color:rgba(160,171,184,0.2);',
};

async function fetchRepairs(page = 0) {
  repairsPage = page;
  const tableBody = document.getElementById('repairs-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando reparos...</td></tr>';

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: repairs, error, count } = await iccClient
    .from('repairs').select('*', { count: 'exact' })
    .neq('status', 'Entregue')
    .range(from, to);

  if (error) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ef4444;">Erro ao carregar dados.</td></tr>';
    return;
  }

  if (!repairs || repairs.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhuma O.S. ativa.</td></tr>';
    renderPagination('repairs-pagination', page, count, fetchRepairs);
    return;
  }

  // Ordena: prioridade primeiro, depois prazo (mais próximo primeiro, null por último)
  repairs.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 3;
    const pb = PRIORITY_ORDER[b.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    if (!a.deadline_date && !b.deadline_date) return 0;
    if (!a.deadline_date) return 1;
    if (!b.deadline_date) return -1;
    return new Date(a.deadline_date) - new Date(b.deadline_date);
  });

  const today = new Date(); today.setHours(0,0,0,0);

  tableBody.innerHTML = repairs.map(r => {
    const profit = (r.price || 0) - (r.part_cost || 0);
    const priority = r.priority || 'Normal';
    const pStyle = PRIORITY_STYLE[priority] || PRIORITY_STYLE['Normal'];

    // Deadline badge
    let deadlineBadge = '';
    if (r.deadline_date) {
      const dl = new Date(r.deadline_date + 'T00:00:00');
      const diff = Math.round((dl - today) / 86400000);
      const dlStr = dl.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (diff < 0)      deadlineBadge = `<span style="font-size:0.72rem;color:#f87171;">⚠ Atrasado (${dlStr})</span>`;
      else if (diff === 0) deadlineBadge = `<span style="font-size:0.72rem;color:#fbbf24;">⏰ Hoje (${dlStr})</span>`;
      else if (diff <= 2)  deadlineBadge = `<span style="font-size:0.72rem;color:#fbbf24;">📅 ${dlStr}</span>`;
      else                 deadlineBadge = `<span style="font-size:0.72rem;color:var(--text-dim);">📅 ${dlStr}</span>`;
    }

    const customerName = r.customers?.name || '—';

    return `
      <tr>
        <td><span class="badge" style="${pStyle}">${priority}</span></td>
        <td>
          <div style="font-weight:600;">${escapeHtml(r.device_model)}</div>
          <div style="font-size:0.78rem;color:var(--text-dim);">${escapeHtml(customerName)}</div>
        </td>
        <td style="font-size:0.85rem;">${escapeHtml(r.description || '—')}</td>
        <td><span class="badge badge-status-${r.status.toLowerCase().replace(/ /g,'-')}">${r.status}</span></td>
        <td>${deadlineBadge || '<span style="color:var(--text-dim);font-size:0.8rem;">—</span>'}</td>
        <td>R$ ${(r.price||0).toLocaleString('pt-BR')}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="Editar" onclick="updateOSStatus('${r.id}')"><i class="ph ph-note-pencil"></i></button>
            <button class="btn-icon archive" title="Excluir" onclick="deleteOS('${r.id}')"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination('repairs-pagination', page, count, fetchRepairs);
}

const osForm = document.getElementById('os-form');
if (osForm) {
  osForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      customer_id: document.getElementById('os-customer').value,
      device_model: document.getElementById('os-model').value,
      price: parseFloat(document.getElementById('os-price').value) || 0,
      part_cost: parseFloat(document.getElementById('os-cost').value) || 0,
      description: document.getElementById('os-notes').value,
      priority: document.getElementById('os-priority').value || 'Normal',
      deadline_date: document.getElementById('os-deadline').value || null,
      status: 'Em Análise',
    };
    const { error } = await iccClient.from('repairs').insert([payload]);
    if (error) {
      alert('Erro ao criar O.S.: ' + error.message);
    } else {
      closeOSModal();
      osForm.reset();
      fetchRepairs(repairsPage);
      alert('Ordem de Serviço criada com sucesso!');
    }
  });
}

function updateOSStatus(id) {
  const old = document.getElementById('os-status-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'os-status-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div class="glass-card" style="max-width:400px;width:90%;padding:2rem;">
      <h3 style="margin-bottom:1.5rem;font-size:1.1rem;"><i class="ph ph-git-branch"></i> Atualizar O.S.</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select id="os-new-status">
            <option value="Em Análise">Em Análise</option>
            <option value="Aguardando Peça">Aguardando Peça</option>
            <option value="Pronto">Pronto para Retirada</option>
            <option value="Entregue">Entregue ao Cliente ✓</option>
          </select>
        </div>
        <div class="form-group">
          <label>Prioridade</label>
          <select id="os-new-priority">
            <option value="Urgente">🔴 Urgente</option>
            <option value="Alta">🟡 Alta</option>
            <option value="Normal" selected>🟢 Normal</option>
            <option value="Baixa">⚫ Baixa</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Prazo de Entrega (opcional)</label>
        <input type="date" id="os-new-deadline" style="color-scheme:dark;">
      </div>
      <div class="login-actions">
        <button class="btn-secondary" onclick="document.getElementById('os-status-modal').remove()">Cancelar</button>
        <button class="btn-primary" onclick="confirmOSStatus('${id}')">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function confirmOSStatus(id) {
  const newStatus = document.getElementById('os-new-status').value;
  const newPriority = document.getElementById('os-new-priority').value;
  const newDeadline = document.getElementById('os-new-deadline').value;
  const payload = {
    status: newStatus,
    priority: newPriority,
    deadline_date: newDeadline || null,
  };
  if (newStatus === 'Entregue') payload.exit_date = new Date().toISOString().split('T')[0];
  const { error } = await iccClient.from('repairs').update(payload).eq('id', id);
  document.getElementById('os-status-modal').remove();
  if (!error) fetchRepairs(repairsPage);
  else alert('Erro ao atualizar: ' + error.message);
}

async function deleteOS(id) {
  if (!confirm('Deseja excluir esta O.S.? Esta ação não pode ser desfeita.')) return;
  const { error } = await iccClient.from('repairs').delete().eq('id', id);
  if (!error) fetchRepairs(repairsPage);
}

// ==========================================
// Módulo de Inventário — com paginação
// ==========================================
function openProductModal() { 
  document.getElementById('product-modal').style.display = 'flex'; 
  document.getElementById('product-form').reset();
  document.getElementById('prod-id').value = '';
}
function closeProductModal() { document.getElementById('product-modal').style.display = 'none'; }

async function fetchProducts(page = 0) {
  productsPage = page;
  const tableBody = document.getElementById('inventory-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando estoque...</td></tr>';

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: products, error, count } = await iccClient
    .from('products').select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('name', { ascending: true })
    .range(from, to);

  if (error) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erro ao carregar dados.</td></tr>';
    return;
  }

  if (!products || products.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum produto em estoque.</td></tr>';
    renderPagination('inventory-pagination', page, count, fetchProducts);
    return;
  }

  tableBody.innerHTML = products.map(p => {
    const stockStyle = p.stock_quantity <= 2 ? 'color:#ef4444; font-weight:800;' : '';
    return `
      <tr>
        <td>
          <div style="font-weight:600;">${escapeHtml(p.name)}</div>
          <div style="font-size:0.75rem; color:var(--text-dim);">${escapeHtml(p.description || '')}</div>
        </td>
        <td><span class="badge">${p.category}</span></td>
        <td><span style="${stockStyle}">${p.stock_quantity} un</span></td>
        <td>R$ ${p.cost_price?.toLocaleString('pt-BR')}</td>
        <td>R$ ${p.price?.toLocaleString('pt-BR')}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="Editar" onclick="editProduct('${p.id}')"><i class="ph ph-note-pencil"></i></button>
            <button class="btn-icon archive" title="Remover" onclick="deleteProduct('${p.id}')"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination('inventory-pagination', page, count, fetchProducts);
}

const productForm = document.getElementById('product-form');
if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prodId = document.getElementById('prod-id').value;
    const payload = {
      name: document.getElementById('prod-name').value,
      category: document.getElementById('prod-category').value,
      stock_quantity: parseInt(document.getElementById('prod-stock').value),
      cost_price: parseFloat(document.getElementById('prod-cost').value),
      price: parseFloat(document.getElementById('prod-price').value),
      is_active: true,
    };
    
    let error;
    if (prodId) {
      ({ error } = await iccClient.from('products').update(payload).eq('id', prodId));
    } else {
      ({ error } = await iccClient.from('products').insert([payload]));
    }
    
    if (error) {
      alert('Erro ao salvar produto: ' + error.message);
    } else {
      closeProductModal();
      productForm.reset();
      fetchProducts(productsPage);
      alert('Produto salvo com sucesso!');
    }
  });
}

async function deleteProduct(id) {
  if (!confirm('Deseja remover este produto do estoque ativo?')) return;
  const { error } = await iccClient.from('products').update({ is_active: false }).eq('id', id);
  if (!error) fetchProducts(productsPage);
}

async function editProduct(id) {
  const { data: p } = await iccClient.from('products').select('*').eq('id', id).single();
  if (!p) return;
  openProductModal();
  document.getElementById('prod-id').value = p.id;
  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category;
  document.getElementById('prod-stock').value = p.stock_quantity;
  document.getElementById('prod-cost').value = p.cost_price;
  document.getElementById('prod-price').value = p.price;
}

// ==========================================
// Utilitário de Paginação
// ==========================================
function renderPagination(containerId, currentPage, totalCount, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.8rem; justify-content:center; padding:1rem 0;">
      <button class="btn-secondary" onclick="(${onPageChange.toString()})(${currentPage - 1})"
        ${currentPage === 0 ? 'disabled' : ''}>
        <i class="ph ph-caret-left"></i> Anterior
      </button>
      <span style="color:var(--text-dim); font-size:0.85rem;">
        Página ${currentPage + 1} de ${totalPages} · ${totalCount} registros
      </span>
      <button class="btn-secondary" onclick="(${onPageChange.toString()})(${currentPage + 1})"
        ${currentPage >= totalPages - 1 ? 'disabled' : ''}>
        Próxima <i class="ph ph-caret-right"></i>
      </button>
    </div>
  `;
}

// ==========================================
// Utilitário de segurança — escapa HTML para evitar XSS
// ==========================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ==========================================
// Módulo de Clientes
// ==========================================
let customersPage = 0;
let customersSearchTerm = '';

function openCustomerModal(customerId = null) {
  document.getElementById('customer-modal').style.display = 'flex';
  document.getElementById('customer-form').reset();
  document.getElementById('customer-id').value = customerId || '';
  document.getElementById('customer-form').dataset.convertLeadId = '';
  document.getElementById('customer-modal-title').textContent = customerId ? 'Editar Cliente' : 'Novo Cliente';
}

function closeCustomerModal() {
  document.getElementById('customer-modal').style.display = 'none';
}

function closeHistoryModal() {
  document.getElementById('customer-history-modal').style.display = 'none';
}

async function fetchCustomers(page = 0) {
  customersPage = page;
  const tableBody = document.getElementById('customers-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando...</td></tr>';

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = iccClient.from('customers').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (customersSearchTerm) {
    query = query.or(`name.ilike.%${customersSearchTerm}%,whatsapp.ilike.%${customersSearchTerm}%`);
  }

  const { data: customers, error, count } = await query;

  if (error) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erro ao carregar dados.</td></tr>';
    return;
  }

  if (!customers || customers.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum cliente encontrado.</td></tr>';
    renderPagination('customers-pagination', page, count, fetchCustomers);
    return;
  }

  // Para cada cliente, busca contagem e última OS
  const customerIds = customers.map(c => c.id);
  const { data: repairStats } = await iccClient
    .from('repairs')
    .select('customer_id, created_at')
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });

  tableBody.innerHTML = customers.map(c => {
    const customerRepairs = repairStats ? repairStats.filter(r => r.customer_id === c.id) : [];
    const totalOS = customerRepairs.length;
    const lastOS = totalOS > 0
      ? new Date(customerRepairs[0].created_at).toLocaleDateString('pt-BR')
      : '—';

    return `
      <tr>
        <td>
          <div style="font-weight:600;">${escapeHtml(c.name)}</div>
          ${c.notes ? `<div style="font-size:0.75rem; color:var(--text-dim);">${escapeHtml(c.notes)}</div>` : ''}
        </td>
        <td>
          <a href="https://wa.me/55${c.whatsapp.replace(/\D/g,'')}?text=Ol%C3%A1%20${encodeURIComponent(c.name)}%2C%20aqui%20%C3%A9%20o%20Iago!" target="_blank" style="color:var(--success); display:flex; align-items:center; gap:0.3rem;">
            <i class="ph ph-whatsapp-logo"></i> ${c.whatsapp}
          </a>
        </td>
        <td><span class="badge">${c.client_type || 'Pessoa Física'}</span></td>
        <td style="text-align:center; font-weight:600;">${totalOS}</td>
        <td>${lastOS}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="Ver Histórico" onclick="viewCustomerHistory('${c.id}')"><i class="ph ph-clock-counter-clockwise"></i></button>
            <button class="btn-icon" title="Editar" onclick="editCustomer('${c.id}')"><i class="ph ph-note-pencil"></i></button>
            <button class="btn-icon archive" title="Remover" onclick="deleteCustomer('${c.id}')"><i class="ph ph-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination('customers-pagination', page, count, fetchCustomers);
}

let searchTimeout = null;
function searchCustomers(term) {
  customersSearchTerm = term;
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => fetchCustomers(0), 350);
}

async function viewCustomerHistory(customerId) {
  document.getElementById('customer-history-modal').style.display = 'flex';
  document.getElementById('customer-history-body').innerHTML = '<p style="text-align:center; color:var(--text-dim); padding:2rem;">Carregando...</p>';

  const { data: customer } = await iccClient.from('customers').select('*').eq('id', customerId).single();
  if (!customer) return;

  document.getElementById('history-customer-name').textContent = customer.name;
  document.getElementById('history-customer-info').textContent =
    `${customer.whatsapp} · ${customer.client_type || 'Pessoa Física'} · Cliente desde ${new Date(customer.created_at).toLocaleDateString('pt-BR')}`;

  const { data: repairs } = await iccClient
    .from('repairs').select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (!repairs || repairs.length === 0) {
    document.getElementById('customer-history-body').innerHTML =
      '<p style="text-align:center; color:var(--text-dim); padding:2rem;">Nenhuma O.S. vinculada a este cliente.</p>';
    return;
  }

  const totalRevenue = repairs.reduce((sum, r) => sum + (r.price || 0), 0);

  document.getElementById('customer-history-body').innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1.5rem;">
      <div style="background:rgba(177,74,255,0.1); padding:1rem; border-radius:12px; text-align:center;">
        <div style="font-size:1.4rem; font-weight:700;">${repairs.length}</div>
        <div style="font-size:0.8rem; color:var(--text-dim);">O.S. no total</div>
      </div>
      <div style="background:rgba(16,185,129,0.1); padding:1rem; border-radius:12px; text-align:center;">
        <div style="font-size:1.4rem; font-weight:700; color:var(--success);">${totalRevenue.toLocaleString('pt-BR', {style:'currency',currency:'BRL'})}</div>
        <div style="font-size:0.8rem; color:var(--text-dim);">Faturamento total</div>
      </div>
      <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; text-align:center;">
        <div style="font-size:1.4rem; font-weight:700;">${new Date(repairs[repairs.length-1].created_at).toLocaleDateString('pt-BR')}</div>
        <div style="font-size:0.8rem; color:var(--text-dim);">Primeira visita</div>
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      ${repairs.map(r => `
        <div style="background:rgba(0,0,0,0.2); padding:1rem; border-radius:10px; border:1px solid var(--glass-border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600;">${escapeHtml(r.device_model)}</div>
            <div style="font-size:0.8rem; color:var(--text-dim);">${escapeHtml(r.description || 'Sem descrição')} · ${new Date(r.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:600; color:var(--success);">R$ ${(r.price||0).toLocaleString('pt-BR')}</div>
            <span class="badge badge-status-${r.status.toLowerCase().replace(' ','-')}" style="font-size:0.7rem;">${r.status}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function editCustomer(id) {
  const { data: c } = await iccClient.from('customers').select('*').eq('id', id).single();
  if (!c) return;
  openCustomerModal(id);
  document.getElementById('cust-name').value = c.name;
  document.getElementById('cust-whatsapp').value = c.whatsapp;
  document.getElementById('cust-type').value = c.client_type || 'Pessoa Física';
  document.getElementById('cust-notes').value = c.notes || '';
}

async function deleteCustomer(id) {
  if (!confirm('Remover este cliente? As O.S. vinculadas não serão excluídas.')) return;
  const { error } = await iccClient.from('customers').delete().eq('id', id);
  if (!error) fetchCustomers(customersPage);
}

const customerForm = document.getElementById('customer-form');
if (customerForm) {
  customerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-customer');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const id = document.getElementById('customer-id').value;
    const convertLeadId = customerForm.dataset.convertLeadId;

    const payload = {
      name: document.getElementById('cust-name').value.trim(),
      whatsapp: document.getElementById('cust-whatsapp').value.replace(/\D/g, ''),
      client_type: document.getElementById('cust-type').value,
      notes: document.getElementById('cust-notes').value.trim(),
    };

    let error;
    if (id) {
      ({ error } = await iccClient.from('customers').update(payload).eq('id', id));
    } else {
      ({ error } = await iccClient.from('customers').insert([payload]));
    }

    if (error) {
      alert('Erro ao salvar cliente: ' + (error.message.includes('unique') ? 'Já existe um cliente com esse WhatsApp.' : error.message));
    } else {
      // Se veio de uma conversão de lead, arquiva o lead
      if (convertLeadId) {
        await iccClient.from('leads').update({ status: 'Arquivado' }).eq('id', convertLeadId);
      }
      closeCustomerModal();
      fetchCustomers(customersPage);
    }

    btn.disabled = false;
    btn.textContent = 'Salvar Cliente';
  });
}

// ==========================================
// Configurações — a chave Groq agora é env var no Vercel
// ==========================================
function saveSettings() {
  alert('As configurações agora são feitas via variáveis de ambiente no Vercel. Veja a aba Configurações para instruções.');
}

// ==========================================
// Módulo de Feedback da IA (RLHF)
// ==========================================
window.feedbackUp = async function(btnId, matchedIdsStr, query, answer) {
  const btn = document.getElementById(btnId);
  if (btn) btn.innerHTML = '<i class="ph ph-check"></i> Anotado!';
  try {
    const matchedIds = JSON.parse(decodeURIComponent(matchedIdsStr));
    if (matchedIds && matchedIds.length > 0) {
      await iccClient.rpc('increment_wiki_score', { wiki_ids: matchedIds });
    } else {
      const extractor = await getEmbedder();
      const textToEmbed = `Problema: ${decodeURIComponent(query)}. Solução: ${decodeURIComponent(answer)}`;
      const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);
      await iccClient.from('wiki').insert([{
        title: decodeURIComponent(query),
        category: 'IA Gerado',
        content: decodeURIComponent(answer),
        embedding,
        success_score: 1,
      }]);
    }
  } catch (e) { console.error('Erro no feedback:', e); }
};

window.feedbackDown = function(query) {
  alert('Entendi! O que resolveu de verdade então?');
  openWikiModal();
  document.getElementById('wiki-title').value = decodeURIComponent(query);
  document.getElementById('wiki-category').value = 'Hardware Diversos';
  document.getElementById('wiki-content').focus();
};

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return embedder;
}

function openWikiModal() { document.getElementById('wiki-modal').style.display = 'flex'; }
function closeWikiModal() { document.getElementById('wiki-modal').style.display = 'none'; }

const wikiForm = document.getElementById('wiki-form');
if (wikiForm) {
  wikiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-wiki');
    btn.innerText = 'Processando IA...';
    btn.disabled = true;

    const title = document.getElementById('wiki-title').value;
    const category = document.getElementById('wiki-category').value;
    const content = document.getElementById('wiki-content').value;

    try {
      const textToEmbed = `Problema: ${title}. Solução: ${content}`;
      const extractor = await getEmbedder();
      const output = await extractor(textToEmbed, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);

      const { error } = await iccClient.from('wiki').insert([{ title, category, content, embedding }]);
      if (error) throw error;

      alert('Conhecimento salvo no cérebro digital!');
      closeWikiModal();
      wikiForm.reset();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar no Wiki: ' + err.message);
    } finally {
      btn.innerText = 'Salvar no Cérebro Digital';
      btn.disabled = false;
    }
  });
}

// ==========================================================
// COPILOT MULTI-SESSÃO
// ==========================================================
const ICC_SESSIONS_KEY = 'icc_sessions';
const ICC_CURRENT_KEY  = 'icc_current_session';

function getSessions() {
  return JSON.parse(localStorage.getItem(ICC_SESSIONS_KEY) || '[]');
}
function saveSessions(sessions) {
  localStorage.setItem(ICC_SESSIONS_KEY, JSON.stringify(sessions));
}
function getCurrentId() {
  return localStorage.getItem(ICC_CURRENT_KEY) || null;
}
function setCurrentId(id) {
  localStorage.setItem(ICC_CURRENT_KEY, id);
}

function generateId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function generateTitle(text) {
  return text.trim().slice(0, 38) + (text.trim().length > 38 ? '...' : '');
}

function createNewSession(autoLoad = true) {
  const sessions = getSessions();
  if (sessions.length >= 20) {
    // Remove a mais antiga
    sessions.sort((a, b) => a.createdAt - b.createdAt);
    sessions.shift();
  }
  const newSession = {
    id: generateId(),
    title: 'Nova Conversa',
    history: [],
    uiHtml: '',
    createdAt: Date.now()
  };
  sessions.push(newSession);
  saveSessions(sessions);
  setCurrentId(newSession.id);
  if (autoLoad) {
    renderSessionList();
    renderChatUI(newSession);
  }
  return newSession;
}

function loadSession(id) {
  const sessions = getSessions();
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  setCurrentId(id);
  renderSessionList();
  renderChatUI(session);
}

function deleteSession(id) {
  let sessions = getSessions();
  sessions = sessions.filter(s => s.id !== id);
  saveSessions(sessions);

  // Se era a atual, carrega outra
  if (getCurrentId() === id) {
    if (sessions.length > 0) {
      setCurrentId(sessions[sessions.length - 1].id);
      renderChatUI(sessions[sessions.length - 1]);
    } else {
      localStorage.removeItem(ICC_CURRENT_KEY);
      const historyEl = document.getElementById('chat-history');
      if (historyEl) historyEl.innerHTML = '<div class="copilot-welcome"><i class="ph ph-robot"></i><p>Crie uma nova conversa para começar.</p></div>';
    }
  }
  renderSessionList();
}

function updateSessionData(id, historyArr, uiHtml, title) {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx === -1) return;
  sessions[idx].history = historyArr;
  sessions[idx].uiHtml  = uiHtml;
  if (title) sessions[idx].title = title;
  saveSessions(sessions);
}

function renderSessionList() {
  const sessions = getSessions();
  const currentId = getCurrentId();
  const listEl = document.getElementById('session-list');
  if (!listEl) return;

  if (sessions.length === 0) {
    listEl.innerHTML = '<div style="padding:1rem;color:var(--text-dim);font-size:0.8rem;text-align:center;">Nenhuma conversa ainda.</div>';
    return;
  }

  // Ordena do mais recente para o mais antigo
  const sorted = [...sessions].sort((a, b) => b.createdAt - a.createdAt);

  listEl.innerHTML = sorted.map(s => {
    const isActive = s.id === currentId;
    const time = new Date(s.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(s.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const dateStr = new Date(s.createdAt).toDateString() === new Date().toDateString() ? time : date;
    return `
      <div class="session-item ${isActive ? 'active' : ''}" onclick="loadSession('${s.id}')">
        <div class="session-info">
          <div class="session-title">${escapeHtml(s.title)}</div>
          <div class="session-time">${dateStr}</div>
        </div>
        <button class="session-delete" onclick="event.stopPropagation(); deleteSession('${s.id}')" title="Apagar conversa">
          <i class="ph ph-trash"></i>
        </button>
      </div>
    `;
  }).join('');
}

function renderChatUI(session) {
  const historyEl = document.getElementById('chat-history');
  if (!historyEl) return;
  if (session.uiHtml) {
    historyEl.innerHTML = session.uiHtml;
  } else {
    historyEl.innerHTML = `
      <div class="copilot-welcome">
        <i class="ph ph-robot"></i>
        <p>Olá! Sou o seu Copilot de TI. Me conte o problema e eu buscarei nas suas anotações a melhor solução.</p>
      </div>
    `;
  }
  historyEl.scrollTop = historyEl.scrollHeight;
}

function initCopilotSidebar() {
  const sessions = getSessions();
  let currentId = getCurrentId();

  // Se não há sessões, cria uma automaticamente
  if (sessions.length === 0) {
    createNewSession(true);
    return;
  }

  // Se não há sessão atual válida, carrega a mais recente
  if (!currentId || !sessions.find(s => s.id === currentId)) {
    const latest = sessions.sort((a, b) => b.createdAt - a.createdAt)[0];
    setCurrentId(latest.id);
    currentId = latest.id;
  }

  renderSessionList();
  const current = sessions.find(s => s.id === currentId);
  if (current) renderChatUI(current);
}

// Referência à história atual da sessão ativa (alias para o sistema de chat)
function getCurrentHistory() {
  const sessions = getSessions();
  const current = sessions.find(s => s.id === getCurrentId());
  return current ? current.history : [];
}

// ── Chat Form ──
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

if (chatForm && chatInput) {
  chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });

  chatInput.addEventListener('input', function() {
    this.style.height = '45px';
    this.style.height = Math.min(this.scrollHeight, 180) + 'px';
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const query = input.value.trim();
    if (!query) return;

    // Garante que há uma sessão ativa
    if (!getCurrentId() || getSessions().length === 0) createNewSession(false);

    const historyEl = document.getElementById('chat-history');

    // Remove welcome msg se ainda existir
    const welcome = historyEl.querySelector('.copilot-welcome');
    if (welcome) welcome.remove();

    // Mensagem do usuário
    const userDiv = document.createElement('div');
    userDiv.className = 'chat-msg-user';
    userDiv.innerHTML = `<div>${escapeHtml(query).replace(/\n/g, '<br>')}</div>`;
    historyEl.appendChild(userDiv);

    input.value = '';
    input.style.height = '45px';

    // Placeholder IA
    const typingId = 'typing-' + Date.now();
    const aiDiv = document.createElement('div');
    aiDiv.id = typingId;
    aiDiv.className = 'chat-msg-ai';
    aiDiv.innerHTML = `
      <div class="chat-msg-ai-header"><i class="ph ph-robot"></i> Copilot</div>
      <div class="markdown-body" id="content-${typingId}"><span style="color:var(--text-dim)">Analisando sua base vetorial...</span></div>
    `;
    historyEl.appendChild(aiDiv);
    historyEl.scrollTop = historyEl.scrollHeight;

    const chatBtn = document.getElementById('chat-btn');
    chatBtn.disabled = true;

    try {
      const extractor = await getEmbedder();
      const output = await extractor(query, { pooling: 'mean', normalize: true });
      const query_embedding = Array.from(output.data);

      const { data: matches } = await iccClient.rpc('match_wiki_articles', {
        query_embedding, match_threshold: 0.3, match_count: 3,
      });

      const { count: leadsCount } = await iccClient.from('leads').select('*', { count: 'exact', head: true }).neq('status', 'Arquivado');
      const { count: repairsCount } = await iccClient.from('repairs').select('*', { count: 'exact', head: true }).neq('status', 'Entregue');

      let systemPrompt = `Você é o Copilot de TI integrado ao ICC do Iago Costa. God Mode ativado: ajude com diagnósticos avançados de hardware/software e entenda o negócio.\n`;
      systemPrompt += `CONTEXTO AO VIVO: ${leadsCount || 0} leads em aberto, ${repairsCount || 0} equipamentos na bancada.\n\n`;
      if (matches && matches.length > 0) {
        const ctx = matches.map(m => `Problema: ${m.title}\nSolução: ${m.content}`).join('\n---\n');
        systemPrompt += `WIKI:\n${ctx}\n\nUse as anotações acima. Responda em Markdown.`;
      } else {
        systemPrompt += `Nenhuma anotação encontrada. Responda com seu conhecimento de TI em Markdown.`;
      }

      const currentHistory = getCurrentHistory();
      const messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...currentHistory,
        { role: 'user', content: query }
      ];

      const contentBox = document.getElementById('content-' + typingId);
      contentBox.innerHTML = '';

      const { data: { session } } = await iccClient.auth.getSession();
      const jwtToken = session ? session.access_token : '';

      const groqRes = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
        body: JSON.stringify({ messages: messagesPayload, temperature: 0.5, max_tokens: 1024, stream: true }),
      });

      if (!groqRes.ok) {
        const err = await groqRes.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${groqRes.status}`);
      }

      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let finalAnswer = '';
      const renderMarkdown = (t) => window.marked ? window.marked.parse(t) : escapeHtml(t).replace(/\n/g, '<br>');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const tok = JSON.parse(line.slice(6)).choices[0]?.delta?.content || '';
              finalAnswer += tok;
              contentBox.innerHTML = renderMarkdown(finalAnswer);
              historyEl.scrollTop = historyEl.scrollHeight;
            } catch (_) {}
          }
        }
      }

      // Feedback buttons
      const matchedIds = matches ? matches.map(m => m.id) : [];
      const encodedIds = encodeURIComponent(JSON.stringify(matchedIds));
      const encodedQuery = encodeURIComponent(query);
      const encodedAnswer = encodeURIComponent(finalAnswer.substring(0, 500));
      const btnId = 'btn-up-' + Date.now();

      const prefixHTML = (matches && matches.length > 0)
        ? `<span class="badge" style="margin-bottom:0.75rem;display:inline-block;background:rgba(177,74,255,0.2);color:white;border:none;"><i class="ph ph-books"></i> Usei ${matches.length} anotação(es) da Wiki</span><br>`
        : '';

      const feedbackHTML = `
        <div style="margin-top:0.75rem;display:flex;gap:0.5rem;align-items:center;border-top:1px solid var(--glass-border);padding-top:0.5rem;">
          <span style="font-size:0.78rem;color:var(--text-dim);">Foi útil?</span>
          <button id="${btnId}" onclick="feedbackUp('${btnId}','${encodedIds}','${encodedQuery}','${encodedAnswer}')" style="background:rgba(16,185,129,0.1);color:var(--success);border:none;padding:0.25rem 0.6rem;border-radius:4px;cursor:pointer;font-size:0.8rem;"><i class="ph ph-thumbs-up"></i> Resolveu</button>
          <button onclick="feedbackDown('${encodedQuery}')" style="background:rgba(239,68,68,0.1);color:var(--danger);border:none;padding:0.25rem 0.6rem;border-radius:4px;cursor:pointer;font-size:0.8rem;"><i class="ph ph-thumbs-down"></i> Não</button>
        </div>`;

      contentBox.innerHTML = prefixHTML + renderMarkdown(finalAnswer) + feedbackHTML;
      historyEl.scrollTop = historyEl.scrollHeight;

      // Persiste na sessão atual
      const newHistory = [...currentHistory, { role: 'user', content: query }, { role: 'assistant', content: finalAnswer }];
      const slicedHistory = newHistory.length > 10 ? newHistory.slice(-10) : newHistory;
      const isFirstMsg = currentHistory.length === 0;
      const newTitle = isFirstMsg ? generateTitle(query) : null;
      updateSessionData(getCurrentId(), slicedHistory, historyEl.innerHTML, newTitle);
      if (newTitle) renderSessionList();

    } catch (e) {
      console.error('Copilot Error:', e);
      document.getElementById('content-' + typingId).innerHTML = `<span style="color:var(--danger);font-size:0.9rem;">Erro: ${e.message}</span>`;
    } finally {
      chatBtn.disabled = false;
      chatBtn.innerHTML = '<i class="ph ph-paper-plane-right"></i>';
    }
  });
}
