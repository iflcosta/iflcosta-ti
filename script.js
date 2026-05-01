const { supabaseUrl, supabaseKey, waPhone } = ICC_CONFIG;

const RATE_LIMIT_KEY = 'icc_last_submit';
const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutos entre envios

const iccLeadClient = typeof supabase !== 'undefined'
  ? supabase.createClient(supabaseUrl, supabaseKey)
  : null;

const CALC_DATA = {
  smartphone: [
    { id: 'tela',      label: 'Troca de Tela (Android/iPhone)', min: 120, max: 180, note: '+ peça' },
    { id: 'bateria',   label: 'Troca de Bateria',               min: 80,  max: 120, note: '+ peça' },
    { id: 'conector',  label: 'Conector de Carga',              min: 100, max: 150, note: '+ peça' },
  ],
  notebook: [
    { id: 'formatacao', label: 'Formatação Premium (c/ Backup)',   min: 150, max: 200 },
    { id: 'limpeza',    label: 'Limpeza + Pasta Térmica',          min: 150, max: 250 },
    { id: 'upgrade',    label: 'Upgrade SSD/RAM (Mão de Obra)',    min: 80,  max: 120 },
    { id: 'visita',     label: 'Visita Técnica / Diagnóstico',     min: 80,  max: 120 },
    { id: 'rede',       label: 'Configuração de Rede Wi-Fi',       min: 120, max: 180 },
  ],
  'custom-pc': [
    { id: 'basico', label: 'Montagem PC Office/Básico',           min: 150, max: 200 },
    { id: 'gamer',  label: 'Montagem PC Gamer/Alta Performance',  min: 300, max: 450 },
    { id: 'hora',   label: 'Hora Técnica (Empresas)',             min: 150, max: 150, note: '/hora' },
  ],
};

let calcState = { cat: 'smartphone', selected: new Set() };

function initCalculator() {
  const catBtns = document.querySelectorAll('.calc-cat-btn');
  if (!catBtns.length) return;

  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calcState.cat = btn.dataset.cat;
      calcState.selected = new Set();
      renderCalcServices();
      updateCalcResult();
    });
  });

  renderCalcServices();
  updateCalcResult();
}

