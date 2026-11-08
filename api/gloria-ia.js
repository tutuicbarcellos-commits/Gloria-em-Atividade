/* =============================================================
   Vercel: ponte para a função da Glória IA.
   A lógica fica em netlify/functions/gloria-ia.js (handler de evento).
   Aqui só traduzimos a requisição da Vercel para esse formato.
   Rota pública: POST /api/gloria-ia
   ============================================================= */
const { handler } = require('../netlify/functions/gloria-ia.js');

// Não deixa a Vercel ler o corpo: a função mede o tamanho do texto cru.
module.exports.config = { api: { bodyParser: false } };

const LIMITE_LEITURA = 5001; // um pouco acima do limite da função (5000)

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let tamanho = 0;
    const pedacos = [];
    req.on('data', (pedaco) => {
      tamanho += pedaco.length;
      if (tamanho > LIMITE_LEITURA) {
        req.destroy();
        return resolve(null); // estourou: a função recusa com 413
      }
      pedacos.push(pedaco);
    });
    req.on('end', () => resolve(Buffer.concat(pedacos).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  let corpo = '';
  if (req.method === 'POST') {
    try {
      corpo = await lerCorpo(req);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ erro: true, resposta: 'Requisição inválida.' }));
    }
    if (corpo === null) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ erro: true, resposta: 'Pergunta longa demais. Tente algo mais curto.' }));
    }
  }

  const resultado = await handler({
    httpMethod: req.method,
    headers: req.headers,
    body: corpo,
    isBase64Encoded: false,
  });

  res.statusCode = resultado.statusCode;
  for (const [nome, valor] of Object.entries(resultado.headers || {})) res.setHeader(nome, valor);
  res.end(resultado.body);
};
