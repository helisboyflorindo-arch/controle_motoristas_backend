const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { autenticar } = require('../middleware/auth');
const router = express.Router();

// ======================================================
// LOGIN
// ======================================================

router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Email e senha são obrigatórios.'
            });
        }

        const [usuarios] = await pool.query(
            `
            SELECT
                id,
                nome,
                telefone,
                email,
                senha,
                tipo,
                motorista_id,
                ativo,
                created_at
            FROM usuarios
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Email ou senha incorretos.'
            });
        }

        const usuario = usuarios[0];

        if (!usuario.ativo) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Este usuário está desativado.'
            });
        }

        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.senha
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Email ou senha incorretos.'
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                nome: usuario.nome,
                telefone: usuario.telefone,
                email: usuario.email,
                tipo: usuario.tipo,
                motorista_id: usuario.motorista_id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );

        delete usuario.senha;

        return res.json({
            sucesso: true,
            mensagem: 'Login realizado com sucesso.',
            token,
            usuario
        });

    } catch (error) {
        console.error('Erro no login:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno do servidor.',
            erro: error.message
        });
    }
});


// ======================================================
// CADASTRO DE MOTORISTA
// ======================================================

router.post('/register', async (req, res) => {

    let conexao;

    try {
        const {
            nome,
            telefone,
            documento,
            email,
            senha
        } = req.body;

        // --------------------------------------------------
        // VALIDAR CAMPOS
        // --------------------------------------------------

        if (
            !nome ||
            !telefone ||
            !documento ||
            !email ||
            !senha
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem:
                    'Nome, telefone, documento, email e senha são obrigatórios.'
            });
        }

        // --------------------------------------------------
        // PEGAR CONEXÃO
        // --------------------------------------------------

        conexao = await pool.getConnection();

        // --------------------------------------------------
        // VERIFICAR EMAIL
        // --------------------------------------------------

        const [emailExistente] = await conexao.query(
            `
            SELECT id
            FROM usuarios
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );

        if (emailExistente.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este email já está cadastrado.'
            });
        }

        // --------------------------------------------------
        // VERIFICAR DOCUMENTO
        // --------------------------------------------------

        const [documentoExistente] = await conexao.query(
            `
            SELECT id
            FROM motoristas
            WHERE documento = ?
            LIMIT 1
            `,
            [documento]
        );

        if (documentoExistente.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este documento já está cadastrado.'
            });
        }

        // --------------------------------------------------
        // VERIFICAR TELEFONE
        // --------------------------------------------------

        const [telefoneExistente] = await conexao.query(
            `
            SELECT id
            FROM motoristas
            WHERE telefone = ?
            LIMIT 1
            `,
            [telefone]
        );

        if (telefoneExistente.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Este telefone já está cadastrado.'
            });
        }

        // --------------------------------------------------
        // CRIPTOGRAFAR SENHA
        // --------------------------------------------------

        const senhaHash = await bcrypt.hash(senha, 10);

        // --------------------------------------------------
        // INICIAR TRANSAÇÃO
        // --------------------------------------------------

        await conexao.beginTransaction();

        // --------------------------------------------------
        // 1. CRIAR MOTORISTA
        // --------------------------------------------------

        const [motoristaResult] = await conexao.query(
            `
            INSERT INTO motoristas
            (
                nome,
                telefone,
                documento,
                email,
                ativo
            )
            VALUES (?, ?, ?, ?, 1)
            `,
            [
                nome,
                telefone,
                documento,
                email
            ]
        );

        const motoristaId = motoristaResult.insertId;

        // --------------------------------------------------
        // 2. CRIAR USUÁRIO
        // --------------------------------------------------

        const [usuarioResult] = await conexao.query(
            `
            INSERT INTO usuarios
            (
                nome,
                telefone,
                email,
                senha,
                tipo,
                motorista_id,
                ativo
            )
            VALUES (?, ?, ?, ?, 'motorista', ?, 1)
            `,
            [
                nome,
                telefone,
                email,
                senhaHash,
                motoristaId
            ]
        );

        // --------------------------------------------------
        // CONFIRMAR
        // --------------------------------------------------

        await conexao.commit();

        return res.status(201).json({
            sucesso: true,
            mensagem: 'Conta de motorista criada com sucesso.',
            usuario_id: usuarioResult.insertId,
            motorista_id: motoristaId
        });

    } catch (error) {

        if (conexao) {
            try {
                await conexao.rollback();
            } catch (_) {}
        }

        console.error('=================================');
        console.error('ERRO NO CADASTRO:');
        console.error(error);
        console.error('=================================');

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                sucesso: false,
                mensagem:
                    'Email, telefone, documento ou outro dado já está cadastrado.'
            });
        }

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro interno ao criar conta.',
            erro: error.message
        });

    } finally {

        if (conexao) {
            conexao.release();
        }

    }
});

