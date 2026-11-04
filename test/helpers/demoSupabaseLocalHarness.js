import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes, X509Certificate } from "node:crypto";
import { Sequelize, QueryTypes } from "sequelize";

export const localFixture = Object.freeze({ database: "crowdradar_demo_infra_test", host: "127.0.0.1", port: 55491,
    provenance: "CrowdRadar/SW2/demo-infra-local-20261104/v1" });
const projectRef = "abcdefghijklmnopqrst";
const syntheticHost = "aws-0-us-east-1.pooler.supabase.com";

// Explicit test-only transport adapter. Never imported by application/scripts.
// No SQL goes to syntheticHost: every real socket is TLS loopback on port55491.
export async function createDemoSupabaseLocalHarness() {
    const directory = resolve(import.meta.dirname, "../../../qa/postgres");
    assert.match(directory.replaceAll("\\", "/"), /\/tmp\/cierre-demo-web-20261104\/qa\/postgres$/);
    const ca = await readFile(resolve(directory, "ca.crt"), "utf8");
    const adminPassword = await readFile(resolve(directory, "admin.pw"), "utf8");
    const privatePath = resolve(directory, "roles.private.json");
    let secrets;
    try { secrets = JSON.parse(await readFile(privatePath, "utf8")); }
    catch (error) {
        if (error.code !== "ENOENT") throw error;
        secrets = { api: randomBytes(32).toString("base64url"), migration: randomBytes(32).toString("base64url"), jwt: randomBytes(40).toString("base64url") };
        await writeFile(privatePath, JSON.stringify(secrets), { flag: "wx" });
    }
    const target = { deployment: "demo-vercel-20261104", projectRef, organizationId: "local-synthetic-org", organizationSlug: "local-synthetic",
        ownerAccountId: "local-synthetic-owner", creationEvidenceSha256: "a".repeat(64), provenanceId: "b".repeat(64),
        createdAt: "2026-11-04T12:00:00Z", verifiedAt: "2026-11-04T12:01:00Z", initialSchemas: ["auth", "public", "storage", "vault"],
        endpoints: Object.fromEntries(Object.entries({ api: "crowdradar_demo_api", migration: "crowdradar_demo_migrator", bootstrap: "postgres" })
            .map(([purpose, role]) => [purpose, { host: syntheticHost, port: purpose === "api" ? 6543 : 5432,
                username: `${role}.${projectRef}`, caSha256: new X509Certificate(ca).fingerprint256.replaceAll(":", "").toLowerCase() }])) };
    const env = { CROWDRADAR_DEPLOYMENT: target.deployment, DB_SSL: "true", DB_SSL_CA: ca,
        DEMO_API_ROLE_PASSWORD: secrets.api, DEMO_MIGRATION_ROLE_PASSWORD: secrets.migration };
    for (const [purpose, variable] of Object.entries({ api: "DATABASE_URL", migration: "MIGRATION_DATABASE_URL", bootstrap: "DEMO_BOOTSTRAP_DATABASE_URL" })) {
        env[variable] = `postgres://${target.endpoints[purpose].username}:synthetic@${syntheticHost}:${target.endpoints[purpose].port}/postgres`;
    }
    const connections = [];
    function connect(role, database = localFixture.database, sslPatch = {}) {
        const password = role === "postgres" ? adminPassword : role === "crowdradar_demo_api" ? secrets.api : secrets.migration;
        const db = new Sequelize(database, role, password, {
            dialect: "postgres", host: localFixture.host, port: localFixture.port, logging: false,
            pool: { max: 1, min: 0, idle: 1000, acquire: 3000 },
            dialectOptions: { ssl: { rejectUnauthorized: true, ca, servername: "localhost", ...sslPatch }, connectionTimeoutMillis: 5000, query_timeout: 10000 }
        });
        connections.push(db);
        return db;
    }
    const adminSystem = connect("postgres", "postgres");
    const [identity] = await adminSystem.query(`SELECT current_setting('data_directory') AS directory,
        host(inet_server_addr()) AS address, inet_server_port() AS port`, { type: QueryTypes.SELECT });
    assert.equal(identity.directory.replaceAll("\\", "/").toLowerCase(), resolve(directory, "data").replaceAll("\\", "/").toLowerCase());
    assert.equal(identity.address, localFixture.host);
    assert.equal(identity.port, localFixture.port);
    const exists = await adminSystem.query("SELECT 1 FROM pg_database WHERE datname=:name", { replacements: { name: localFixture.database }, type: QueryTypes.SELECT });
    if (!exists.length) {
        await adminSystem.query(`CREATE DATABASE ${localFixture.database}`);
        await adminSystem.query(`COMMENT ON DATABASE ${localFixture.database} IS '${localFixture.provenance}'`);
    }
    await adminSystem.close();
    const admin = connect("postgres");
    const [proof] = await admin.query("SELECT shobj_description(oid,'pg_database') AS provenance FROM pg_database WHERE datname=current_database()", { type: QueryTypes.SELECT });
    assert.equal(proof.provenance, localFixture.provenance);
    const [hasMarker] = await admin.query("SELECT to_regclass('crowdradar_demo_identity.provenance') IS NOT NULL AS ready", { type: QueryTypes.SELECT });
    if (!hasMarker.ready) {
        const existing = await admin.query("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema'", { type: QueryTypes.SELECT });
        assert.deepEqual(existing.map(row => row.nspname), ["public"]);
        // Minimal empty Supabase platform shape only in this local fixture.
        await admin.query("CREATE SCHEMA auth; CREATE TABLE auth.users(id integer); CREATE SCHEMA storage; CREATE TABLE storage.objects(id integer); CREATE TABLE storage.buckets(id integer); CREATE SCHEMA vault; CREATE TABLE vault.decrypted_secrets(secret text)");
        await admin.query("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN");
    }
    const adaptations = [];
    function adapt(real, purpose) {
        const endpoint = target.endpoints[purpose];
        const config = { database: "postgres", host: endpoint.host, port: endpoint.port, username: endpoint.username };
        const dialectOptions = { ssl: { rejectUnauthorized: true, ca, servername: endpoint.host } };
        return {
            config, options: { dialectOptions }, connectionManager: { config: { ...config, dialectOptions: structuredClone(dialectOptions) } },
            escape: value => real.escape(value), transaction: callback => real.transaction(callback),
            query: async (sql, options) => {
                const replacements = {
                    "REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC": `REVOKE CREATE,TEMPORARY ON DATABASE ${localFixture.database} FROM PUBLIC`,
                    "GRANT CONNECT ON DATABASE postgres TO crowdradar_demo_api,crowdradar_demo_migrator": `GRANT CONNECT ON DATABASE ${localFixture.database} TO crowdradar_demo_api,crowdradar_demo_migrator`
                };
                const adapted = replacements[sql] ?? sql;
                if (adapted !== sql && !adaptations.includes(sql)) adaptations.push(sql);
                const result = await real.query(adapted, options);
                if (sql.includes("current_database() AS database")) {
                    for (const row of result) {
                        assert.equal(row.database, localFixture.database);
                        row.database = "postgres";
                    }
                    if (!adaptations.includes("current_database() AS database: fixture name -> postgres")) adaptations.push("current_database() AS database: fixture name -> postgres");
                }
                return result;
            }
        };
    }
    const apiEnvironment = { NODE_ENV: "test", DB_NAME: localFixture.database, DB_HOST: localFixture.host, DB_PORT: String(localFixture.port),
        DB_USER: "crowdradar_demo_api", DB_PASSWORD: secrets.api, DB_SSL: "true", DB_SSL_CA: ca,
        JWT_SECRET: secrets.jwt, DB_POOL_MAX: "1", DB_POOL_MIN: "0", DB_POOL_ACQUIRE_MS: "3000", PUSH_WORKER_ENABLED: "false", CORS_ORIGINS: "http://127.0.0.1:5557" };
    await writeFile(resolve(directory, "runtime.env"), Object.entries(apiEnvironment).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n"));
    return { target, env, directory, ca, admin, initialized: hasMarker.ready, adaptations, connect, adapt,
        async close() { for (const db of connections) if (!db.connectionManager.closed) await db.close(); } };
}
