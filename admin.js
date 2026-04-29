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
    const pages = ['dashboard', 'leads', 'repairs', 'inventory', 'wiki', 'settings'];
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
    fetchRepairs(); // Carregar reparos inicialmente
    fetchProducts(); // Carregar estoque inicialmente

    // Carregar chave Groq se existir
    const savedKey = localStorage.getItem('icc_groq_key');
    const keyInput = document.getElementById('groq-api-key');
    if (savedKey && keyInput) keyInput.value = savedKey;
    
    // Buscar Estatísticas em Tempo Real
    const { data: leadsCount } = await iccClient.from('leads').select('*', { count: 'exact' }).eq('status', 'Novo');
    const { data: repairsCount } = await iccClient.from('repairs').select('*', { count: 'exact' }).neq('status', 'Entregue');

    document.getElementById('stat-leads').innerText = leadsCount ? leadsCount.length : 0;
    document.getElementById('stat-repairs').innerText = repairsCount ? repairsCount.length : 0;

    // Faturamento Mensal Inteligente
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonthStr = now.getMonth() === 0 
        ? `${now.getFullYear() - 1}-12` 
        : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    const { data: deliveredRepairs } = await iccClient.from('repairs').select('price_total, exit_date').eq('status', 'Entregue');
    
    let currentRevenue = 0;
    let lastRevenue = 0;

    if (deliveredRepairs) {
        deliveredRepairs.forEach(r => {
            if (!r.exit_date) return;
            const val = parseFloat(r.price_total) || 0;
            if (r.exit_date.startsWith(currentMonthStr)) {
                currentRevenue += val;
            } else if (r.exit_date.startsWith(lastMonthStr)) {
                lastRevenue += val;
            }
        });
    }

    document.getElementById('stat-revenue').innerText = currentRevenue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    
    const trendEl = document.getElementById('stat-revenue-trend');
    if (lastRevenue === 0) {
        if (currentRevenue > 0) {
            trendEl.innerHTML = `<i class="ph ph-trend-up"></i> +100% vs mês anterior`;
            trendEl.style.color = 'var(--success)';
            trendEl.style.background = 'rgba(16, 185, 129, 0.1)';
        } else {
            trendEl.innerHTML = `Sem dados do mês anterior`;
            trendEl.style.color = 'var(--text-dim)';
            trendEl.style.background = 'rgba(255, 255, 255, 0.05)';
        }
    } else {
        const diff = ((currentRevenue - lastRevenue) / lastRevenue) * 100;
        if (diff >= 0) {
            trendEl.innerHTML = `<i class="ph ph-trend-up"></i> +${diff.toFixed(1)}% vs mês anterior`;
            trendEl.style.color = 'var(--success)';
            trendEl.style.background = 'rgba(16, 185, 129, 0.1)';
        } else {
            trendEl.innerHTML = `<i class="ph ph-trend-down"></i> ${diff.toFixed(1)}% vs mês anterior`;
            trendEl.style.color = 'var(--danger)';
            trendEl.style.background = 'rgba(239, 68, 68, 0.1)';
        }
    }

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

// Módulo de Reparos (O.S.)
function openOSModal() {
    document.getElementById('os-modal').style.display = 'flex';
}

function closeOSModal() {
    document.getElementById('os-modal').style.display = 'none';
}

