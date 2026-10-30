import { evaluateSaturation } from "./SaturationQueryService.js";
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
    async registerDevice(value) {
        return this.repository.registerDevice(value);
    }
    async removeDevice(value) {
        return this.repository.removeDevice(value);
    }
    async reconcilePlace({ placeId }) {
        if (!Number.isInteger(placeId) || placeId === 0 || placeId < -2147483648 || placeId > 2147483647) {
            throw new PushNotificationError(400, "PLACE_INVALID", "El lugar indicado no es válido.");
        }
        const result = await this.repository.reconcilePlace({ placeId, evaluate: evaluateSaturation });
        if (result.kind === "PLACE_NOT_FOUND") throw new PushNotificationError(404, "PLACE_NOT_FOUND", "No encontramos ese lugar.");
        if (result.kind === "INITIALIZED") return { changed: false, initialized: true };
        if (result.kind === "UNCHANGED") return { changed: false, initialized: false };
        if (result.kind !== "CHANGED") throw new Error("Resultado de saturación inesperado.");
        return { changed: true, previousLevel: result.previousLevel, newLevel: result.level };
    }
    async reconcileAll() {
        let afterId = -2147483649;
        let evaluated = 0;
        while (true) {
            const ids = await this.repository.findReconciliationIds(afterId);
            if (!ids.length) return { evaluated };
            for (const placeId of ids) { await this.reconcilePlace({ placeId }); evaluated++; }
            afterId = ids.at(-1);
        }
    }
    async dispatchPending() {
        if (!this.delivery.isFcmConfigured()) return { configured: false, sent: 0 };
        const pending = await this.repository.claimPending();
        let sent = 0;
        for (const notification of pending) {
            try {
                if (!await this.repository.isEligible(notification)) continue;
                await this.delivery.send({
                    fid: notification.token,
                    ...(notification.platform === "web" ? {} : { notification: {
                        title: "Cambió la saturación de un lugar favorito",
                        body: "Abre CrowdRadar para consultar las novedades de tus favoritos."
                    } }),
                    data: {
                        placeId: String(notification.placeId),
                        userId: String(notification.userId),
                        sessionVersion: String(notification.sessionVersion),
                        registrationId: notification.registrationId,
                        previousLevel: notification.previousLevel,
                        newLevel: notification.newLevel
                    },
                    android: { priority: "high" }
                });
                await this.repository.markDelivered(notification.id, notification.attempts);
                sent++;
            } catch (error) {
                if (this.delivery.isInvalidTokenError(error)) {
                    await this.repository.removeDeviceById(notification.deviceTokenId, notification.registrationId);
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