function renderCalcServices() {
  const container = document.getElementById('calc-services');
  if (!container) return;
  const services = CALC_DATA[calcState.cat] || [];

  container.innerHTML = services.map(s => `
    <div class="calc-service-item${calcState.selected.has(s.id) ? ' selected' : ''}" data-id="${s.id}">
      <div class="calc-checkbox">${calcState.selected.has(s.id) ? '✓' : ''}</div>
      <span class="calc-service-label">${s.label}</span>
      <div class="calc-service-price">
        R$ ${s.min}${s.min !== s.max ? ' – ' + s.max : ''}
        ${s.note ? `<span class="calc-service-note">${s.note}</span>` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.calc-service-item').forEach(el => {
    el.addEventListener('click', () => toggleCalcService(el.dataset.id));
  });
}

function toggleCalcService(id) {
  if (calcState.selected.has(id)) {
    calcState.selected.delete(id);
  } else {
    calcState.selected.add(id);
  }
  renderCalcServices();
  updateCalcResult();
}

function updateCalcResult() {
  const resultEl = document.getElementById('calc-result-value');
  const waBtn = document.getElementById('calc-wa-btn');
  if (!resultEl) return;

  const services = CALC_DATA[calcState.cat] || [];
  const chosen = services.filter(s => calcState.selected.has(s.id));

  if (!chosen.length) {
    resultEl.textContent = 'Selecione um serviço';
    resultEl.classList.remove('has-value');
    if (waBtn) waBtn.style.display = 'none';
    return;
  }

  const totalMin = chosen.reduce((acc, s) => acc + s.min, 0);
  const totalMax = chosen.reduce((acc, s) => acc + s.max, 0);
  const rangeText = totalMin === totalMax ? `R$ ${totalMin}` : `R$ ${totalMin} – ${totalMax}`;

  resultEl.textContent = rangeText;
  resultEl.classList.add('has-value');

  if (waBtn) {
    const labels = chosen.map(s => s.label).join(', ');
    const msg = encodeURIComponent(`Olá, Iago! Quero um orçamento para: ${labels}. Estimativa: ${rangeText}.`);
    waBtn.href = `https://wa.me/${waPhone}?text=${msg}`;
    waBtn.style.display = 'inline-flex';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Atualiza todos os links do WhatsApp usando o número central do config.js
  document.querySelectorAll('a[href*="wa.me/"]').forEach(link => {
    link.href = link.href.replace(/wa\.me\/\d+/, 'wa.me/' + waPhone);
  });

  // Atualiza o texto visual do WhatsApp
  document.querySelectorAll('.wa-text').forEach(el => {
    const formattedPhone = `(${waPhone.substring(2,4)}) ${waPhone.substring(4,9)}-${waPhone.substring(9)}`;
    el.innerHTML = el.innerHTML.replace(/\(\d{2}\)\s\d{4,5}-\d{4}/, formattedPhone);
  });

  // Mobile Menu Toggle
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navMenu = document.querySelector('.nav-menu');

  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const icon = menuBtn.querySelector('i');
      icon.classList.toggle('ph-list');
      icon.classList.toggle('ph-x');
    });
  }

  // Smooth Scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      navMenu.classList.remove('active');
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Budget Calculator
  initCalculator();

  // Máscara de telefone
  const phoneInput = document.getElementById('whatsapp');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
      e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    });
  }

  // Formulário de Orçamento
  const budgetForm = document.getElementById('budget-form');
  const formSuccess = document.getElementById('form-success');
  const submitBtn = document.getElementById('submit-btn');

  if (budgetForm && iccLeadClient) {
    budgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFormError();

      // Rate limiting client-side
      const lastSubmit = localStorage.getItem(RATE_LIMIT_KEY);
      if (lastSubmit && Date.now() - parseInt(lastSubmit) < RATE_LIMIT_MS) {
        showFormError('Você já enviou uma solicitação recentemente. Aguarde alguns minutos ou entre em contato pelo WhatsApp.');
        return;
      }

      const formData = new FormData(budgetForm);
      const data = Object.fromEntries(formData.entries());
      const submitBtnText = submitBtn.querySelector('.btn-text');
      const originalText = submitBtnText.textContent;

      submitBtn.disabled = true;
      submitBtnText.textContent = 'Enviando...';

      try {
        // Normaliza o telefone para dígitos apenas (consistência no banco)
        const cleanPhone = data.whatsapp.replace(/\D/g, '');

        // Verificação de duplicata pelo número normalizado
        const { data: existing } = await iccLeadClient
          .from('leads')
          .select('id')
          .eq('whatsapp', cleanPhone)
          .neq('status', 'Arquivado')
          .limit(1);

        if (existing && existing.length > 0) {
          showFormError('Já recebemos seu contato! Em breve retornaremos via WhatsApp.');
          submitBtn.disabled = false;
          submitBtnText.textContent = originalText;
          return;
        }

        const { error } = await iccLeadClient.from('leads').insert([{
          name: data.name,
          whatsapp: cleanPhone,
          service_category: data.service,
          message: data.message,
          urgency: data.urgency,
          client_type: data.client_type,
        }]);

        if (error) throw error;

        localStorage.setItem(RATE_LIMIT_KEY, Date.now().toString());
        budgetForm.style.display = 'none';
        formSuccess.style.display = 'block';
        budgetForm.reset();

      } catch (err) {
        console.error('Erro no Supabase:', err);
        showFormError('Ocorreu um erro ao enviar sua solicitação. Por favor, tente novamente ou use o WhatsApp direto.');
        submitBtn.disabled = false;
        submitBtnText.textContent = originalText;
      }
    });
  }

  // IntersectionObserver for scroll animations
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-on-scroll').forEach((el) => {
    observer.observe(el);
  });
});

function showFormError(message) {
  let errorEl = document.getElementById('form-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'form-error';
    errorEl.setAttribute('role', 'alert');
    errorEl.setAttribute('aria-live', 'assertive');
    errorEl.style.cssText = 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:0.8rem 1rem;border-radius:10px;margin-bottom:1rem;font-size:0.9rem;';
    const form = document.getElementById('budget-form');
    form.insertBefore(errorEl, form.firstChild);
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function clearFormError() {
  const errorEl = document.getElementById('form-error');
  if (errorEl) errorEl.style.display = 'none';
}

function resetForm() {
  const budgetForm = document.getElementById('budget-form');
  const formSuccess = document.getElementById('form-success');
  if (budgetForm && formSuccess) {
    budgetForm.style.display = 'block';
    formSuccess.style.display = 'none';
    clearFormError();
  }
}
