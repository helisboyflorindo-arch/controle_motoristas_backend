const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
    try {
        const authorization = req.headers.authorization;

        if (!authorization) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token não fornecido.'
            });
        }

        const partes = authorization.split(' ');

        if (partes.length !== 2 || partes[0] !== 'Bearer') {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token inválido.'
            });
        }

        const token = partes[1];

        const usuario = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.usuario = usuario;

        next();

    } catch (error) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token inválido ou expirado.'
        });
    }
}

function somenteAdmin(req, res, next) {
    if (!req.usuario) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Não autenticado.'
        });
    }

    if (req.usuario.tipo !== 'admin') {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Acesso permitido apenas ao administrador.'
        });
    }

    next();
}

module.exports = {
    autenticar,
    somenteAdmin
};