import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

const appName = "crowdradar-push";

export function isFcmConfigured(env = process.env) {
    return Boolean(env.FCM_PROJECT_ID?.trim());
}

function messagingClient(env = process.env) {
    if (!isFcmConfigured(env)) {
        const error = new Error("FCM no está configurado.");
        error.code = "FCM_NOT_CONFIGURED";
        throw error;
    }
    let app = getApps().find(({ name }) => name === appName);
    if (!app) {
        app = initializeApp({
            credential: applicationDefault(),
            projectId: env.FCM_PROJECT_ID
        }, appName);
    }
    return getMessaging(app);
}

export default {
    isFcmConfigured,
    async send(message) {
        return messagingClient().send(message);
    },

    isInvalidTokenError(error) {
        return [
            "messaging/installation-id-not-registered",
            "messaging/registration-token-not-registered",
            "messaging/invalid-registration-token"
        ].includes(error?.code);
    }
};
