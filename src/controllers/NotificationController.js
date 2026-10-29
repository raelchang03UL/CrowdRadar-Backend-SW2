import { PushNotificationError } from "../services/PushNotificationService.js";

const platforms = new Set(["android", "ios", "web"]);

function validTokenBody(body) {
    return body && typeof body === "object" && !Array.isArray(body) &&
        Object.keys(body).length === 2 &&
        typeof body.token === "string" && body.token.length >= 20 &&
        body.token.length <= 4096 && !/\s/.test(body.token) &&
        platforms.has(body.platform);
}

function validRemovalBody(body) {
    return body && typeof body === "object" && !Array.isArray(body) &&
        Object.keys(body).length === 1 &&
        typeof body.token === "string" && body.token.length >= 20 &&
        body.token.length <= 4096 && !/\s/.test(body.token);
}

export function createNotificationController(service) {
    return {
        async registerDevice(req, res) {
            if (!validTokenBody(req.body)) {
                return res.status(400).json({
                    code: "DEVICE_TOKEN_INVALID",
                    message: "Los datos del dispositivo no son válidos."
                });
            }
            try {
                await service.registerDevice({
                    userId: req.user.id,
                    token: req.body.token,
                    platform: req.body.platform
                });
                return res.status(200).json({ message: "Dispositivo registrado para alertas." });
            } catch (error) {
                const code = typeof error?.code === "string" ? error.code : "DEVICE_REGISTRATION_FAILED";
                console.error("No se pudo registrar un dispositivo push.", { code });
                return res.status(503).json({
                    code: "NOTIFICATION_SERVICE_UNAVAILABLE",
                    message: "No pudimos registrar este dispositivo para alertas."
                });
            }
        },

        async removeDevice(req, res) {
            if (!validRemovalBody(req.body)) {
                return res.status(400).json({
                    code: "DEVICE_TOKEN_INVALID",
                    message: "El dispositivo indicado no es válido."
                });
            }
            try {
                await service.removeDevice({ userId: req.user.id, token: req.body.token });
                return res.status(204).end();
            } catch (error) {
                const code = typeof error?.code === "string" ? error.code : "DEVICE_REMOVAL_FAILED";
                console.error("No se pudo desactivar un dispositivo push.", { code });
                return res.status(503).json({
                    code: "NOTIFICATION_SERVICE_UNAVAILABLE",
                    message: "No pudimos desactivar las alertas de este dispositivo."
                });
            }
        }
    };
}

export function saturationErrorResponse(error, res) {
    if (error instanceof PushNotificationError) {
        return res.status(error.status).json({ code: error.code, message: error.message });
    }
    console.error("No se pudo registrar un cambio de saturación.");
    return res.status(503).json({
        code: "SATURATION_UPDATE_UNAVAILABLE",
        message: "No pudimos procesar el cambio de saturación."
    });
}
