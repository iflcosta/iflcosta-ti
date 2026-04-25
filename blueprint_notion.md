# Blueprint de Estrutura: Notion para Especialista de TI

Este guia foi desenhado para você copiar e colar dentro do seu Notion. A **Notion AI** conseguirá ler estas instruções e te ajudar a montar as tabelas.

---

## 1. Banco de Dados: Funil de Vendas (CRM)
*Este é o coração do seu dia a dia. Use a visualização de **QUADRO (KANBAN)**.*

**Propriedades que você deve criar:**
1.  **Título:** Nome do Cliente / Equipamento
2.  **Status (Select):** [Novo Lead, Orçamento Enviado, Na Bancada, Aguardando Peça, Finalizado, Entregue/Pago]
3.  **Valor (Number):** Formato Real (R$)
4.  **WhatsApp (URL):** Link para conversa direta
5.  **Data de Entrada (Date):** Quando o aparelho chegou
6.  **Tipo de Serviço (Multi-select):** [Celular, Notebook, PC Gamer, Redes, Software]

---

## 2. Banco de Dados: Cadastro de Clientes
*Aqui você guarda o histórico de quem já passou por você.*

**Propriedades que você deve criar:**
1.  **Nome (Título):** Nome Completo
2.  **Telefone (Phone):** WhatsApp do Cliente
3.  **Total Gasto (Rollup/Number):** Soma de todos os serviços realizados (LTV)
4.  **Data do Último Serviço (Date):** Para você saber quando mandar uma mensagem de pós-venda após 6 meses.
5.  **Observações Técnicas (Text):** Ex: "Cliente muito exigente", "Gosta de peças originais".

---

## 3. Banco de Dados: Base de Conhecimento (Wiki)
*Onde você documenta soluções para a sua IA consultar no futuro.*

**Propriedades que você deve criar:**
1.  **Problema (Título):** Ex: "Erro de Wi-Fi no iPhone 12"
2.  **Sintoma (Text):** Como o aparelho se comportava
3.  **Solução (Text):** O passo a passo técnico do que você fez
4.  **Dificuldade (Select):** [Fácil, Média, Hard, Ninja]
5.  **Tags (Multi-select):** [Microsolda, Software, Hardware, Apple, Android]

---

### 💡 Como usar com a Notion AI:
1. Crie uma página nova no Notion.
2. Copie o texto de uma das seções acima.
3. Aperte `Espaço` (para chamar a IA) e digite: 
   *"Crie um banco de dados de exemplo com estas propriedades listadas acima e preencha com 2 linhas de exemplo."*
4. O Notion vai gerar a tabela para você na hora. Depois você só precisa ajustar os tipos de coluna se ele errar algum.
