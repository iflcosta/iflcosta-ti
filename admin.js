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

    // Buscar Estatísticas em Tempo Real
    const { data: leadsCount } = await iccClient.from('leads').select('*', { count: 'exact' }).eq('status', 'Novo');
    const { data: repairsCount } = await iccClient.from('repairs').select('*', { count: 'exact' }).neq('status', 'Entregue');

    document.getElementById('stat-leads').innerText = leadsCount ? leadsCount.length : 0;
    document.getElementById('stat-repairs').innerText = repairsCount ? repairsCount.length : 0;

    // Atualizar Feed de Atividade
    fetchRecentActivity();
}

async function fetchRecentActivity() {
    const feed = document.getElementById('activity-feed');
    const { data: leads } = await iccClient.from('leads').select('*').order('created_at', { ascending: false }).limit(5);

    if (leads && leads.length > 0) {
        feed.innerHTML = leads.map(l => `
            <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="display:block;">${l.name}</strong>
                    <span style="font-size: 0.8rem; color: var(--text-dim);">${l.service_category}</span>
                </div>
                <span style="color: var(--purple-vibrant); font-size: 0.75rem; background: rgba(177,74,255,0.1); padding: 4px 8px; border-radius: 4px;">Novo Lead</span>
            </div>
        `).join('');
    } else {
        feed.innerHTML = '<p>Nenhuma atividade recente.</p>';
    }
}
