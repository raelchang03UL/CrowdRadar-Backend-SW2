import { createPrivateKey } from "node:crypto";

export function fcmServiceAccount(env = process.env) {
    if (!env.FCM_SERVICE_ACCOUNT_JSON?.trim()) return undefined;
    try {
        const value = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
        if (!value || value.type !== "service_account" || !env.FCM_PROJECT_ID ||
            value.project_id !== env.FCM_PROJECT_ID || typeof value.client_email !== "string" ||
            !value.client_email.endsWith(`@${env.FCM_PROJECT_ID}.iam.gserviceaccount.com`) ||
            typeof value.private_key !== "string") throw new Error();
        const privateKey = value.private_key.replace(/\\n/g, "\n");
        if (createPrivateKey(privateKey).asymmetricKeyType !== "rsa") throw new Error();
        return { projectId: value.project_id, clientEmail: value.client_email, privateKey };
    } catch {
        // JSON.parse y el SDK pueden incluir fragmentos privados en sus errores.
        throw Object.assign(new Error("La credencial FCM no es válida para el proyecto configurado."), { code: "CONFIG_INVALID" });
    }
}
