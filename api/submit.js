// Endpoint de submissão de leads — armazenamento centralizado no Supabase.
// Substitui a integração legada com Notion.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pfodcrnisntawxqsywld.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Vip8SjvB27zSCuDI_MVXKg_Iy2tB0DW';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://iflcosta-ti.vercel.app';

// Rate limiting em memória por IP (reseta a cada cold start da função)
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_PER_WINDOW = 3;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= MAX_PER_WINDOW) return true;
  entry.count++;
  return false;
}

function sanitize(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

const VALID_SERVICES = ['smartphone', 'notebook', 'custom-pc', 'ti-support', 'outro'];
const VALID_URGENCIES = ['Alta', 'Média', 'Baixa'];
const VALID_CLIENT_TYPES = ['Pessoa Física', 'Empresa/Escritório'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Muitas solicitações. Tente novamente em alguns minutos.' });
  }

  const { name, whatsapp, service, message, client_type, urgency } = req.body || {};

  // Validação dos campos obrigatórios
  if (!name || !whatsapp || !service || !message) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  const cleanPhone = String(whatsapp).replace(/\D/g, '');
  if (cleanPhone.length < 10 || cleanPhone.length > 11) {
    return res.status(400).json({ error: 'Número de WhatsApp inválido.' });
  }

  if (!VALID_SERVICES.includes(service)) {
    return res.status(400).json({ error: 'Categoria de serviço inválida.' });
  }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // Verificação de duplicata pelo número normalizado
    const dupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?whatsapp=eq.${encodeURIComponent(cleanPhone)}&status=neq.Arquivado&select=id&limit=1`,
      { headers }
    );
    const dupData = await dupRes.json();
    if (Array.isArray(dupData) && dupData.length > 0) {
      return res.status(409).json({ error: 'Já recebemos seu contato! Retornaremos em breve via WhatsApp.' });
    }

    // Inserção no Supabase
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        name: sanitize(name, 100),
        whatsapp: cleanPhone,
        service_category: service,
        message: sanitize(message),
        urgency: VALID_URGENCIES.includes(urgency) ? urgency : 'Média',
        client_type: VALID_CLIENT_TYPES.includes(client_type) ? client_type : 'Pessoa Física',
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      throw new Error(errText);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Supabase submit error:', error);
    return res.status(500).json({ error: 'Erro interno. Tente novamente ou entre em contato via WhatsApp.' });
  }
};
