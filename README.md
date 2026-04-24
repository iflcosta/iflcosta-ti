# iflcosta-ti — Landing Page Profissional

> Site de apresentação de serviços de TI, desenvolvido com foco em **SEO local**, **conversão de clientes** e **design premium** — sem frameworks, sem dependências de build.

🌐 **Live:** [iflcosta-ti.vercel.app](https://iflcosta-ti.vercel.app) · **Deploy:** Vercel (auto-deploy via GitHub)

---

## Visão Geral

Landing page desenvolvida para um especialista autônomo de TI em Bragança Paulista - SP. O objetivo principal é **converter visitantes em leads via WhatsApp**, com foco em ranqueamento local no Google e transmissão de autoridade técnica.

O projeto foi construído do zero com HTML, CSS e JavaScript puros — uma escolha deliberada para máxima performance, zero overhead de bundle e compatibilidade total com qualquer ambiente de hospedagem estática.

---

## Stack & Decisões Técnicas

| Camada | Tecnologia | Motivo da escolha |
|---|---|---|
| Estrutura | HTML5 semântico | SEO nativo, acessibilidade, sem overhead |
| Estilo | CSS3 Vanilla + Custom Properties | Controle total, sem purge/build step |
| Interatividade | JavaScript ES6+ (Vanilla) | Bundle zero, performance máxima |
| Ícones | [Phosphor Icons](https://phosphoricons.com) | Consistência visual, CDN leve |
| Tipografia | Inter (Google Fonts) | Legibilidade em telas, look profissional |
| Deploy | Vercel | CD automático via push no GitHub |

---

## Funcionalidades

- **Design System** baseado em CSS Custom Properties com dark mode, glassmorphism e gradientes coerentes
- **Seção de Preços** transparente com 3 categorias (Mobile, Manutenção & TI, Custom PCs)
- **Seção de Confiança** com 5 pilares, incluindo menção estratégica a infraestrutura laboratorial parceira
- **CTAs contextuais** ao longo da página, todos apontando para WhatsApp com mensagem pré-preenchida
- **Botão flutuante de WhatsApp** com label visível em desktop, recolhido em mobile
- **Animações de entrada** com `IntersectionObserver` (fade-up, sem dependências)
- **Header inteligente** que ganha backdrop-filter ao scroll
- **Menu mobile** com toggle acessível (`aria-expanded`, `aria-controls`)
- **Responsividade** em 3 breakpoints: desktop (1200px+), tablet (1024px) e mobile (768px)

---

## SEO Local

Implementações específicas para ranqueamento em buscas geolocalizadas:

- `<title>` e `<meta description>` com palavras-chave + localidade
- **Schema.org `LocalBusiness`** com `areaServed`, `hasOfferCatalog` e coordenadas geográficas
- `scroll-padding-top` para navegação correta com header fixo
- Tags `og:*` e `twitter:card` para compartilhamento em redes sociais
- `<link rel="canonical">` e metatags de geolocalização (`geo.region`, `geo.placename`)
- `loading="eager"` na imagem hero para LCP otimizado

---

## Estrutura do Projeto

```
iflcosta-ti/
├── index.html          # Estrutura completa da landing page
├── style.css           # Design system + estilos de todos os componentes
├── script.js           # Menu mobile, scroll effects, IntersectionObserver
├── hero-image.webp     # Imagem hero otimizada (WebP)
├── hero-image.png      # Fallback PNG
└── docs/
    ├── plano_de_negocios.md     # Plano estratégico de lançamento
    ├── tabela_de_precos.md      # Precificação e argumentos de venda
    ├── google_ads_copy.md       # Copies para campanhas no Google Ads
    ├── textos_whatsapp.md       # Scripts de atendimento
    ├── guia_de_publicacao.md    # Guia de deploy e manutenção
    └── arquitetura_do_ecossistema.md
```

---

## Como Rodar Localmente

Nenhuma dependência de instalação. Basta abrir o arquivo diretamente:

```bash
# Clone o repositório
git clone https://github.com/iflcosta/iflcosta-ti.git
cd iflcosta-ti

# Abra no browser (qualquer método abaixo funciona)
# Opção 1: diretamente pelo file system
start index.html

# Opção 2: com servidor local via Python
python -m http.server 3000

# Opção 3: com Live Server no VS Code
# Instale a extensão "Live Server" e clique em "Go Live"
```

---

## Deploy

O projeto usa **Continuous Deployment via Vercel**. Qualquer push na branch `main` publica automaticamente em produção.

```bash
git add .
git commit -m "sua mensagem"
git push origin main
# → Deploy automático em ~1 minuto em iflcosta-ti.vercel.app
```

---

## Próximos Passos

- [ ] Adicionar `favicon.ico` customizado
- [ ] Implementar formulário de orçamento com integração (Formspree ou similar)
- [ ] Criar página de blog para conteúdo técnico (SEO de longo prazo)
- [ ] Adicionar seção de depoimentos de clientes
- [ ] Configurar Google Analytics 4 e Search Console
- [ ] Implementar testes de performance com Lighthouse CI no pipeline

---

## Licença

Este projeto e seu conteúdo são de propriedade de **Iago Costa**. O código pode ser usado como referência de estudo.

---

<p align="center">
  Desenvolvido por <a href="https://github.com/iflcosta">@iflcosta</a> · Bragança Paulista, SP
</p>
