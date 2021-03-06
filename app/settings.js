var firebase_account = process.env.FIREBASE_ACCOUNT || 'blazing-torch-7074';

module.exports = {
  FIREBASE_SECRET: process.env.FIREBASESECRET,
  FIREBASE_ACCOUNT: firebase_account,
  FIREBASE_DOMAIN: 'https://' + firebase_account + '.firebaseio.com',
  FIREBASE_STORAGE_KEY: 'firebase:session::' + firebase_account,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLEMAPSAPI,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  INSHALLAH_PHONE_NUMBER: process.env.INSHALLAH_PHONE_NUMBER
};