// ======================================================
// ALTERAR SENHA
// ======================================================

router.put('/alterar-senha', autenticar, async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;
const usuario_id = req.usuario.id;

        if (!usuario_id || !senha_atual || !nova_senha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Todos os campos são obrigatórios.'
            });
        }

        if (nova_senha.length < 6) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A nova senha deve ter pelo menos 6 caracteres.'
            });
        }

        const [usuarios] = await pool.query(
            `
            SELECT id, senha
            FROM usuarios
            WHERE id = ?
            LIMIT 1
            `,
            [usuario_id]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Usuário não encontrado.'
            });
        }

        const usuario = usuarios[0];

        const senhaCorreta = await bcrypt.compare(
            senha_atual,
            usuario.senha
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'A senha atual está incorreta.'
            });
        }

        const novaSenhaHash = await bcrypt.hash(nova_senha, 10);

        await pool.query(
            `
            UPDATE usuarios
            SET senha = ?
            WHERE id = ?
            `,
            [novaSenhaHash, usuario_id]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Senha alterada com sucesso.'
        });

    } catch (error) {
        console.error('ERRO AO ALTERAR SENHA:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao alterar senha.',
            erro: error.message
        });
    }
});

// ======================================================
// ALTERAR SENHA - UTILIZADOR AUTENTICADO
// ======================================================

//const { autenticar } = require('../middleware/auth');

router.put('/senha', autenticar, async (req, res) => {
    try {
        const { senhaAtual, novaSenha } = req.body;

        if (!senhaAtual || !novaSenha) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Informe a senha atual e a nova senha.'
            });
        }

        if (novaSenha.length < 6) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'A nova senha deve ter pelo menos 6 caracteres.'
            });
        }

        const usuarioId = req.usuario.id;

        const [usuarios] = await pool.query(
            `
            SELECT id, senha
            FROM usuarios
            WHERE id = ?
            LIMIT 1
            `,
            [usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Utilizador não encontrado.'
            });
        }

        const usuario = usuarios[0];

        const senhaCorreta = await bcrypt.compare(
            senhaAtual,
            usuario.senha
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'A senha atual está incorreta.'
            });
        }

        const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

        await pool.query(
            `
            UPDATE usuarios
            SET senha = ?
            WHERE id = ?
            `,
            [novaSenhaHash, usuarioId]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Senha alterada com sucesso.'
        });

    } catch (error) {
        console.error('ERRO AO ALTERAR SENHA:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao alterar senha.',
            erro: error.message
        });
    }
});

// ======================================================
// OBTER PERFIL DO UTILIZADOR AUTENTICADO
// ======================================================

router.get('/perfil', autenticar, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const [usuarios] = await pool.query(
            `
            SELECT
                id,
                nome,
                telefone,
                email,
                tipo,
                motorista_id,
                ativo,
                notificacoes,
                modo_escuro,
                created_at
            FROM usuarios
            WHERE id = ?
            LIMIT 1
            `,
            [usuarioId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Utilizador não encontrado.'
            });
        }

        return res.json({
            sucesso: true,
            usuario: usuarios[0]
        });

    } catch (error) {
        console.error('ERRO AO OBTER PERFIL:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao carregar perfil.',
            erro: error.message
        });
    }
});


// ======================================================
// ATUALIZAR PERFIL
// ======================================================

