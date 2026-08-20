const admin = require('firebase-admin');


let serviceAccount;


// Ler variável do Render
if (process.env.FIREBASE_SERVICE_ACCOUNT) {

    serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
    );

} else {

    serviceAccount = require('../../firebase-service-account.json');

}


// Inicializar Firebase

if (admin.getApps().length === 0) {

    admin.initializeApp({

        credential: admin.cert(serviceAccount)

    });

}


module.exports = admin;