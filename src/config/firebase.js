const admin = require('firebase-admin');


let serviceAccount;


// Render / Produção
if (process.env.FIREBASE_SERVICE_ACCOUNT) {

    serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
    );

} 
// Local
else {

    serviceAccount = require('../../firebase-service-account.json');

}



if (!admin.apps.length) {

    admin.initializeApp({

        credential: admin.credential.cert(serviceAccount)

    });

}


module.exports = admin;