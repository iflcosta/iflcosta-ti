// Proxy seguro para a API da Groq.
// A chave GROQ_API_KEY fica apenas no servidor (Vercel env vars), nunca no browser.

const GROQ_API_KEY = process.env.GROQ_API_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GROQ_API_KEY) {
    return res.status(503).json({
      error: 'Groq API key não configurada. Adicione GROQ_API_KEY nas variáveis de ambiente do Vercel.',
    });
  }

  const {
    messages,
    model = 'llama-3.3-70b-versatile',
    temperature = 0.5,
    max_tokens = 500,
  } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Campo "messages" é obrigatório e deve ser um array.' });
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return res.status(groqRes.status).json({
        error: data.error?.message || 'Groq retornou um erro.',
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Groq proxy error:', error);
    return res.status(500).json({ error: 'Erro interno ao contatar a Groq.' });
  }
};
