const admin = require('../config/firebase');


async function enviarNotificacao(token, titulo, mensagem) {

    try {

        const response = await admin.messaging().send({

            token: token,

            notification: {
                title: titulo,
                body: mensagem
            },

            android: {
                priority: 'high'
            }

        });


        console.log(
            'Notificação enviada:',
            response
        );


        return response;


    } catch(error) {

        console.error(
            'Erro Firebase Notification:',
            error.message
        );

        throw error;

    }

}


module.exports = {
    enviarNotificacao
};