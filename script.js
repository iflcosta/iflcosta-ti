document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.getElementById('nav-menu');

    mobileMenuBtn.addEventListener('click', () => {
        const isActive = navMenu.classList.toggle('active');
        mobileMenuBtn.setAttribute('aria-expanded', isActive);
        const icon = mobileMenuBtn.querySelector('i');
        if (isActive) {
            icon.classList.replace('ph-list', 'ph-x');
        } else {
            icon.classList.replace('ph-x', 'ph-list');
        }
    });

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            const icon = mobileMenuBtn.querySelector('i');
            icon.classList.replace('ph-x', 'ph-list');
        });
    });

    // Header Scroll Effect
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });

    // Scroll Animation (Fade Up)
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                obs.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Apply fade-up to sections and cards (including new sections)
    const elementsToAnimate = document.querySelectorAll(
        '.section-header, .feature-card, .service-card, .step, .pricing-card, .trust-card, .quote-info, .quote-form-container'
    );
    elementsToAnimate.forEach(el => {
        el.classList.add('fade-up');
        observer.observe(el);
    });

    // WhatsApp Mask
    const whatsappInput = document.getElementById('whatsapp');
    if (whatsappInput) {
        whatsappInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, "");
            if (value.length > 11) value = value.slice(0, 11);
            
            if (value.length > 10) {
                value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
            } else if (value.length > 6) {
                value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
            } else if (value.length > 2) {
                value = value.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
            } else {
                value = value.replace(/^(\d*)/, "($1");
            }
            e.target.value = value;
        });
    }

    // Form Submission Handling
    const budgetForm = document.getElementById('budget-form');
    const formSuccess = document.getElementById('form-success');
    const submitBtn = document.getElementById('submit-btn');

    if (budgetForm) {
        budgetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(budgetForm);
            const submitBtnText = submitBtn.querySelector('.btn-text');
            const originalText = submitBtnText.textContent;
            
            // UI Loading State
            submitBtn.disabled = true;
            submitBtnText.textContent = 'Enviando...';

            try {
                const response = await fetch(budgetForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    budgetForm.style.display = 'none';
                    formSuccess.style.display = 'block';
                    budgetForm.reset();
                } else {
                    throw new Error('Erro ao enviar');
                }
            } catch (error) {
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

