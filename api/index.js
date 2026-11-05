import { createServerlessHandler } from "../src/runtime/serverlessHandler.js";
import { validateDeploymentEnvironment } from "../src/config/deployment.js";

export default createServerlessHandler({
    initialize: async ({ setStage }) => {
        setStage("configuration");
        validateDeploymentEnvironment();
        // Los imports con configuración/conexiones se ejecutan dentro de la
        // promesa controlada: un fallo de configuración responde 503 seguro.
        setStage("imports");
        const [{ initializeApplication }, { waitUntil }, { assertDemoApiDatabaseReady },
            { default: repository }, { createPublicAbuseMiddleware }] = await Promise.all([
            import("../app.js"),
            import("@vercel/functions"),
            import("../src/database/demoSupabaseSafety.js"),
            import("../src/repositories/PasswordRecoveryRepository.js"),
            import("../src/middlewares/publicAbuse.js")
        ]);
        setStage("readiness");
        const { app } = await initializeApplication({
            assertDatabaseReady: assertDemoApiDatabaseReady,
            deferDelivery: waitUntil,
            publicAbuseMiddleware: createPublicAbuseMiddleware({ repository }),
            maintenance: () => repository.pruneExpiredLimits()
        });
        return app;
    }
});
