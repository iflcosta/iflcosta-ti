// Endpoint para buscar leads recentes — substituí integração com Notion por Supabase.
// Protegido por header x-api-secret quando LEADS_API_SECRET está configurado no Vercel.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pfodcrnisntawxqsywld.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_Vip8SjvB27zSCuDI_MVXKg_Iy2tB0DW';
const API_SECRET = process.env.LEADS_API_SECRET;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Proteção por secret configurável via env var no Vercel
  if (API_SECRET && req.headers['x-api-secret'] !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/leads?select=id,name,status,created_at&order=created_at.desc&limit=5`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Supabase fetch failed');
    }

    const leads = data.map(l => ({
      id: l.id,
      name: l.name,
      status: l.status,
      date: l.created_at ? l.created_at.split('T')[0] : 'N/A',
    }));

    return res.status(200).json({ leads });
  } catch (error) {
    console.error('Leads fetch error:', error);
    return res.status(500).json({ error: 'Error fetching leads' });
  }
};
