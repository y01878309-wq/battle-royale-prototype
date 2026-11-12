'use strict';
/* Firebase project of the game (the web config is public by design; what protects the data is firestore.rules / database.rules.json). */
window.QS_FIREBASE = {
  apiKey: 'AIzaSyA_eFOV39-kEXrQe7viZDxxwvb5Bm1Qe-8',
  authDomain: 'qitarat-misr.firebaseapp.com',
  databaseURL: 'https://qitarat-misr-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'qitarat-misr',
  storageBucket: 'qitarat-misr.firebasestorage.app',
  messagingSenderId: '982828683181',
  appId: '1:982828683181:web:ff32dbaee087ea3db55b24'
};
window.QS_BUILD = '2026/11/12';
/* Where players send money to top up their game coins. They contact the owner with their player ID and he credits it from admin.html. */
window.QS_PAY = { vodafone: '01093706503', note: 'ابعت المبلغ على فودافون كاش، وبعدين كلّمني واكتبلي رقم الـ ID بتاعك وهشحنلك.' };
