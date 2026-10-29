import PushNotificationService from "./PushNotificationService.js";
import FcmDelivery from "./FcmDelivery.js";

export function startPushOutboxWorker({
    service = PushNotificationService,
    delivery = FcmDelivery,
    intervalMs = 5000
} = {}) {
    if (!delivery.isFcmConfigured()) {
        console.warn("FCM no está configurado; las alertas permanecerán pendientes en la cola.");
        return () => {};
    }
    let running = false;
    const process = async () => {
        if (running) return;
        running = true;
        try {
            await service.dispatchPending();
        } catch (error) {
            const code = typeof error?.code === "string" ? error.code : "PUSH_QUEUE_UNAVAILABLE";
            console.error("No se pudo procesar la cola de notificaciones push.", { code });
        } finally {
            running = false;
        }
    };
    const timer = setInterval(process, intervalMs);
    timer.unref();
    void process();
    return () => clearInterval(timer);
}
