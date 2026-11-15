import { X509Certificate } from "node:crypto";
import { demoSupabaseTarget } from "./demoSupabaseTarget.js";

export const demoDeployment = "demo-vercel-20261104";
export const demoRoles = Object.freeze({ api: "crowdradar_demo_api", migration: "crowdradar_demo_migrator", bootstrap: "postgres" });
const fail = code => { throw Object.assign(new Error(code), { code }); };

export function isDemoDeployment(env = process.env) {
    if (env.VERCEL && env.CROWDRADAR_DEPLOYMENT !== demoDeployment) fail("DEMO_DEPLOYMENT_REQUIRED");
    if (env.CROWDRADAR_DEPLOYMENT && env.CROWDRADAR_DEPLOYMENT !== demoDeployment) fail("DEMO_DEPLOYMENT_UNKNOWN");
    return env.CROWDRADAR_DEPLOYMENT === demoDeployment;
}

export function requireVerifiedDemoTarget(target = demoSupabaseTarget) {
    if (!target || target.deployment !== demoDeployment || !/^[a-z]{20}$/.test(target.projectRef ?? "") ||
        !target.organizationId || !target.organizationName || !target.ownerAccountEmail ||
        target.creationEvidenceKind !== "dashboard-observed-creation" ||
        !/^[a-f0-9]{64}$/.test(target.creationEvidenceSha256 ?? "") ||
        !/^[a-f0-9]{64}$/.test(target.provenanceId ?? "") ||
        !Array.isArray(target.initialSchemas) || !["public", "auth", "storage"].every(name => target.initialSchemas.includes(name)) ||
        target.initialSchemas.some(name => !/^[a-z][a-z0-9_]*$/.test(name) || name.startsWith("pg_") || name === "information_schema" || name === "crowdradar_demo_identity") ||
        new Set(target.initialSchemas).size !== target.initialSchemas.length ||
        !Number.isFinite(Date.parse(target.observedCreationAt)) || Date.parse(target.observedCreationAt) < Date.parse("2026-11-04T00:00:00Z") ||
        !Number.isFinite(Date.parse(target.verifiedAt)) || Date.parse(target.verifiedAt) < Date.parse(target.observedCreationAt)) {
        fail("DEMO_TARGET_UNVERIFIED");
    }
    for (const purpose of ["api", "migration", "bootstrap"]) {
        const endpoint = target.endpoints?.[purpose];
        const direct = endpoint?.host === `db.${target.projectRef}.supabase.co`;
        const pooler = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(endpoint?.host ?? "");
        if (!endpoint || (!direct && !pooler) ||
            endpoint.username !== `${demoRoles[purpose]}${pooler ? `.${target.projectRef}` : ""}` ||
            endpoint.port !== (purpose === "api" ? 6543 : 5432) || (purpose === "api" && !pooler) ||
            !/^[a-f0-9]{64}$/.test(endpoint.caSha256 ?? "")) fail("DEMO_TARGET_UNVERIFIED");
    }
    return target;
}

// target is injectable for unit tests only. Production callers never read a
// target from process.env, URLs, files selected by the caller, or request data.
export function demoDatabaseConfiguration(env = process.env, purpose = "api", target = demoSupabaseTarget) {
    if (!isDemoDeployment(env)) fail("DEMO_DEPLOYMENT_REQUIRED");
    requireVerifiedDemoTarget(target);
    if (!Object.hasOwn(demoRoles, purpose)) fail("DEMO_ROLE_INVALID");
    const key = { api: "DATABASE_URL", migration: "MIGRATION_DATABASE_URL", bootstrap: "DEMO_BOOTSTRAP_DATABASE_URL" }[purpose];
    let url;
    try { url = new URL(env[key]); } catch { fail("DEMO_CONNECTION_INVALID"); }
    const endpoint = target.endpoints[purpose];
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== endpoint.host ||
        Number(url.port || 5432) !== endpoint.port || url.pathname !== "/postgres" ||
        decodeURIComponent(url.username) !== endpoint.username || !url.password || url.search || url.hash || env.DB_SSL !== "true") {
        fail("DEMO_CONNECTION_INVALID");
    }
    const ca = env.DB_SSL_CA?.replace(/\\n/g, "\n");
    let fingerprint;
    try {
        if ((ca?.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length !== 1) fail("DEMO_TLS_INVALID");
        const certificate = new X509Certificate(ca);
        if (!certificate.ca) fail("DEMO_TLS_INVALID");
        fingerprint = certificate.fingerprint256.replaceAll(":", "").toLowerCase();
    } catch { fail("DEMO_TLS_INVALID"); }
    if (fingerprint !== endpoint.caSha256) fail("DEMO_TLS_INVALID");
    return {
        database: "postgres", username: endpoint.username, password: decodeURIComponent(url.password),
        options: {
            dialect: "postgres", host: endpoint.host, port: endpoint.port, logging: false,
            // One connection per warm instance; deliberately conservative for the
            // free demo. This is not a fleet-wide cap or a throughput guarantee.
            pool: { max: 1, min: 0, idle: 1000, acquire: 10000, evict: 1000 },
            dialectOptions: { ssl: { rejectUnauthorized: true, ca, servername: endpoint.host },
                connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 20000,
                application_name: `crowdradar-demo-${purpose}` }
        }
    };
}