router.put('/perfil', autenticar, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { nome } = req.body;

        if (!nome || !nome.trim()) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'O nome é obrigatório.'
            });
        }

        const nomeLimpo = nome.trim();

        await pool.query(
            `
            UPDATE usuarios
            SET nome = ?
            WHERE id = ?
            `,
            [nomeLimpo, usuarioId]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Perfil atualizado com sucesso.',
            nome: nomeLimpo
        });

    } catch (error) {
        console.error('ERRO AO ATUALIZAR PERFIL:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao atualizar perfil.',
            erro: error.message
        });
    }
});


// ======================================================
// ATUALIZAR PREFERÊNCIAS
// ======================================================

router.put('/preferencias', autenticar, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;

        const { notificacoes, modo_escuro } = req.body;

        if (
            typeof notificacoes !== 'boolean' ||
            typeof modo_escuro !== 'boolean'
        ) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Preferências inválidas.'
            });
        }

        await pool.query(
            `
            UPDATE usuarios
            SET
                notificacoes = ?,
                modo_escuro = ?
            WHERE id = ?
            `,
            [
                notificacoes ? 1 : 0,
                modo_escuro ? 1 : 0,
                usuarioId
            ]
        );

        return res.json({
            sucesso: true,
            mensagem: 'Preferências atualizadas com sucesso.',
            preferencias: {
                notificacoes,
                modo_escuro
            }
        });

    } catch (error) {
        console.error('ERRO AO ATUALIZAR PREFERÊNCIAS:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao atualizar preferências.',
            erro: error.message
        });
    }
});

// ======================================================
// SALVAR FCM TOKEN
// ======================================================

router.post('/fcm-token', autenticar, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { fcm_token } = req.body;

        if (!fcm_token) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'FCM Token é obrigatório.'
            });
        }

      await pool.query(
`
INSERT INTO dispositivos_admin
(
    usuario_id,
    fcm_token,
    dispositivo
)

VALUES (?, ?, ?)

ON DUPLICATE KEY UPDATE

ultimo_acesso = CURRENT_TIMESTAMP

`,
[
    usuarioId,
    fcm_token,
    'Android'
]
);

        console.log('=================================');
        console.log('FCM TOKEN SALVO');
        console.log('Usuário:', usuarioId);
        console.log('Token:', fcm_token);
        console.log('=================================');

        return res.json({
            sucesso: true,
            mensagem: 'FCM Token salvo com sucesso.'
        });

    } catch (error) {
        console.error('ERRO AO SALVAR FCM TOKEN:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao salvar FCM Token.',
            erro: error.message
        });
    }
});

// ======================================================
// GUARDAR FCM TOKEN
// ======================================================

router.post('/fcm-token', autenticar, async (req,res)=>{


try {


const usuarioId = req.usuario.id;

const { fcm_token } = req.body;


if(!fcm_token){

return res.status(400).json({

sucesso:false,

mensagem:'FCM token obrigatório'

});

}



await pool.query(

`
UPDATE usuarios
SET fcm_token = ?
WHERE id = ?

`,

[
fcm_token,
usuarioId
]

);



return res.json({

sucesso:true,

mensagem:'FCM token guardado'

});



}catch(error){


console.error(error);


res.status(500).json({

sucesso:false,

mensagem:'Erro ao guardar token'

});


}


});

// ======================================================
// SALVAR FCM TOKEN
// ======================================================

router.put('/fcm-token', autenticar, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        const { fcm_token } = req.body;

        if (!fcm_token || !fcm_token.trim()) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'FCM token é obrigatório.'
            });
        }

        await pool.query(
            `
            UPDATE usuarios
            SET fcm_token = ?
            WHERE id = ?
            `,
            [fcm_token.trim(), usuarioId]
        );

        return res.json({
            sucesso: true,
            mensagem: 'FCM token salvo com sucesso.'
        });

    } catch (error) {
        console.error('ERRO AO SALVAR FCM TOKEN:', error);

        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao salvar FCM token.',
            erro: error.message
        });
    }
});

module.exports = router;