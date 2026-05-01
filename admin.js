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

// Navegação
function showPage(pageId) {
  const pages = ['dashboard', 'leads', 'customers', 'repairs', 'inventory', 'wiki', 'settings'];
  pages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = 'none';
  });
  document.getElementById('page-' + pageId).style.display = 'block';
  document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // Carrega dados ao navegar para a página
  if (pageId === 'customers') fetchCustomers(0);
  if (pageId === 'leads')     fetchLeads(document.getElementById('lead-filter')?.value || 'Novo', 0);
  if (pageId === 'repairs')   fetchRepairs(0);
  if (pageId === 'inventory') fetchProducts(0);
}

// Dashboard
async function initDashboard() {
  if (!iccClient) return;
  
  // Pre-load da Inteligência Artificial em background (PWA Performance)
  getEmbedder().then(() => console.log('Copilot AI Brain: Carregado na memória e pronto para uso instantâneo.')).catch(e => console.error('Erro pre-load IA:', e));

  fetchLeads();
  fetchRepairs();
  fetchProducts();

  const { data: leadsCount } = await iccClient
    .from('leads').select('*', { count: 'exact' }).eq('status', 'Novo');
  const { data: repairsCount } = await iccClient
    .from('repairs').select('*', { count: 'exact' }).neq('status', 'Entregue');

  document.getElementById('stat-leads').innerText = leadsCount ? leadsCount.length : 0;
  document.getElementById('stat-repairs').innerText = repairsCount ? repairsCount.length : 0;

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthStr = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

  const { data: deliveredRepairs } = await iccClient
    .from('repairs').select('price_total, exit_date').eq('status', 'Entregue');

  let currentRevenue = 0;
  let lastRevenue = 0;
  let currentCost = 0;

  if (deliveredRepairs) {
    deliveredRepairs.forEach(r => {
      if (!r.exit_date) return;
      const val = parseFloat(r.price_total) || 0;
      const cost = parseFloat(r.part_cost) || 0;
      if (r.exit_date.startsWith(currentMonthStr)) {
        currentRevenue += val;
        currentCost += cost;
      } else if (r.exit_date.startsWith(lastMonthStr)) {
        lastRevenue += val;
      }
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
    trendEl.innerHTML = currentRevenue > 0
      ? `<i class="ph ph-trend-up"></i> +100% vs mês anterior`
      : `Sem dados do mês anterior`;
    trendEl.style.color = currentRevenue > 0 ? 'var(--success)' : 'var(--text-dim)';
  } else {
    const diff = ((currentRevenue - lastRevenue) / lastRevenue) * 100;
    trendEl.innerHTML = diff >= 0
      ? `<i class="ph ph-trend-up"></i> +${diff.toFixed(1)}% vs mês anterior`
      : `<i class="ph ph-trend-down"></i> ${diff.toFixed(1)}% vs mês anterior`;
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

async function fetchRepairs(page = 0) {
  repairsPage = page;
  const tableBody = document.getElementById('repairs-table-body');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando reparos...</td></tr>';

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: repairs, error, count } = await iccClient
    .from('repairs').select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ef4444;">Erro ao carregar dados.</td></tr>';
    return;
  }

  if (!repairs || repairs.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma O.S. encontrada.</td></tr>';
    renderPagination('repairs-pagination', page, count, fetchRepairs);
    return;
  }

  tableBody.innerHTML = repairs.map(r => {
    const profit = (r.price || 0) - (r.part_cost || 0);
    return `
      <tr>
        <td>#${r.id.slice(0, 5)}</td>
        <td>
          <div style="font-weight:600;">${escapeHtml(r.device_model)}</div>
          <div style="font-size:0.8rem; color:var(--text-dim);">${escapeHtml(r.description || 'Sem descrição')}</div>
        </td>
        <td><span class="badge badge-status-${r.status.toLowerCase().replace(' ', '-')}">${r.status}</span></td>
        <td>R$ ${r.price.toLocaleString('pt-BR')}</td>
        <td style="color:#22c55e;">R$ ${profit.toLocaleString('pt-BR')}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="Editar Status" onclick="updateOSStatus('${r.id}')"><i class="ph ph-note-pencil"></i></button>
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
      price: parseFloat(document.getElementById('os-price').value),
      part_cost: parseFloat(document.getElementById('os-cost').value),
      description: document.getElementById('os-notes').value,
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

async function updateOSStatus(id) {
  const newStatus = prompt('Digite o novo status (Em Análise, Aguardando Peça, Pronto, Entregue):');
  if (!newStatus) return;
  const payload = { status: newStatus };
  if (newStatus === 'Entregue') payload.exit_date = new Date().toISOString().split('T')[0];
  const { error } = await iccClient.from('repairs').update(payload).eq('id', id);
  if (!error) fetchRepairs(repairsPage);
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

// Variável global para manter a memória da conversa atual (Multi-turn chat)
let chatConversationHistory = [];

const chatForm = document.getElementById('chat-form');
if (chatForm) {
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const query = input.value.trim();
    if (!query) return;

    const history = document.getElementById('chat-history');
    history.innerHTML += `
      <div style="margin-bottom:1.5rem; text-align:right;">
        <strong style="color:var(--text-main);">Você:</strong>
        <p style="color:var(--text-dim);">${escapeHtml(query)}</p>
      </div>
    `;
    input.value = '';

    const typingId = 'typing-' + Date.now();
    history.innerHTML += `
      <div id="${typingId}" style="margin-bottom:1.5rem; background:rgba(177,74,255,0.05); padding:1rem; border-radius:12px; border-left:3px solid var(--purple-vibrant);">
        <strong style="color:var(--purple-vibrant); display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;"><i class="ph ph-robot"></i> Copilot:</strong>
        <p>Analisando sua base vetorial e o estado da sua loja...</p>
      </div>
    `;
    history.scrollTop = history.scrollHeight;

    try {
      // 1. Busca Semântica na Wiki
      const extractor = await getEmbedder();
      const output = await extractor(query, { pooling: 'mean', normalize: true });
      const query_embedding = Array.from(output.data);

      const { data: matches } = await iccClient.rpc('match_wiki_articles', {
        query_embedding,
        match_threshold: 0.3,
        match_count: 3,
      });

      // 2. Coleta de Contexto ao Vivo ("God Mode")
      const { count: leadsCount } = await iccClient.from('leads').select('*', { count: 'exact', head: true }).neq('status', 'Arquivado');
      const { count: repairsCount } = await iccClient.from('repairs').select('*', { count: 'exact', head: true }).neq('status', 'Entregue');

      // 3. Montagem do System Prompt
      let systemPrompt = `Você é o Copilot de TI integrado ao painel de administração (ICC) do Iago Costa. Seu papel é atuar em God Mode: ajude com diagnósticos avançados de hardware/software, mas também entenda o negócio.\n`;
      systemPrompt += `CONTEXTO AO VIVO DA LOJA: No momento, há ${leadsCount || 0} leads em aberto e ${repairsCount || 0} equipamentos na bancada aguardando reparo.\n\n`;

      if (matches && matches.length > 0) {
        const contextText = matches.map(m => `Problema Passado: ${m.title}\nSolução Aplicada: ${m.content}`).join('\n---\n');
        systemPrompt += `ANOTAÇÕES RECUPERADAS DA WIKI:\n${contextText}\n\nSempre tente usar as anotações acima primeiro. Se não resolver, dê sua própria dica sênior. Responda formatando em Markdown (com negritos e tabelas se necessário).`;
      } else {
        systemPrompt += `Nenhuma anotação técnica encontrada na wiki sobre este problema. Responda diretamente baseando-se no seu vasto conhecimento de TI, formatando em Markdown.`;
      }

      const messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...chatConversationHistory,
        { role: 'user', content: query }
      ];

      document.getElementById(typingId).innerHTML = `
        <strong style="color:var(--purple-vibrant); display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;"><i class="ph ph-robot"></i> Copilot:</strong>
        <div class="markdown-body" id="content-${typingId}"></div>
      `;

      // 4. Chamada de Streaming (Efeito Máquina de Escrever)
      const groqRes = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesPayload,
          temperature: 0.5,
          max_tokens: 1000,
          stream: true
        }),
      });

      if (!groqRes.ok) throw new Error(`Erro ${groqRes.status} da Groq`);

      const reader = groqRes.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let finalAnswer = '';
      const contentBox = document.getElementById('content-' + typingId);

      // Função segura de parse Markdown (usando marked.js se disponível)
      const renderMarkdown = (text) => {
        return window.marked ? window.marked.parse(text) : escapeHtml(text).replace(/\n/g, '<br>');
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        const lines = chunkText.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const token = parsed.choices[0]?.delta?.content || '';
              finalAnswer += token;
              contentBox.innerHTML = renderMarkdown(finalAnswer);
              history.scrollTop = history.scrollHeight;
            } catch (e) { /* Ignore incomplete JSON chunks */ }
          }
        }
      }

      // 5. Salvar na Memória e Exibir Botões de Feedback
      chatConversationHistory.push({ role: 'user', content: query });
      chatConversationHistory.push({ role: 'assistant', content: finalAnswer });
      // Mantém apenas o histórico recente para economizar tokens
      if (chatConversationHistory.length > 10) chatConversationHistory = chatConversationHistory.slice(-10);

      const matchedIds = matches ? matches.map(m => m.id) : [];
      const encodedIds = encodeURIComponent(JSON.stringify(matchedIds));
      const encodedQuery = encodeURIComponent(query);
      const encodedAnswer = encodeURIComponent(finalAnswer.substring(0, 500));
      const btnId = 'btn-up-' + Date.now();

      let prefixHTML = (matches && matches.length > 0)
        ? `<span class="badge" style="margin-bottom:1rem; display:inline-block; background:rgba(177,74,255,0.2); color:white; border:none;"><i class="ph ph-books"></i> Usei ${matches.length} anotação(ões) do seu histórico!</span><br>`
        : '';

      const feedbackBtns = `
        <div style="margin-top:1rem; display:flex; gap:0.5rem; align-items:center; border-top:1px solid var(--glass-border); padding-top:0.5rem;">
          <span style="font-size:0.8rem; color:var(--text-dim);">A resposta foi útil?</span>
          <button id="${btnId}" onclick="feedbackUp('${btnId}','${encodedIds}','${encodedQuery}','${encodedAnswer}')" style="background:rgba(16,185,129,0.1); color:var(--success); border:none; padding:0.3rem 0.6rem; border-radius:4px; cursor:pointer;"><i class="ph ph-thumbs-up"></i> Resolveu</button>
          <button onclick="feedbackDown('${encodedQuery}')" style="background:rgba(239,68,68,0.1); color:var(--danger); border:none; padding:0.3rem 0.6rem; border-radius:4px; cursor:pointer;"><i class="ph ph-thumbs-down"></i> Não Resolveu</button>
        </div>
      `;

      contentBox.innerHTML = prefixHTML + renderMarkdown(finalAnswer) + feedbackBtns;
      history.scrollTop = history.scrollHeight;
