// No importa la app ni crea conexiones al cargar el entrypoint. Una sola promesa
// comparte el arranque entre solicitudes concurrentes de la misma instancia.
export function createServerlessHandler({ initialize, now = Date.now, retryAfterMs = 5000,
    log = () => console.error("CrowdRadar no está listo para atender solicitudes.") }) {
    let initPromise;
    let retryAt = 0;
    let failed = false;

    function ready() {
        if (failed && now() >= retryAt) initPromise = undefined;
        if (!initPromise) {
            failed = false;
            initPromise = Promise.resolve().then(initialize).catch(error => {
                failed = true;
                retryAt = now() + retryAfterMs;
                log(); // No mensaje, URL, credencial ni stack del error original.
                throw error;
            });
        }
        return initPromise;
    }

    return async (req, res) => {
        let app;
        try { app = await ready(); }
        catch {
            res.statusCode = 503;
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Retry-After", String(Math.ceil(retryAfterMs / 1000)));
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "No se pudo completar la solicitud. Inténtalo de nuevo." }));
            return;
        }
        return app(req, res);
    };
}
