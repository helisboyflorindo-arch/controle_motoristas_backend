const admin = require('firebase-admin');


let serviceAccount;


if (process.env.FIREBASE_SERVICE_ACCOUNT) {

    serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT
    );

    serviceAccount.private_key =
        serviceAccount.private_key.replace(/\\n/g, '\n');


} else {

    serviceAccount = require('../../firebase-service-account.json');

}


if (admin.getApps().length === 0) {

    admin.initializeApp({
        credential: admin.cert(serviceAccount)
    });

}


module.exports = {
    admin,
    messaging: admin.messaging()
};