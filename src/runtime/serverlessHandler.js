// No importa la app ni crea conexiones al cargar el entrypoint. Una sola promesa
// comparte el arranque entre solicitudes concurrentes de la misma instancia.
const stages = new Set(["initialize", "configuration", "imports", "readiness"]);
const codes = new Set([
    "CONFIG_INVALID", "SCHEMA_NOT_READY", "MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND",
    "ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_REQUIRE_ESM", "ERR_DLOPEN_FAILED",
    "DEMO_DEPLOYMENT_REQUIRED", "DEMO_DEPLOYMENT_UNKNOWN", "DEMO_TARGET_UNVERIFIED",
    "DEMO_CONNECTION_INVALID", "DEMO_ROLE_INVALID", "DEMO_TLS_INVALID", "DEMO_CONNECTION_MISMATCH",
    "DEMO_DATABASE_IDENTITY_INVALID", "DEMO_DATABASE_ROLE_EXCESSIVE", "DEMO_PROVENANCE_INVALID",
    "DEMO_PROVENANCE_UNPROTECTED", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
    "CERT_HAS_EXPIRED", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "DEPTH_ZERO_SELF_SIGNED_CERT", "ERR_TLS_CERT_ALTNAME_INVALID", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
    "28P01", "42501", "53300", "3D000", "42P01", "57P03", "08001", "08006"
]);
const errorTypes = new Set(["Error", "TypeError", "ReferenceError", "SyntaxError",
    "SequelizeConnectionError", "SequelizeConnectionRefusedError", "SequelizeConnectionAcquireTimeoutError",
    "SequelizeHostNotFoundError", "SequelizeHostNotReachableError", "SequelizeInvalidConnectionError",
    "SequelizeAccessDeniedError", "SequelizeDatabaseError", "SequelizeConnectionTimedOutError"]);

export function safeInitializationDiagnostic(error, stage) {
    // Sequelize replaces MODULE_NOT_FOUND with this fixed message. Never echo a
    // message, even if it merely resembles a recognized dependency failure.
    const missingPg = error?.message === "Please install pg package manually";
    const causeCode = [error?.original?.code, error?.parent?.code, error?.cause?.code]
        .find(value => codes.has(value));
    return { event: "crowdradar_initialization_failed", stage: stages.has(stage) ? stage : "initialize",
        errorType: errorTypes.has(error?.name) ? error.name : "UNKNOWN",
        code: missingPg ? "DEPENDENCY_PG_MISSING" : codes.has(error?.code) ? error.code : "UNKNOWN",
        ...(causeCode ? { causeCode } : {}) };
}

export function createServerlessHandler({ initialize, now = Date.now, retryAfterMs = 5000,
    log = diagnostic => console.error(JSON.stringify(diagnostic)) }) {
    let initPromise;
    let retryAt = 0;
    let failed = false;

    function ready() {
        if (failed && now() >= retryAt) initPromise = undefined;
        if (!initPromise) {
            failed = false;
            let stage = "initialize";
            const setStage = value => { stage = stages.has(value) ? value : "initialize"; };
            initPromise = Promise.resolve().then(() => initialize({ setStage })).catch(error => {
                failed = true;
                retryAt = now() + retryAfterMs;
                log(safeInitializationDiagnostic(error, stage));
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
