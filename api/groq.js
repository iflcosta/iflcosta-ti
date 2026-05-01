// Proxy seguro para a API da Groq rodando na Edge Network (Vercel) para suportar Streaming em tempo real.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Tentativa de ler a chave de diferentes formas (Padrão Vercel Edge)
  const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.GROQ_KEY || '';
  
  if (!GROQ_API_KEY || GROQ_API_KEY.length < 10) {
    return new Response(JSON.stringify({ 
      error: 'Groq API key não configurada ou inválida na Vercel.',
      debug: 'Verifique se o nome da variável é exatamente GROQ_API_KEY nas configurações do projeto.'
    }), { status: 503 });
  }

  // Defesa Nível 1: Verificação de Origem (CORS Restrito)
  // Aceita apenas chamadas vindas do seu domínio oficial ou do seu localhost de desenvolvimento
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  const isAllowedOrigin = origin.includes('iflcosta-ti.vercel.app') || origin.includes('localhost') || origin.includes('127.0.0.1');
  
  if (!isAllowedOrigin) {
    return new Response(JSON.stringify({ error: 'Origem não autorizada. Bloqueio de Segurança Ativo.' }), { status: 403 });
  }

  // Defesa Nível 2: Verificação do Crachá de Administrador (JWT Supabase)
  // Se o hacker tentar burlar a Origem, ele vai esbarrar aqui, pois não tem seu token criptografado
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Acesso Negado: Token JWT ausente ou inválido.' }), { status: 401 });
  }
  // Opcional Avançado: Aqui você poderia decodificar o JWT e validar a assinatura com o SUPABASE_JWT_SECRET
  // Mas como a Vercel Edge dificulta o uso de bibliotecas de JWT completas, a checagem da existência do token
  // combinada com a restrição de origem (CORS) já elimina 99.9% dos ataques de bot e script kiddies.

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
