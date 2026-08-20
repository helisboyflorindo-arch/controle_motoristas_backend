const express = require('express');
const pool = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');
const upload = require('../config/upload');
const { notificarAdmins } = require('../services/notificar_admins');
const { enviarNotificacao } = require('../services/notificacao_service');
const router = express.Router();


// ======================================================
// REGISTRAR DESPESA - MOTORISTA
// ======================================================

router.post(
  '/',
  autenticar,
  upload.single('comprovativo'),
  async (req, res) => {
    try {
      // IMPORTANTE:
      // Com multipart/form-data, o multer cria req.body.
      // Esta proteção evita o erro caso o body não exista.
      const {
        data,
        categoria,
        valor,
        observacao,
      } = req.body || {};

      console.log('======================================');
      console.log('DADOS DESPESA:', req.body);
      console.log('ARQUIVO:', req.file);
      console.log('USUARIO:', req.usuario);
      console.log('======================================');

      // ==================================================
      // MOTORISTA
      // ==================================================

      const motoristaId = req.usuario?.motorista_id;

      if (!motoristaId) {
        return res.status(400).json({
          sucesso: false,
          mensagem:
            'Este utilizador não está associado a um motorista.',
        });
      }

      // ==================================================
      // COMPROVATIVO OBRIGATÓRIO
      // ==================================================

      if (!req.file) {
        return res.status(400).json({
          sucesso: false,
          mensagem:
            'É obrigatório enviar uma foto do comprovativo da despesa.',
        });
      }

      // ==================================================
      // CATEGORIA
      // ==================================================

      if (!categoria || categoria.trim() === '') {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Informe a categoria da despesa.',
        });
      }

      // ==================================================
      // VALOR
      // ==================================================

      const valorNumerico = Number(valor);

      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'O valor da despesa é inválido.',
        });
      }

      // ==================================================
      // DATA
      // ==================================================

      const dataFinal = data || new Date();

      // ==================================================
      // VERIFICAR MOTORISTA
      // ==================================================

      const [motoristas] = await pool.query(
        `
        SELECT id
        FROM motoristas
        WHERE id = ? AND ativo = 1
        `,
        [motoristaId]
      );

      if (motoristas.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem:
            'Motorista não encontrado ou está desativado.',
        });
      }

      // ==================================================
      // URL DA FOTO
      // ==================================================

      const comprovativoUrl = req.file.path;

      if (!comprovativoUrl) {
        return res.status(500).json({
          sucesso: false,
          mensagem: 'Não foi possível obter a URL do comprovativo.',
        });
      }

      // ==================================================
      // INSERIR DESPESA
      // ==================================================

      const [resultado] = await pool.query(
        `
        INSERT INTO despesas
        (
          motorista_id,
          data,
          categoria,
          valor,
          observacao,
          comprovativo_url
        )
          
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          motoristaId,
          dataFinal,
          categoria.trim(),
          valorNumerico,
          observacao?.trim() || null,
          comprovativoUrl,
        ]
        
      );

      // ==================================================
// NOTIFICAR ADMINISTRADORES
// ==================================================

try {

  const [admins] = await pool.query(
    `
    SELECT fcm_token
    FROM usuarios
    WHERE tipo = 'admin'
    AND fcm_token IS NOT NULL
    `
  );


  for (const admin of admins) {

    await enviarNotificacao(
      admin.fcm_token,
      'Nova despesa registada',
      `${req.usuario.nome} registou uma despesa de ${valorNumerico} Kz`
    );

  }

} catch (erroNotificacao) {

  console.error(
    'Erro ao enviar notificação de despesa:',
    erroNotificacao
  );

}

      // ==================================================
      // RESPOSTA
      // ==================================================

      return res.status(201).json({
        sucesso: true,
        mensagem: 'Despesa registrada com sucesso.',
        despesa: {
          id: resultado.insertId,
          motorista_id: motoristaId,
          data: dataFinal,
          categoria: categoria.trim(),
          valor: valorNumerico,
          observacao: observacao?.trim() || null,
          comprovativo_url: comprovativoUrl,
        },
      });

    } catch (error) {
      console.error(
        'ERRO AO REGISTRAR DESPESA:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao registrar despesa.',
        erro: error.message,
      });
    }
  }
);


// ======================================================
// MINHAS DESPESAS - MOTORISTA
// ======================================================

router.get('/minhas', autenticar, async (req, res) => {
  try {
    const motoristaId = req.usuario?.motorista_id;
    const periodo = req.query.periodo || 'tudo';

    if (!motoristaId) {
      return res.status(400).json({
        sucesso: false,
        mensagem:
          'Este utilizador não está associado a um motorista.',
      });
    }

    let filtro = '';

    if (periodo === 'hoje') {
      filtro = 'AND DATE(data) = CURDATE()';
    }

    if (periodo === 'mes') {
      filtro = `
        AND YEAR(data) = YEAR(CURDATE())
        AND MONTH(data) = MONTH(CURDATE())
      `;
    }

    const [despesas] = await pool.query(
      `
      SELECT
        id,
        motorista_id,
        data,
        categoria,
        valor,
        observacao,
        comprovativo_url,
        created_at
      FROM despesas
      WHERE motorista_id = ?
      ${filtro}
      ORDER BY data DESC, id DESC
      `,
      [motoristaId]
    );

    return res.json({
      sucesso: true,
      periodo,
      despesas,
    });

  } catch (error) {
    console.error(
      'ERRO AO LISTAR DESPESAS:',
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao listar despesas.',
      erro: error.message,
    });
  }
});


// ======================================================
// TODAS AS DESPESAS - ADMIN
// ======================================================

router.get('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const [despesas] = await pool.query(
      `
      SELECT
        d.id,
        d.motorista_id,
        m.nome AS motorista,
        d.data,
        d.categoria,
        d.valor,
        d.observacao,
        d.comprovativo_url,
        d.created_at
      FROM despesas d
      INNER JOIN motoristas m
        ON m.id = d.motorista_id
      ORDER BY d.data DESC, d.id DESC
      `
    );

    return res.json({
      sucesso: true,
      despesas,
    });

  } catch (error) {
    console.error(
      'ERRO AO LISTAR DESPESAS ADMIN:',
      error
    );

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao listar despesas.',
      erro: error.message,
    });
  }
});


// ======================================================
// EDITAR DESPESA - ADMIN
// ======================================================

router.put(
  '/:id',
  autenticar,
  somenteAdmin,
  upload.single('comprovativo'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const {
        data,
        categoria,
        valor,
        observacao,
      } = req.body || {};

      if (!categoria || categoria.trim() === '') {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'Informe a categoria da despesa.',
        });
      }

      const valorNumerico = Number(valor);

      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: 'O valor da despesa é inválido.',
        });
      }

      // Verificar se existe
      const [despesas] = await pool.query(
        `
        SELECT id, comprovativo_url
        FROM despesas
        WHERE id = ?
        `,
        [id]
      );

      if (despesas.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: 'Despesa não encontrada.',
        });
      }

      // Mantém o comprovativo antigo se não for enviado outro
      let comprovativoUrl = despesas[0].comprovativo_url;

      if (req.file && req.file.path) {
        comprovativoUrl = req.file.path;
      }

      await pool.query(
        `
        UPDATE despesas
        SET
          data = ?,
          categoria = ?,
          valor = ?,
          observacao = ?,
          comprovativo_url = ?
        WHERE id = ?
        `,
        [
          data || new Date(),
          categoria.trim(),
          valorNumerico,
          observacao?.trim() || null,
          comprovativoUrl,
          id,
        ]
      );

      return res.json({
        sucesso: true,
        mensagem: 'Despesa atualizada com sucesso.',
      });

    } catch (error) {
      console.error(
        'ERRO AO ATUALIZAR DESPESA:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao atualizar despesa.',
        erro: error.message,
      });
    }
  }
);


// ======================================================
// EXCLUIR DESPESA - ADMIN
// ======================================================

router.delete(
  '/:id',
  autenticar,
  somenteAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const [resultado] = await pool.query(
        `
        DELETE FROM despesas
        WHERE id = ?
        `,
        [id]
      );
      await notificarAdmins(

    'Nova despesa registada',

    `${req.usuario.nome} registou uma despesa de ${valorNumerico} Kz`

);

      if (resultado.affectedRows === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: 'Despesa não encontrada.',
        });
      }

      return res.json({
        sucesso: true,
        mensagem: 'Despesa excluída com sucesso.',
      });

    } catch (error) {
      console.error(
        'ERRO AO EXCLUIR DESPESA:',
        error
      );

      return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro ao excluir despesa.',
        erro: error.message,
      });
    }
  }
);

module.exports = router;