async function fetchRepairs() {
    const tableBody = document.getElementById('repairs-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando reparos...</td></tr>';

    const { data: repairs, error } = await iccClient
        .from('repairs')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #ef4444;">Erro ao carregar dados.</td></tr>';
        return;
    }

    if (repairs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhuma O.S. encontrada.</td></tr>';
        return;
    }

    tableBody.innerHTML = repairs.map(r => {
        const profit = (r.price || 0) - (r.part_cost || 0);
        return `
            <tr>
                <td>#${r.id.slice(0,5)}</td>
                <td>
                    <div style="font-weight:600;">${r.device_model}</div>
                    <div style="font-size:0.8rem; color:var(--text-dim);">${r.description || 'Sem descrição'}</div>
                </td>
                <td><span class="badge badge-status-${r.status.toLowerCase().replace(' ', '-')}">${r.status}</span></td>
                <td>R$ ${r.price.toLocaleString('pt-BR')}</td>
                <td style="color: #22c55e;">R$ ${profit.toLocaleString('pt-BR')}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-icon" title="Editar Status" onclick="updateOSStatus('${r.id}')"><i class="ph ph-note-pencil"></i></button>
                        <button class="btn-icon archive" title="Excluir" onclick="deleteOS('${r.id}')"><i class="ph ph-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Handler do Formulário de O.S.
const osForm = document.getElementById('os-form');
if (osForm) {
    osForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            device_model: document.getElementById('os-model').value,
            price: parseFloat(document.getElementById('os-price').value),
            part_cost: parseFloat(document.getElementById('os-cost').value),
            description: document.getElementById('os-notes').value,
            status: 'Em Análise'
        };

        const { error } = await iccClient.from('repairs').insert([payload]);

        if (error) {
            alert('Erro ao criar O.S.: ' + error.message);
        } else {
            closeOSModal();
            osForm.reset();
            fetchRepairs();
            alert('Ordem de Serviço criada com sucesso!');
        }
    });
}

async function updateOSStatus(id) {
    const newStatus = prompt('Digite o novo status (Em Análise, Aguardando Peça, Pronto, Entregue):');
    if (!newStatus) return;
    
    const { error } = await iccClient.from('repairs').update({ status: newStatus }).eq('id', id);
    if (!error) fetchRepairs();
}

// Módulo de Inventário (Estoque)
function openProductModal() {
    document.getElementById('product-modal').style.display = 'flex';
}

function closeProductModal() {
    document.getElementById('product-modal').style.display = 'none';
}

async function fetchProducts() {
    const tableBody = document.getElementById('inventory-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando estoque...</td></tr>';

    const { data: products, error } = await iccClient
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: #ef4444;">Erro ao carregar dados.</td></tr>';
        return;
    }

    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum produto em estoque.</td></tr>';
        return;
    }

    tableBody.innerHTML = products.map(p => {
        const stockClass = p.stock_quantity <= 2 ? 'color: #ef4444; font-weight: 800;' : '';
        return `
            <tr>
                <td>
                    <div style="font-weight:600;">${p.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-dim);">${p.description || ''}</div>
                </td>
                <td><span class="badge">${p.category}</span></td>
                <td><span style="${stockClass}">${p.stock_quantity} un</span></td>
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
}

// Handler do Formulário de Produto
const productForm = document.getElementById('product-form');
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            name: document.getElementById('prod-name').value,
            category: document.getElementById('prod-category').value,
            stock_quantity: parseInt(document.getElementById('prod-stock').value),
            cost_price: parseFloat(document.getElementById('prod-cost').value),
            price: parseFloat(document.getElementById('prod-price').value),
            is_active: true
        };

        const { error } = await iccClient.from('products').insert([payload]);

        if (error) {
            alert('Erro ao salvar produto: ' + error.message);
        } else {
            closeProductModal();
            productForm.reset();
            fetchProducts();
            alert('Produto cadastrado com sucesso!');
        }
    });
}

async function deleteProduct(id) {
    if (!confirm('Deseja remover este produto do estoque ativo?')) return;
    const { error } = await iccClient.from('products').update({ is_active: false }).eq('id', id);
    if (!error) fetchProducts();
}

async function editProduct(id) {
    alert('Edição rápida de produto será implementada na próxima versão.');
}

// ==========================================
// Módulo de Configurações
// ==========================================
function saveSettings() {
    const key = document.getElementById('groq-api-key').value;
    localStorage.setItem('icc_groq_key', key);
    alert('Configurações salvas no seu navegador!');
}

// ==========================================
// Módulo Wiki IA Copilot
// ==========================================
let embedder = null;

