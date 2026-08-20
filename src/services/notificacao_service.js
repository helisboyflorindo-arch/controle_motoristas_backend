const { messaging } = require('../config/firebase');


async function enviarNotificacao(token, titulo, mensagem) {

    console.log("==============================");
    console.log("TOKEN RECEBIDO:");
    console.log(token);
    console.log("==============================");


    return await messaging.send({

        token: token,

        notification:{
            title: titulo,
            body: mensagem
        }

    });

}


module.exports = {
    enviarNotificacao
};