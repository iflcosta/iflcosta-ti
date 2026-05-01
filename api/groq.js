// Proxy seguro para a API da Groq rodando na Edge Network (Vercel) para suportar Streaming em tempo real.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: 'Groq API key não configurada.' }), { status: 503 });
  }

  try {
    const body = await req.json();
    const {
      messages,
      model = 'llama-3.3-70b-versatile',
      temperature = 0.5,
      max_tokens = 1000,
      stream = true, // Forçando streaming
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Campo "messages" é obrigatório.' }), { status: 400 });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens, stream }),
    });

    if (!groqRes.ok) {
      const errorText = await groqRes.text();
      return new Response(errorText, { status: groqRes.status });
    }

    // Retorna o stream puro para o frontend processar (Efeito Máquina de Escrever)
    return new Response(groqRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro interno ao contatar a Groq: ' + error.message }), { status: 500 });
  }
}
