const express = require('express');
const pool = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();

// LISTAR MOTORISTAS
router.get('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const [motoristas] = await pool.query(`
      SELECT
        id,
        nome,
        telefone,
        documento,
        email,
        ativo,
        created_at
      FROM motoristas
      ORDER BY id DESC
    `);

    res.json({
      sucesso: true,
      motoristas
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao listar motoristas.',
      erro: error.message
    });
  }
});


// BUSCAR MOTORISTA POR ID
router.get('/:id', autenticar, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [motoristas] = await pool.query(
      `
      SELECT
        id,
        nome,
        telefone,
        documento,
        email,
        ativo,
        created_at
      FROM motoristas
      WHERE id = ?
      `,
      [id]
    );

    if (motoristas.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Motorista não encontrado.'
      });
    }

    res.json({
      sucesso: true,
      motorista: motoristas[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao buscar motorista.',
      erro: error.message
    });
  }
});


// CADASTRAR MOTORISTA
router.post('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const {
      nome,
      telefone,
      documento,
      email
    } = req.body;

    if (!nome || !telefone || !documento) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nome, telefone e documento são obrigatórios.'
      });
    }

    const [resultado] = await pool.query(
      `
      INSERT INTO motoristas
      (nome, telefone, documento, email)
      VALUES (?, ?, ?, ?)
      `,
      [
        nome,
        telefone,
        documento,
        email || null
      ]
    );

    res.status(201).json({
      sucesso: true,
      mensagem: 'Motorista cadastrado com sucesso.',
      motorista_id: resultado.insertId
    });

  } catch (error) {
    console.error(error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        sucesso: false,
        mensagem: 'O documento informado já está cadastrado.'
      });
    }

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao cadastrar motorista.',
      erro: error.message
    });
  }
});


// EDITAR MOTORISTA
router.put('/:id', autenticar, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nome,
      telefone,
      documento,
      email
    } = req.body;

    if (!nome || !telefone || !documento) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Nome, telefone e documento são obrigatórios.'
      });
    }

    const [resultado] = await pool.query(
      `
      UPDATE motoristas
      SET
        nome = ?,
        telefone = ?,
        documento = ?,
        email = ?
      WHERE id = ?
      `,
      [
        nome,
        telefone,
        documento,
        email || null,
        id
      ]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Motorista não encontrado.'
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Motorista atualizado com sucesso.'
    });

  } catch (error) {
    console.error(error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        sucesso: false,
        mensagem: 'O documento informado já pertence a outro motorista.'
      });
    }

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao atualizar motorista.',
      erro: error.message
    });
  }
});


// DESATIVAR MOTORISTA
router.delete('/:id', autenticar, somenteAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [resultado] = await pool.query(
      `
      UPDATE motoristas
      SET ativo = 0
      WHERE id = ?
      `,
      [id]
    );

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Motorista não encontrado.'
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Motorista desativado com sucesso.'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao desativar motorista.',
      erro: error.message
    });
  }
});

// ELIMINAR MOTORISTA DEFINITIVAMENTE
router.delete('/:id', autenticar, somenteAdmin, async (req, res) => {
  const conexao = await pool.getConnection();

  try {
    const { id } = req.params;

    await conexao.beginTransaction();


    // verificar se existe
    const [motorista] = await conexao.query(
      `
      SELECT id
      FROM motoristas
      WHERE id = ?
      `,
      [id]
    );


    if (motorista.length === 0) {
      await conexao.rollback();

      return res.status(404).json({
        sucesso: false,
        mensagem: 'Motorista não encontrado.'
      });
    }


    // apagar veículos
    await conexao.query(
      `
      DELETE FROM veiculos
      WHERE motorista_id = ?
      `,
      [id]
    );


    // apagar corridas
    await conexao.query(
      `
      DELETE FROM corridas
      WHERE motorista_id = ?
      `,
      [id]
    );


    // apagar despesas
    await conexao.query(
      `
      DELETE FROM despesas
      WHERE motorista_id = ?
      `,
      [id]
    );


    // apagar utilizador ligado
    await conexao.query(
      `
      DELETE FROM usuarios
      WHERE motorista_id = ?
      `,
      [id]
    );


    // apagar motorista
    await conexao.query(
      `
      DELETE FROM motoristas
      WHERE id = ?
      `,
      [id]
    );


    await conexao.commit();


    res.json({
      sucesso: true,
      mensagem: 'Motorista eliminado definitivamente.'
    });


  } catch (error) {

    await conexao.rollback();

    console.error('Erro ao eliminar motorista:', error);


    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao eliminar motorista.',
      erro: error.message
    });


  } finally {

    conexao.release();

  }
});

module.exports = router;