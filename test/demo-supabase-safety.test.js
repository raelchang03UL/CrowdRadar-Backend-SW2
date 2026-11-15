import test from "node:test";
import assert from "node:assert/strict";
import { rootCertificates } from "node:tls";
import { X509Certificate } from "node:crypto";
import { demoDatabaseConfiguration, demoDeployment, demoRoles, isDemoDeployment } from "../src/config/demoSupabaseEnvironment.js";
import { assertDemoDatabaseIdentity, assertDemoInitialEmpty, assertDemoProvenance } from "../src/database/demoSupabaseSafety.js";
import { assertMigrationTarget, authorizeDemoMigration, assertHu8QaDatabase, assertDemoLocalDatabase } from "../src/database/databaseSafety.js";
import { createDemoMigrationGate } from "../src/database/demoMigrationGate.js";
import { provisionDemoSupabase } from "../src/database/provisionDemoSupabase.js";

const ca = rootCertificates[0]; // Public trust anchor, never a private key.
const fingerprint = new X509Certificate(ca).fingerprint256.replaceAll(":", "").toLowerCase();
const ref = "abcdefghijklmnopqrst";
const host = "aws-0-us-east-1.pooler.supabase.com";
const target = {
    deployment: demoDeployment, projectRef: ref, organizationId: "synthetic-organization", organizationName: "synthetic-org",
    ownerAccountEmail: "synthetic-owner@example.test", observedCreationAt: "2026-11-04T12:00:00Z", verifiedAt: "2026-11-04T12:01:00Z",
    creationEvidenceKind: "dashboard-observed-creation",
    initialSchemas: ["public", "auth", "storage"],
    creationEvidenceSha256: "a".repeat(64), provenanceId: "b".repeat(64),
    endpoints: Object.fromEntries(Object.entries(demoRoles).map(([purpose, role]) => [purpose,
        { host, port: purpose === "api" ? 6543 : 5432, username: `${role}.${ref}`, caSha256: fingerprint }]))
};
function environment() {
    const env = { CROWDRADAR_DEPLOYMENT: demoDeployment, DB_SSL: "true", DB_SSL_CA: ca };
    for (const [purpose, key] of Object.entries({ api: "DATABASE_URL", migration: "MIGRATION_DATABASE_URL", bootstrap: "DEMO_BOOTSTRAP_DATABASE_URL" })) {
        env[key] = `postgresql://${target.endpoints[purpose].username}:synthetic-test-password@${host}:${target.endpoints[purpose].port}/postgres`;
    }
    return env;
}
function connection(purpose = "api") {
    const env = environment();
    const config = demoDatabaseConfiguration(env, purpose, target);
    const identity = { database: "postgres", role: demoRoles[purpose], session_role: demoRoles[purpose], ssl: true,
        rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolreplication: false, rolbypassrls: false,
        member_of_role: false, database_create: false, database_temp: false, schema_create: purpose !== "api", owns_relation: purpose !== "api" };
    const provenance = { deployment: target.deployment, project_ref: ref, organization_id: target.organizationId,
        owner_account_id: target.ownerAccountEmail, creation_evidence_sha256: target.creationEvidenceSha256,
        provenance_id: target.provenanceId, initial_public_empty: true, created_at: target.observedCreationAt };
    const permissions = { owner: "postgres", schema_owner: "postgres", can_change: purpose === "bootstrap", can_change_column: purpose === "bootstrap", can_create: purpose === "bootstrap" };
    const queries = [];
    const db = {
        config: { database: config.database, username: config.username, host: config.options.host, port: config.options.port },
        options: config.options, connectionManager: { config: { host, port: config.options.port, username: config.username, database: "postgres", dialectOptions: structuredClone(config.options.dialectOptions) } },
        query: async sql => {
            queries.push(sql);
            if (sql.includes("current_database() AS database")) return [identity];
            if (sql.includes("FROM crowdradar_demo_identity.provenance")) return [provenance];
            if (sql.includes("AS can_change")) return [permissions];
            if (sql.includes("AS existing_data")) return [{ existing_data: false }];
            if (sql.includes("AS initial_schema")) return target.initialSchemas.map(initial_schema => ({ initial_schema }));
            return [];
        }
    };
    return { db, env, identity, provenance, permissions, queries };
}

test("missing identity and environment attempts to select another project fail before any SQL", async () => {
    const { db, env, queries } = connection("migration");
    assert.throws(() => demoDatabaseConfiguration(env, "api", null), /DEMO_TARGET_UNVERIFIED/);
    assert.throws(() => demoDatabaseConfiguration({ ...env, DEMO_PROJECT_REF: ref, DEMO_ALLOW_SUPABASE: "true" }), /DEMO_CONNECTION_INVALID/);
    await assert.rejects(authorizeDemoMigration(db, env), /DEMO_CONNECTION_INVALID/);
    assert.throws(() => assertMigrationTarget(db), /Destino protegido/);
    assert.equal(queries.length, 0);
    assert.throws(() => isDemoDeployment({ VERCEL: "1" }), /DEMO_DEPLOYMENT_REQUIRED/);
    assert.throws(() => isDemoDeployment({ CROWDRADAR_DEPLOYMENT: "other" }), /DEMO_DEPLOYMENT_UNKNOWN/);
});

