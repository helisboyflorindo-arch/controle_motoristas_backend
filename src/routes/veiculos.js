const express = require('express');
const pool = require('../db');
const { autenticar, somenteAdmin } = require('../middleware/auth');

const router = express.Router();

// LISTAR VEÍCULOS
router.get('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const [veiculos] = await pool.query(`
      SELECT
        v.id,
        v.marca,
        v.modelo,
        v.matricula,
        v.ano,
        v.motorista_id,
        v.ativo,
        v.created_at,
        m.nome AS motorista_nome
      FROM veiculos v
      LEFT JOIN motoristas m ON m.id = v.motorista_id
      ORDER BY v.id DESC
    `);

    res.json({
      sucesso: true,
      veiculos
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao listar veículos.',
      erro: error.message
    });
  }
});

// BUSCAR VEÍCULO
router.get('/:id', autenticar, somenteAdmin, async (req, res) => {
  try {
    const [veiculos] = await pool.query(`
      SELECT
        v.id,
        v.marca,
        v.modelo,
        v.matricula,
        v.ano,
        v.motorista_id,
        v.ativo,
        v.created_at,
        m.nome AS motorista_nome
      FROM veiculos v
      LEFT JOIN motoristas m ON m.id = v.motorista_id
      WHERE v.id = ?
    `, [req.params.id]);

    if (veiculos.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Veículo não encontrado.'
      });
    }

    res.json({
      sucesso: true,
      veiculo: veiculos[0]
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao buscar veículo.',
      erro: error.message
    });
  }
});

// CADASTRAR VEÍCULO
router.post('/', autenticar, somenteAdmin, async (req, res) => {
  try {
    const {
      marca,
      modelo,
      matricula,
      ano,
      motorista_id
    } = req.body;

    if (!marca || !modelo || !matricula) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Marca, modelo e matrícula são obrigatórios.'
      });
    }

    const [resultado] = await pool.query(`
      INSERT INTO veiculos
        (marca, modelo, matricula, ano, motorista_id)
      VALUES (?, ?, ?, ?, ?)
    `, [
      marca,
      modelo,
      matricula,
      ano || null,
      motorista_id || null
    ]);

    res.status(201).json({
      sucesso: true,
      mensagem: 'Veículo cadastrado com sucesso.',
      veiculo_id: resultado.insertId
    });
  } catch (error) {
    console.error(error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        sucesso: false,
        mensagem: 'A matrícula informada já está cadastrada.'
      });
    }

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao cadastrar veículo.',
      erro: error.message
    });
  }
});

// EDITAR VEÍCULO
router.put('/:id', autenticar, somenteAdmin, async (req, res) => {
  try {
    const {
      marca,
      modelo,
      matricula,
      ano,
      motorista_id
    } = req.body;

    if (!marca || !modelo || !matricula) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Marca, modelo e matrícula são obrigatórios.'
      });
    }

    const [resultado] = await pool.query(`
      UPDATE veiculos
      SET
        marca = ?,
        modelo = ?,
        matricula = ?,
        ano = ?,
        motorista_id = ?
      WHERE id = ?
    `, [
      marca,
      modelo,
      matricula,
      ano || null,
      motorista_id || null,
      req.params.id
    ]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Veículo não encontrado.'
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Veículo atualizado com sucesso.'
    });
  } catch (error) {
    console.error(error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        sucesso: false,
        mensagem: 'A matrícula informada já pertence a outro veículo.'
      });
    }

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao atualizar veículo.',
      erro: error.message
    });
  }
});

// DESATIVAR
router.delete('/:id', autenticar, somenteAdmin, async (req, res) => {
  try {
    const [resultado] = await pool.query(`
      UPDATE veiculos
      SET ativo = 0
      WHERE id = ?
    `, [req.params.id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Veículo não encontrado.'
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Veículo desativado com sucesso.'
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao desativar veículo.',
      erro: error.message
    });
  }
});

// REATIVAR
router.patch('/:id/ativar', autenticar, somenteAdmin, async (req, res) => {
  try {
    const [resultado] = await pool.query(`
      UPDATE veiculos
      SET ativo = 1
      WHERE id = ?
    `, [req.params.id]);

    if (resultado.affectedRows === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Veículo não encontrado.'
      });
    }

    res.json({
      sucesso: true,
      mensagem: 'Veículo reativado com sucesso.'
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao reativar veículo.',
      erro: error.message
    });
  }
});

module.exports = router;