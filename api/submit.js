const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const databaseId = process.env.NOTION_DATABASE_ID;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { name, whatsapp, service, message } = req.body;

    // Formatar o link do WhatsApp
    const cleanPhone = whatsapp.replace(/\D/g, '');
    const waLink = `https://wa.me/55${cleanPhone.length === 11 ? cleanPhone : '11' + cleanPhone}`;

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        'Nome/Equipamento': {
          title: [
            {
              text: {
                content: `${name} - ${service.toUpperCase()}`,
              },
            },
          ],
        },
        'Status': {
          select: {
            name: 'Lead',
          },
        },
        'Link WhatsApp': {
          url: waLink,
        },
        'Data': {
          date: {
            start: new Date().toISOString().split('T')[0],
          },
        },
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `Mensagem do cliente: ${message}`,
                },
              },
            ],
          },
        },
      ],
    });

    return res.status(200).json({ message: 'Success', id: response.id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};
