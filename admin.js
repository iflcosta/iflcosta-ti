// ICC v2.0 - Iago Command Center JS Core

// 🔑 CONFIGURAÇÃO SUPABASE (Sincronizado via MCP)
const SUPABASE_URL = 'https://pfodcrnisntawxqsywld.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Vip8SjvB27zSCuDI_MVXKg_Iy2tB0DW';

let iccClient = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (SUPABASE_URL !== 'SUA_URL_DO_SUPABASE') {
        iccClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        checkSession();
    } else {
        console.warn('Aguardando chaves do Supabase para conectar...');
    }
});

// Autenticação Real via Supabase
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

    const { data, error } = await iccClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

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

// Navegação entre Páginas
function showPage(pageId) {
    // Esconder todas
    const pages = ['dashboard', 'leads', 'repairs', 'inventory', 'imports', 'wiki'];
    pages.forEach(p => {
        const el = document.getElementById('page-' + p);
        if (el) el.style.display = 'none';
    });

    // Mostrar a selecionada
    document.getElementById('page-' + pageId).style.display = 'block';

    // Atualizar menu ativo
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// Lógica do Dashboard
async function initDashboard() {
    if (!iccClient) return;
    fetchLeads(); // Carregar leads inicialmente
    
    // Buscar Estatísticas em Tempo Real
    const { data: leadsCount } = await iccClient.from('leads').select('*', { count: 'exact' }).eq('status', 'Novo');
    const { data: repairsCount } = await iccClient.from('repairs').select('*', { count: 'exact' }).neq('status', 'Entregue');

    document.getElementById('stat-leads').innerText = leadsCount ? leadsCount.length : 0;
    document.getElementById('stat-repairs').innerText = repairsCount ? repairsCount.length : 0;

    // Atualizar Feed de Atividade
    fetchRecentActivity();
}

async function fetchLeads(filter = 'Novo') {
    const tableBody = document.getElementById('leads-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando...</td></tr>';

    let query = iccClient.from('leads').select('*').order('created_at', { ascending: false });
    
    if (filter === 'Novo') {
        query = query.neq('status', 'Arquivado');
    } else {
        query = query.eq('status', 'Arquivado');
    }

    const { data: leads, error } = await query;

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #ef4444;">Erro ao carregar dados.</td></tr>';
        return;
    }

    if (leads.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum lead encontrado.</td></tr>';
        return;
    }

    tableBody.innerHTML = leads.map(l => `
        <tr>
            <td>${new Date(l.created_at).toLocaleDateString('pt-BR')}</td>
            <td>
                <div style="font-weight:600;">${l.name}</div>
                <div style="font-size:0.8rem; color:var(--text-dim);">${l.client_type || 'Pessoa Física'}</div>
            </td>
            <td>${l.service_category}</td>
            <td><span class="badge badge-urgency-${(l.urgency || 'media').toLowerCase()}">${l.urgency || 'Média'}</span></td>
            <td>${l.status}</td>
            <td>
                <div class="action-btns">
                    <a href="https://wa.me/55${l.whatsapp.replace(/\D/g,'')}?text=Olá%20${l.name},%20aqui%20é%20o%20Iago%20da%20Iago%20Costa%20TI.%20Recebi%20seu%20contato!" target="_blank" class="btn-icon wa" title="Chamar no WhatsApp"><i class="ph ph-whatsapp-logo"></i></a>
                    <button class="btn-icon" onclick="convertToCustomer('${l.id}')" title="Converter em Cliente"><i class="ph ph-user-plus"></i></button>
                    <button class="btn-icon archive" onclick="archiveLead('${l.id}')" title="Arquivar"><i class="ph ph-archive"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function archiveLead(id) {
    if (!confirm('Deseja arquivar este lead?')) return;
    const { error } = await iccClient.from('leads').update({ status: 'Arquivado' }).eq('id', id);
    if (!error) fetchLeads();
}

async function convertToCustomer(id) {
    alert('Funcionalidade de conversão será implementada no Módulo de Clientes.');
}

async function fetchRecentActivity() {
    const feed = document.getElementById('activity-feed');
    if (!feed) return;

    const { data: leads, error } = await iccClient
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        feed.innerHTML = '<p style="padding:1rem;">Erro ao carregar atividades.</p>';
        return;
    }

    if (leads && leads.length > 0) {
        feed.innerHTML = leads.map(l => `
            <div class="activity-item">
                <div class="activity-icon"><i class="ph ph-user-plus"></i></div>
                <div class="activity-info">
                    <p><strong>Novo Lead:</strong> ${l.name} solicitou orçamento para ${l.service_category}</p>
                    <span style="font-size: 0.7rem; color: var(--text-dim);">${new Date(l.created_at).toLocaleTimeString('pt-BR')}</span>
                </div>
            </div>
        `).join('');
    } else {
        feed.innerHTML = '<p style="padding:1rem;">Nenhuma atividade recente.</p>';
    }
}