test("exact verified identity selects distinct roles and verifies CA/hostname with a bounded pool", () => {
    for (const purpose of Object.keys(demoRoles)) {
        const selected = demoDatabaseConfiguration(environment(), purpose, target);
        assert.equal(selected.username, target.endpoints[purpose].username);
        assert.equal(selected.database, "postgres");
        assert.equal(selected.options.dialectOptions.ssl.rejectUnauthorized, true);
        assert.equal(selected.options.dialectOptions.ssl.servername, host);
        assert.deepEqual(selected.options.pool, { max: 1, min: 0, idle: 1000, acquire: 10000, evict: 1000 });
    }
});

test("hostname similarity, old project, wrong organization provenance, TLS downgrade and URL overrides cannot authorize", () => {
    const env = environment();
    for (const url of [
        env.DATABASE_URL.replace(ref, "zyxwvutsrqponmlkjihg"),
        env.DATABASE_URL.replace(host, "db.abcdefghijklmnopqrst.supabase.co"),
        env.DATABASE_URL.replace(host, `${host}.attacker.test`),
        env.DATABASE_URL.replace(":6543/", ":5432/"),
        env.DATABASE_URL.replace("/postgres", "/crowdradar_sprint1"),
        env.DATABASE_URL.replace("crowdradar_demo_api", "postgres"),
        `${env.DATABASE_URL}?sslmode=disable`, `${env.DATABASE_URL}?ssl=false`, `${env.DATABASE_URL}#ignored`
    ]) assert.throws(() => demoDatabaseConfiguration({ ...env, DATABASE_URL: url }, "api", target), /DEMO_CONNECTION_INVALID/);
    for (const value of [undefined, "false"]) assert.throws(() => demoDatabaseConfiguration({ ...env, DB_SSL: value }, "api", target), /DEMO_CONNECTION_INVALID/);
    for (const value of [undefined, "not a certificate", `${ca}\n${ca}`, rootCertificates[1]]) {
        assert.throws(() => demoDatabaseConfiguration({ ...env, DB_SSL_CA: value }, "api", target), /DEMO_TLS_INVALID/);
    }
    for (const patch of [{ organizationId: "" }, { organizationName: "" }, { ownerAccountEmail: "" }, { creationEvidenceKind: "provider-created-at" },
        { creationEvidenceSha256: "" }, { observedCreationAt: "2026-10-01T00:00:00Z" }, { observedCreationAt: undefined },
        { observedCreationAt: "2026-11-04T12:02:00Z" }]) {
        assert.throws(() => demoDatabaseConfiguration(env, "api", { ...target, ...patch }), /DEMO_TARGET_UNVERIFIED/);
    }
});

test("observed creation evidence does not require or substitute a provider creation timestamp", () => {
    assert.equal(Object.hasOwn(target, "createdAt"), false);
    assert.doesNotThrow(() => demoDatabaseConfiguration(environment(), "api", target));
    assert.throws(() => demoDatabaseConfiguration(environment(), "api", { ...target,
        observedCreationAt: undefined, createdAt: "2026-11-04T12:00:00Z" }), /DEMO_TARGET_UNVERIFIED/);
});

test("API read-only guard accepts matching identity/provenance and executes no DDL", async () => {
    const { db, env, queries } = connection();
    await assertDemoProvenance(db, env, "api", target);
    assert.equal(queries.length, 3);
    assert.ok(queries.every(sql => sql.startsWith("SELECT ")));
});

test("guard rejects manager-only target changes and custom TLS verifiers before SQL", async () => {
    for (const change of [db => { db.connectionManager.config.database = "other"; },
        db => { db.connectionManager.config.host = "other.supabase.co"; },
        db => { db.connectionManager.config.dialectOptions.ssl.rejectUnauthorized = false; },
        db => { db.options.dialectOptions.ssl.checkServerIdentity = () => undefined; }]) {
        const { db, env, queries } = connection();
        change(db);
        await assert.rejects(assertDemoDatabaseIdentity(db, env, "api", target), /DEMO_CONNECTION_MISMATCH/);
        assert.equal(queries.length, 0);
    }
});

test("API rejects wrong DB/session, privileged roles, ownership, role membership, plaintext and schema CREATE", async () => {
    for (const patch of [{ database: "other" }, { role: "postgres" }, { session_role: "postgres" }, { ssl: false },
        ...["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls", "member_of_role", "database_create", "database_temp", "schema_create", "owns_relation"].map(key => ({ [key]: true }))]) {
        const { db, env, identity } = connection();
        Object.assign(identity, patch);
        await assert.rejects(assertDemoDatabaseIdentity(db, env, "api", target), /DEMO_DATABASE_/);
    }
});

