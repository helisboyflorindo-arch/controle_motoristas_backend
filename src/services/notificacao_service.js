const { messaging } = require('../config/firebase');


async function enviarNotificacao(token, titulo, mensagem) {

    return await messaging.send({

        token,

        notification: {
            title: titulo,
            body: mensagem
        }

    });

}


module.exports = {
    enviarNotificacao
};