const { messaging } = require('../config/firebase');


async function enviarNotificacao(token, titulo, mensagem) {

    try {

        console.log("==============================");
        console.log("TOKEN RECEBIDO:");
        console.log(token);
        console.log("==============================");


        const resposta = await messaging.send({

            token: token,

            notification: {
                title: titulo,
                body: mensagem
            }

        });


        console.log("NOTIFICAÇÃO ENVIADA:", resposta);

        return resposta;


    } catch(error) {

        console.error("ERRO FIREBASE:", error);

        throw error;
    }

}


module.exports = {
    enviarNotificacao
};