require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('./src/db');

async function criarAdmin() {
    try {
        const email = 'admin@controle.com';
        const senha = 'Admin@123';

        const [existente] = await pool.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );

        if (existente.length > 0) {
            console.log('Administrador já existe.');
            process.exit(0);
        }

        const senhaHash = await bcrypt.hash(senha, 12);

        await pool.query(
            `
            INSERT INTO usuarios
            (nome, email, senha, tipo, ativo)
            VALUES (?, ?, ?, 'admin', TRUE)
            `,
            [
                'Administrador',
                email,
                senhaHash
            ]
        );

        console.log('Administrador criado com sucesso!');
        console.log('Email:', email);
        console.log('Senha:', senha);

        process.exit(0);

    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

criarAdmin();