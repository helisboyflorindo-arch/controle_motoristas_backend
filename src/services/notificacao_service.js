const { messaging } = require('../config/firebase');


async function enviarNotificacao(token, titulo, mensagem) {

    try {

        const resposta = await messaging.send({

            token: token,

            notification: {
                title: titulo,
                body: mensagem
            }

        });


        console.log(
            'Notificação enviada:',
            resposta
        );


        return resposta;


    } catch (error) {

        console.error(
            'Erro Firebase Notification:',
            error
        );

        throw error;

    }

}


module.exports = {
    enviarNotificacao
};