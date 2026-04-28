# Blueprint de Estrutura: Notion para Especialista de TI (Versão Final 2.0)

Este guia reflete a estrutura de triagem e qualificação implementada para o lançamento da operação em 04/05/2026.

---

## 1. BANCO DE DADOS: Funil de Vendas (CRM)
*Visualização Principal: **QUADRO (KANBAN)***

**Propriedades Configuradas:**
1.  **Nome/Equipamento (Título):** Recebido automaticamente do site.
2.  **Status (Select):** [Lead, Orçamento, Bancada, Finalizado, Pago, Arquivo]
3.  **Qualificação (Select):** [🔥 Quente, ⏳ Médio, ❄️ Frio] -> Preenchido via Urgência do site.
4.  **Tipo de Lead (Select):** [Empresa/B2B, Pessoa Física] -> Preenchido via formulário do site.
5.  **Valor (Number):** Formato Real (R$).
6.  **WhatsApp (URL):** Link direto para atendimento.
7.  **Data (Date):** Data de entrada do lead.
8.  **Arquivar (Checkbox):** Gatilho para limpeza em massa.

**Visualizações (Views):**
- **[📋] Triagem de Hoje:** Tabela filtrada por (Status = Lead) + (Data = Hoje) + (Qualificação = Vazia).
- **[📊] Fluxo de Trabalho:** Quadro Kanban agrupado por Status.
- **[📁] Arquivo:** Tabela filtrada por (Status = Arquivo).

---

## 2. AUTOMAÇÃO: Botão de Limpeza (Limpar Leads Frios)
**Configuração do Botão:**
- **Ação:** Editar páginas no banco 'Funil de Vendas'.
- **Filtro:** Somente páginas onde `Arquivar` está MARCADO.
- **Modificação:** Mudar `Status` para "Arquivo" e desmarcar `Arquivar`.

---

## 3. BANCO DE DADOS: Wiki Técnica (O Cérebro da IA)
*Visualização Principal: **GALERIA***

**Propriedades:**
1.  **Problema (Título)**
2.  **Sintoma (Text)**
3.  **Solução (Text)**
4.  **Tags (Multi-select):** [Apple, Android, Microsolda, Redes, PC Gamer]

---

## 4. INTEGRAÇÃO COM O SITE (API)
- **Endpoint:** `/api/submit` (Vercel)
- **Mapeamento de Urgência:**
    - Alta -> 🔥 Quente
    - Média -> ⏳ Médio
    - Baixa -> ❄️ Frio
- **Mapeamento de Tipo:**
    - Pessoa Física -> Pessoa Física
    - Empresa/Escritório -> Empresa/B2B
