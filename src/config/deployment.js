import { corsOptions, validateEnvironment } from "./environment.js";
import { mailConfiguration } from "./mail.js";
import { fcmServiceAccount } from "./fcmCredentials.js";

const invalid = (message) => Object.assign(new Error(message), { code: "CONFIG_INVALID" });

// La Function no adopta valores de desarrollo si falta configuración de despliegue.
export function validateDeploymentEnvironment(env = process.env) {
    try {
        validateEnvironment(env);
        if (env.NODE_ENV !== "production") throw invalid("El despliegue requiere NODE_ENV=production.");
        if (typeof env.JWT_SECRET !== "string" || env.JWT_SECRET.trim().length < 32) {
            throw invalid("JWT_SECRET requiere al menos 32 caracteres.");
        }
        if (env.PUSH_WORKER_ENABLED !== "false") throw invalid("La Function requiere PUSH_WORKER_ENABLED=false.");
        if (!env.CORS_ORIGINS?.trim()) throw invalid("Define CORS_ORIGINS para el frontend HTTPS.");
        corsOptions(env);
        const origins = env.CORS_ORIGINS.split(",").map(value => value.trim()).filter(Boolean);
        for (const origin of origins) {
            const url = new URL(origin);
            if (url.protocol !== "https:" || url.username || url.password ||
                ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
                throw invalid("CORS_ORIGINS requiere orígenes HTTPS explícitos de despliegue.");
            }
        }
        const mail = mailConfiguration(env);
        if (mail && !origins.includes(new URL(mail.resetUrl).origin)) {
            throw invalid("PASSWORD_RESET_URL debe pertenecer al frontend permitido.");
        }
        const account = fcmServiceAccount(env);
        if (env.FCM_PROJECT_ID && (!account || !env.SATURATION_EVENT_SECRET)) {
            throw invalid("FCM en Vercel requiere credencial privada y secreto del ejecutor.");
        }
    } catch (error) {
        if (error.code === "CONFIG_INVALID") throw error;
        throw invalid("La configuración del despliegue no es válida.");
    }
}
