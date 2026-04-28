const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const databaseId = process.env.NOTION_DATABASE_ID;

module.exports = async (req, res) => {
  // Adicionar proteção básica para a API também (opcional mas recomendado)
  // if (req.headers.authorization !== 'sua-chave-secreta') ...

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: 'Data',
          direction: 'descending',
        },
      ],
      page_size: 5, // Mostrar apenas os 5 últimos no dashboard
    });

    const leads = response.results.map(page => {
      return {
        id: page.id,
        name: page.properties['Nome/Equipamento']?.title[0]?.plain_text || 'Sem Nome',
        status: page.properties['Status']?.select?.name || 'Lead',
        date: page.properties['Data']?.date?.start || 'N/A',
      };
    });

    return res.status(200).json({ leads });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error fetching leads', error: error.message });
  }
};