test("provenance cannot be copied from another project/organization or modified by the API", async () => {
    for (const key of ["deployment", "project_ref", "organization_id", "owner_account_id", "creation_evidence_sha256", "provenance_id", "created_at"]) {
        const { db, env, provenance } = connection();
        provenance[key] = key === "created_at" ? "2026-10-01T00:00:00Z" : "other";
        await assert.rejects(assertDemoProvenance(db, env, "api", target), /DEMO_PROVENANCE_INVALID/);
    }
    for (const patch of [{ owner: demoRoles.api }, { schema_owner: demoRoles.migration }, { can_change: true }, { can_change_column: true }, { can_create: true }]) {
        const { db, env, permissions } = connection();
        Object.assign(permissions, patch);
        await assert.rejects(assertDemoProvenance(db, env, "api", target), /DEMO_PROVENANCE_UNPROTECTED/);
    }
});

test("new project preflight proves empty public/auth/storage before any DDL", async () => {
    const { db, env, queries } = connection("bootstrap");
    await assertDemoInitialEmpty(db, env, target);
    assert.ok(queries.every(sql => sql.startsWith("SELECT ")));
    for (const kind of ["public", "auth/storage"]) {
        const item = connection("bootstrap");
        const query = item.db.query;
        item.db.query = async sql => kind === "public" && sql.includes("SELECT c.relname") ? [{ name: "existing" }]
            : kind === "auth/storage" && sql.includes("AS existing_data") ? [{ existing_data: true }] : query(sql);
        await assert.rejects(assertDemoInitialEmpty(item.db, item.env, target), /DEMO_INITIAL_DATABASE_NOT_EMPTY/);
    }
});

test("bootstrap stops before any schema/role mutation if initial-empty verification fails", async () => {
    const { db, env, queries } = connection("bootstrap");
    env.DEMO_API_ROLE_PASSWORD = "api-password-for-synthetic-testing-only";
    env.DEMO_MIGRATION_ROLE_PASSWORD = "migration-password-for-synthetic-testing-only";
    db.transaction = async callback => callback({});
    const query = db.query;
    db.query = async sql => sql.includes("SELECT c.relname") ? [{ name: "existing" }] : query(sql);
    await assert.rejects(provisionDemoSupabase(db, env, target), /DEMO_INITIAL_DATABASE_NOT_EMPTY/);
    assert.ok(queries.every(sql => sql.startsWith("SELECT ")));
});

test("capability requires verified provenance, is untransferable, expires, and dies after config/manager changes", async () => {
    let clock = 0;
    const gate = createDemoMigrationGate((db, env) => assertDemoProvenance(db, env, "migration", target), () => clock);
    const { db, env } = connection("migration");
    assert.equal(gate.permits(db), false);
    await gate.authorize(db, env);
    assert.equal(gate.permits(db), true);
    assert.equal(gate.permits(connection("migration").db), false);
    clock = 300000;
    assert.equal(gate.permits(db), false);
    for (const key of ["host", "database", "username", "port"]) {
        clock = 0;
        await gate.authorize(db, env);
        const original = db.config[key];
        db.config[key] = "other";
        assert.equal(gate.permits(db), false);
        db.config[key] = original;
        assert.equal(gate.permits(db), false);
    }
    await gate.authorize(db, env);
    db.connectionManager = { ...db.connectionManager };
    assert.equal(gate.permits(db), false);
    await gate.authorize(db, env);
    db.connectionManager.config.database = "crowdradar_sprint1";
    assert.equal(gate.permits(db), false);
    db.connectionManager.config.database = "postgres";
    await gate.authorize(db, env);
    db.connectionManager.config.dialectOptions.ssl.rejectUnauthorized = false;
    assert.equal(gate.permits(db), false);
    const bad = connection("migration");
    bad.provenance.project_ref = "other";
    await assert.rejects(gate.authorize(bad.db, bad.env), /DEMO_PROVENANCE_INVALID/);
    assert.equal(gate.permits(bad.db), false);
    const racing = connection("migration");
    const racingGate = createDemoMigrationGate(async db => { db.connectionManager.config.database = "other"; });
    await assert.rejects(racingGate.authorize(racing.db, racing.env), /DEMO_CONNECTION_CHANGED/);
    assert.equal(racingGate.permits(racing.db), false);
});

test("all historical protected destinations and local QA fixture boundaries remain closed", () => {
    for (const config of [{ database: "crowdradar_sprint1", host: "localhost" },
        { database: "postgres", host: "localhost" }, { database: "template0", host: "localhost" },
        { database: "template1", host: "localhost" }, { database: "custom", host: "db.old.supabase.co" },
        { database: "custom", host: "aws-0-us-east-1.pooler.supabase.com" }]) {
        assert.throws(() => assertMigrationTarget({ config }), /Destino protegido/);
        assert.throws(() => assertHu8QaDatabase({ config }));
        assert.throws(() => assertDemoLocalDatabase({ config }));
    }
});
