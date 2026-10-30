import PushNotificationRepository from "../repositories/PushNotificationRepository.js";
import FcmDelivery from "./FcmDelivery.js";

export class PushNotificationError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export class PushNotificationService {
    constructor({ repository = PushNotificationRepository, delivery = FcmDelivery } = {}) {
        this.repository = repository;
        this.delivery = delivery;
    }

    async registerDevice({ userId, token, platform }) {
        return this.repository.registerDevice({ userId, token, platform });
    }

    async removeDevice({ userId, token }) {
        return this.repository.removeDevice({ userId, token });
    }

    async applySaturation({ placeId, level }) {
        if (!Number.isSafeInteger(placeId)) {
            throw new PushNotificationError(400, "PLACE_INVALID", "El lugar indicado no es válido.");
        }
        if (typeof level !== "string" || !level.trim() || level.trim().length > 50) {
            throw new PushNotificationError(400, "SATURATION_LEVEL_INVALID", "El nivel de saturación no es válido.");
        }
        const result = await this.repository.applySaturation({ placeId, level: level.trim() });
        if (result.kind === "PLACE_NOT_FOUND") {
            throw new PushNotificationError(404, "PLACE_NOT_FOUND", "No encontramos ese lugar.");
        }
        if (result.kind === "INITIALIZED") {
            return { changed: false, initialized: true };
        }
        if (result.kind === "UNCHANGED") return { changed: false, initialized: false };
        if (result.kind !== "CHANGED") {
            throw new Error("Resultado de actualización de saturación inesperado.");
        }
        return {
            changed: true,
            previousLevel: result.previousLevel,
            newLevel: level.trim()
        };
    }

    async dispatchPending() {
        if (!this.delivery.isFcmConfigured()) return { configured: false, sent: 0 };
        const pending = await this.repository.claimPending();
        let sent = 0;
        for (const notification of pending) {
            try {
                await this.delivery.send({
                    fid: notification.token,
                    notification: {
                        title: "Cambió la saturación de un lugar favorito",
                        body: `${notification.placeName}: ${notification.previousLevel} → ${notification.newLevel}`
                    },
                    data: {
                        placeId: String(notification.placeId),
                        previousLevel: notification.previousLevel,
                        newLevel: notification.newLevel
                    },
                    android: { priority: "high" }
                });
                await this.repository.markDelivered(notification.id);
                sent++;
            } catch (error) {
                if (this.delivery.isInvalidTokenError(error)) {
                    await this.repository.removeDeviceById(notification.deviceTokenId);
                    continue;
                }
                const code = typeof error?.code === "string" ? error.code.slice(0, 80) : "PUSH_DELIVERY_FAILED";
                await this.repository.markFailed(notification.id, notification.attempts, code);
                console.error("No se pudo entregar una notificación push.", { code });
            }
        }
        return { configured: true, sent };
    }
}

export default new PushNotificationService();
