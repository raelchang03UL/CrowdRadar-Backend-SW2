// Identidad NO secreta del único proyecto nuevo autorizado por Rael. Evidencia
// Dashboard de creación/titular y preflight SQL READ ONLY del04/11/2026.
// La fecha observada no es un timestamp de creación publicado por el proveedor.
// Este perfil no acredita bootstrap, migraciones, grants ni catálogo aplicados.
const host = "aws-0-us-east-1.pooler.supabase.com";
const projectRef = "ycxuhejpehmdfbvdplpl";
const caSha256 = "807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa";
export const demoSupabaseTarget = Object.freeze({
    deployment: "demo-vercel-20261104", projectRef, projectName: "crowdradar-demo-web",
    organizationId: "uuvuyytnogzwbgikwdyy", organizationName: "CrowdRadar Rael",
    ownerAccountEmail: "raelchang03@gmail.com", creationEvidenceKind: "dashboard-observed-creation",
    observedCreationAt: "2026-11-04T21:44:57.000Z", verifiedAt: "2026-11-04T21:50:37.245Z",
    creationEvidenceSha256: "b17e91771b65d68d1e5a971e6dd215e550ffa6d5c333e9193bd70838101da68e",
    provenanceId: "9b3392c347071f6272cf401bf7563b88fc578b26b679de1a2f4d2db2a51d0cc1",
    initialSchemas: Object.freeze(["auth", "extensions", "graphql", "graphql_public", "public", "realtime", "storage", "vault"]),
    endpoints: Object.freeze({
        api: Object.freeze({ host, port: 6543, username: `crowdradar_demo_api.${projectRef}`, caSha256 }),
        migration: Object.freeze({ host, port: 5432, username: `crowdradar_demo_migrator.${projectRef}`, caSha256 }),
        bootstrap: Object.freeze({ host, port: 5432, username: `postgres.${projectRef}`, caSha256 })
    })
});
