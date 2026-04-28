// 🔑 CONFIGURAÇÃO SUPABASE (Sincronizado via MCP)
const SUPABASE_URL = 'https://pfodcrnisntawxqsywld.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Vip8SjvB27zSCuDI_MVXKg_Iy2tB0DW';
const iccLeadClient = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

document.addEventListener('DOMContentLoaded', () => {
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

    // Smooth Scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            navMenu.classList.remove('active');
            
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Input Masks (Basic)
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }

    // Budget Form Submission (Direct to Supabase)
    const budgetForm = document.getElementById('budget-form');
    const formSuccess = document.getElementById('form-success');
    const submitBtn = document.getElementById('submit-btn');

    if (budgetForm && iccLeadClient) {
        budgetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(budgetForm);
            const data = Object.fromEntries(formData.entries());
            const submitBtnText = submitBtn.querySelector('.btn-text');
            const originalText = submitBtnText.textContent;
            
            // UI Loading State
            submitBtn.disabled = true;
            submitBtnText.textContent = 'Enviando...';

            try {
                // Inserir lead no Supabase
                const { error } = await iccLeadClient
                    .from('leads')
                    .insert([
                        { 
                            name: data.name, 
                            whatsapp: data.whatsapp, 
                            service_category: data.service, 
                            message: data.message,
                            urgency: data.urgency,
                            client_type: data.client_type
                        }
                    ]);

                if (error) throw error;

                // Sucesso
                budgetForm.style.display = 'none';
                formSuccess.style.display = 'block';
                budgetForm.reset();

            } catch (error) {
                console.error('Erro no Supabase:', error);
                alert('Ocorreu um erro ao enviar sua solicitação. Por favor, tente novamente ou use o WhatsApp direto.');
                submitBtn.disabled = false;
                submitBtnText.textContent = originalText;
            }
        });
    }
});

// Helper for resetting form
function resetForm() {
    const budgetForm = document.getElementById('budget-form');
    const formSuccess = document.getElementById('form-success');
    if (budgetForm && formSuccess) {
        budgetForm.style.display = 'block';
        formSuccess.style.display = 'none';
    }
}
