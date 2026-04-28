// admin.js - Lógica do Painel Administrativo

const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');

// Senha Mestra (Altere isso depois para maior segurança!)
const MASTER_EMAIL = "contato@iflcosta.com.br";
const MASTER_PASS = "admin123";

// Verificar Sessão ao Carregar
window.onload = () => {
    if (localStorage.getItem('iago_admin_session') === 'true') {
        showDashboard();
    }
};

// Login Handling
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    if (email === MASTER_EMAIL && pass === MASTER_PASS) {
        localStorage.setItem('iago_admin_session', 'true');
        showDashboard();
    } else {
        alert('Credenciais incorretas. Tente novamente.');
    }
});

function showDashboard() {
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'block';
    document.body.style.alignItems = 'flex-start';
    fetchLeads();
}

function logout() {
    localStorage.removeItem('iago_admin_session');
    window.location.reload();
}

// Abrir Notion (Links diretos para as views)
function openNotion(type) {
    const links = {
        crm: 'https://www.notion.so/Painel-de-Controle-Iago-Costa-TI-621be39e717f4ae69888bba16695495c', // Substitua pelo link da view do CRM
        wiki: '#',
        docs: '#'
    };
    window.open(links[type], '_blank');
}

// Buscar Leads do Notion via API
async function fetchLeads() {
    const leadsList = document.getElementById('leads-list');
    
    try {
        // Esta rota será criada na próxima etapa no backend
        const response = await fetch('/api/leads');
        const data = await response.json();

        if (data.leads && data.leads.length > 0) {
            leadsList.innerHTML = '';
            data.leads.forEach(lead => {
                const leadEl = document.createElement('div');
                leadEl.style.padding = '0.8rem';
                leadEl.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                leadEl.style.fontSize = '0.9rem';
                leadEl.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${lead.name}</strong>
                        <span style="font-size:0.7rem; color:var(--purple-vibrant); background:rgba(177,74,255,0.1); padding:2px 6px; border-radius:4px;">${lead.status}</span>
                    </div>
                    <div style="color:var(--text-dim); font-size:0.8rem; margin-top:4px;">${lead.date}</div>
                `;
                leadsList.appendChild(leadEl);
            });
        } else {
            leadsList.innerHTML = '<p style="text-align:center; color:var(--text-dim); padding:1rem;">Nenhum lead novo por enquanto.</p>';
        }
    } catch (error) {
        leadsList.innerHTML = '<p style="text-align:center; color:#ef4444; padding:1rem;">Erro ao carregar leads. Verifique a API.</p>';
    }
}
