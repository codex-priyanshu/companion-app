const webpush = require('web-push');

// Generate or use VAPID keys
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
    // Generate fallback keys if environment variables are not set
    const keys = webpush.generateVAPIDKeys();
    vapidPublicKey = keys.publicKey;
    vapidPrivateKey = keys.privateKey;
    console.log(" Generated WebPush VAPID Keys for Push Notifications");
}

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@coffeely.com',
    vapidPublicKey,
    vapidPrivateKey
);

module.exports = {
    webpush,
    vapidPublicKey,
    vapidPrivateKey
};