async function getEmbedder() {
    if (!embedder) {
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0');
        // Configura para não buscar o modelo no seu próprio site (causava o 404)
        env.allowLocalModels = false;
        env.useBrowserCache = true; // Salva o modelo no navegador para os próximos acessos serem rápidos
        
        embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return embedder;
}


function openWikiModal() {
    document.getElementById('wiki-modal').style.display = 'flex';
}

function closeWikiModal() {
    document.getElementById('wiki-modal').style.display = 'none';
}

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

            const { error } = await iccClient.from('wiki').insert([{
                title,
                category,
                content,
                embedding
            }]);

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

const chatForm = document.getElementById('chat-form');
if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const query = input.value;
        if (!query) return;

        const history = document.getElementById('chat-history');
        
        history.innerHTML += `
            <div style="margin-bottom: 1.5rem; text-align: right;">
                <strong style="color: var(--text-main);">Você:</strong>
                <p style="color: var(--text-dim);">${query}</p>
            </div>
        `;
        input.value = '';

        const typingId = 'typing-' + Date.now();
        history.innerHTML += `
            <div id="${typingId}" style="margin-bottom: 1.5rem; background: rgba(177, 74, 255, 0.05); padding: 1rem; border-radius: 12px; border-left: 3px solid var(--purple-vibrant);">
                <strong style="color: var(--purple-vibrant); display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;"><i class="ph ph-robot"></i> Copilot:</strong>
                <p>Analisando sua base de conhecimento vetorial...</p>
            </div>
        `;
        history.scrollTop = history.scrollHeight;

        try {
            const extractor = await getEmbedder();
            const output = await extractor(query, { pooling: 'mean', normalize: true });
            const query_embedding = Array.from(output.data);

            const { data: matches, error } = await iccClient.rpc('match_wiki_articles', {
                query_embedding: query_embedding,
                match_threshold: 0.3,
                match_count: 3
            });

            if (error) throw error;

            let responseHTML = '';
            const apiKey = localStorage.getItem('icc_groq_key');

            // Se não tem chave API, mostra só as anotações cruas
            if (!apiKey) {
                if (!matches || matches.length === 0) {
                    responseHTML = `<p>Ainda não encontrei nenhuma solução parecida no seu histórico para esse caso específico. Deseja criar um novo registro após consertar?</p><p style="margin-top:1rem; font-size:0.85rem; color: var(--warning);"><em>Adicione sua chave Groq nas Configurações para eu tentar ajudar usando inteligência artificial externa!</em></p>`;
                } else {
                    responseHTML = `<p>Achei algumas anotações que podem te ajudar!</p><div style="margin-top: 1rem; display:flex; flex-direction:column; gap:0.5rem;">`;
                    matches.forEach(m => {
                        responseHTML += `
                        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; border: 1px solid var(--glass-border);">
                            <strong style="color: white; display:block; margin-bottom:0.3rem;">🎯 ${m.title} <span style="opacity:0.5; font-size:0.8rem; font-weight:normal;">(Similaridade: ${Math.round(m.similarity * 100)}%)</span></strong>
                            <p style="font-size:0.9rem; color: var(--text-dim);">${m.content}</p>
                        </div>`;
                    });
                    responseHTML += `</div><p style="margin-top:1rem; font-size:0.85rem; color: var(--warning);"><em>Para conversar comigo sobre isso, adicione sua chave Groq na aba Configurações.</em></p>`;
                }
            } else {
                // TEM CHAVE API: Chama a IA da Groq
                document.getElementById(typingId).innerHTML = `
                    <strong style="color: var(--purple-vibrant); display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;"><i class="ph ph-robot"></i> Copilot:</strong>
                    <p>Processando resposta com Llama 3...</p>
                `;

                let systemPrompt = "";
                if (matches && matches.length > 0) {
                    const contextText = matches.map(m => `Problema: ${m.title}\nSolução que eu dei: ${m.content}`).join('\n---\n');
                    systemPrompt = `Você é um assistente técnico de TI integrado ao painel do Iago. O Iago fez uma pergunta. Use as anotações passadas dele abaixo como base principal para responder. Se a anotação não resolver, dê sua própria dica técnica avançada.\n\nAnotações Recuperadas do Iago:\n${contextText}`;
                } else {
                    systemPrompt = `Você é um assistente técnico de TI integrado ao painel do Iago. O Iago fez uma pergunta sobre a qual ele ainda não tem anotações no banco de dados. Responda diretamente e tecnicamente para ajudá-lo a resolver o problema de TI.`;
                }
                
                const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: "llama-3.3-70b-versatile",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: query }
                        ],
                        temperature: 0.5,
                        max_tokens: 500
                    })
                });

                if (!groqRes.ok) {
                    const errData = await groqRes.json().catch(() => ({}));
                    throw new Error(`Erro da Groq: ${errData.error?.message || groqRes.statusText}. Tem certeza que a chave está correta?`);
                }
                
                const groqData = await groqRes.json();
                const finalAnswer = groqData.choices[0].message.content.replace(/\n/g, '<br>');

                // Se usou contexto, mostra que achou no histórico
                let prefixHTML = (matches && matches.length > 0) 
                    ? `<span class="badge" style="margin-bottom:1rem; display:inline-block; background:rgba(177, 74, 255, 0.2); color:white; border:none;"><i class="ph ph-books"></i> Usei ${matches.length} anotação(ões) do seu histórico!</span><br>`
                    : ``;

                responseHTML = `<div>${prefixHTML}<div style="color: var(--text-main); font-size: 0.95rem; line-height: 1.5;">${finalAnswer}</div></div>`;
            }

            document.getElementById(typingId).innerHTML = `
                <strong style="color: var(--purple-vibrant); display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;"><i class="ph ph-robot"></i> Copilot:</strong>
                ${responseHTML}
            `;
            history.scrollTop = history.scrollHeight;

        } catch (err) {
            console.error(err);
            document.getElementById(typingId).innerHTML = `<p style="color: var(--danger);"><i class="ph ph-warning-circle"></i> ${err.message}</p>`;
        }
    });
}
