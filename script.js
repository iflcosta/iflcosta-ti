const { supabaseUrl, supabaseKey, waPhone } = ICC_CONFIG;

const RATE_LIMIT_KEY = 'icc_last_submit';
const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutos entre envios

const iccLeadClient = typeof supabase !== 'undefined'
  ? supabase.createClient(supabaseUrl, supabaseKey)
  : null;

document.addEventListener('DOMContentLoaded', () => {
  // Atualiza todos os links do WhatsApp usando o número central do config.js
  document.querySelectorAll('a[href*="wa.me/"]').forEach(link => {
    link.href = link.href.replace(/wa\.me\/\d+/, 'wa.me/' + waPhone);
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
});

function showFormError(message) {
  let errorEl = document.getElementById('form-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'form-error';
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
