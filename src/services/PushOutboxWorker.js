import PushNotificationService from "./PushNotificationService.js";

export function startPushOutboxWorker({
    service = PushNotificationService,
    intervalMs = 5000
} = {}) {
    let running = false;
    const process = async () => {
        if (running) return;
        running = true;
        try {
            await service.reconcileAll();
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
