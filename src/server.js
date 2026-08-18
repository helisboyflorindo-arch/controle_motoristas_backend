require('dotenv').config();

const express = require('express');
const cors = require('cors');
const motoristasRoutes = require('./routes/motoristas');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const diarioRoutes = require('./routes/diario');
const corridasRoutes = require('./routes/corridas');
const despesasRoutes = require('./routes/despesas');
const dashboardRoutes = require('./routes/dashboard');
const veiculosRoutes = require('./routes/veiculos');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        sistema: 'Controle de Motoristas',
        status: 'online'
    });
});

app.get('/api/teste-db', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT 1 AS conectado'
        );

        res.json({
            sucesso: true,
            mensagem: 'MySQL conectado com sucesso',
            resultado: rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao conectar ao MySQL',
            erro: error.message
        });
    }
});

// AUTENTICAÇÃO
app.use('/api/auth', authRoutes);
app.use('/api/motoristas', motoristasRoutes);
app.use('/api/diario', diarioRoutes);
app.use('/api/corridas', corridasRoutes);
app.use('/api/despesas', despesasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/veiculos', veiculosRoutes);
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});