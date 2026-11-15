import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { QueryTypes } from "sequelize";
import { rootCertificates } from "node:tls";
import { createDemoSupabaseLocalHarness } from "./helpers/demoSupabaseLocalHarness.js";

test("demo SQL in exclusive local PostgreSQL fixture (never Supabase)", { skip: process.env.CROWDRADAR_DEMO_SQL_QA !== "local-20261104" }, async t => {
    const qa = await createDemoSupabaseLocalHarness();
    t.after(() => qa.close());
    mock.module(new URL("../src/config/demoSupabaseTarget.js", import.meta.url).href, { namedExports: { demoSupabaseTarget: qa.target } });
    const safety = await import("../src/database/demoSupabaseSafety.js");
    const provision = await import("../src/database/provisionDemoSupabase.js");
    const guards = await import("../src/database/databaseSafety.js");
    const evidence = { fixture: "crowdradar_demo_infra_test", port: 55491, tls: "local CA verified", supabaseIdentityVerified: false, blocks: [] };
    const select = (db, sql) => db.query(sql, { type: QueryTypes.SELECT });
    const denied = async (db, sql) => {
        await assert.rejects(db.query(sql), error => ["42501", "28000"].includes(error.original?.code));
    };
    async function block(name, operation, skip = false) {
        if (skip) evidence.blocks.push({ name, skipped: true, reason: "Fresh bootstrap recorded in the preserved initial run." });
        await t.test(name, { skip }, async () => {
            try { await operation(); evidence.blocks.push({ name, passed: true }); }
            catch (error) {
                evidence.blocks.push({ name, passed: false, code: error.original?.code ?? error.code ?? error.name });
                // Database exceptions may contain SQL/passwords. Keep the useful
                // SQLSTATE and block name; never emit raw connection/error data.
                throw new Error(`LOCAL_SQL_BLOCK_FAILED ${name}: ${error.original?.code ?? error.code ?? error.name}`);
            }
        });
    }
    const admin = qa.adapt(qa.admin, "bootstrap");
    await block("initial empty gate rejects unknown schema and pre-existing public object", async () => {
        await qa.admin.query("CREATE SCHEMA unexpected_qa_schema");
        await assert.rejects(safety.assertDemoInitialEmpty(admin, qa.env), /DEMO_INITIAL_SCHEMA_UNKNOWN/);
        await qa.admin.query("DROP SCHEMA unexpected_qa_schema");
        await qa.admin.query("CREATE TABLE public.unexpected_qa_table(id integer)");
        await assert.rejects(safety.assertDemoInitialEmpty(admin, qa.env), /DEMO_INITIAL_DATABASE_NOT_EMPTY/);
        await qa.admin.query("DROP TABLE public.unexpected_qa_table");
        await safety.assertDemoInitialEmpty(admin, qa.env);
    }, qa.initialized);
    await block("explicit bootstrap creates separate roles and protected provenance", async () => {
        if (!qa.initialized) await provision.provisionDemoSupabase(admin, qa.env);
        await assert.rejects(provision.provisionDemoSupabase(admin, qa.env), /DEMO_INITIAL_SCHEMA_UNKNOWN|DEMO_INITIAL_DATABASE_NOT_EMPTY/);
    });
    const migratorReal = qa.connect("crowdradar_demo_migrator");
    const migrator = qa.adapt(migratorReal, "migration");
    const apiReal = qa.connect("crowdradar_demo_api");
    const api = qa.adapt(apiReal, "api");
    await block("001–012 canonical migrations apply, repeat without change, and bind capability to connection", async () => {
        await safety.assertDemoProvenance(migrator, qa.env, "migration");
        await guards.authorizeDemoMigration(migrator, qa.env);
        const entries = [["migratePlaces", "migratePlaces"], ["migrateAuth", "migrateAuth"], ["migrateRecovery", "migrateRecovery"],
            ["migratePlaceDetails", "migratePlaceDetails"], ["migrateReportCompatibility", "migrateReportCompatibility"],
            ["migrateKarma", "migrateKarma"], ["migrateValidation", "migrateValidation"], ["migrateUserModeration", "migrateUserModeration"],
            ["migrateReportModeration", "migrateReportModeration"], ["migrateFavorites", "migrateFavorites"],
            ["migrateSaturationAlerts", "migrateSaturationAlerts"], ["migratePushTargetTypes", "migratePushTargetTypes"]];
        for (const [file, name] of entries) {
            guards.assertMigrationTarget(migrator);
            await (await import(`../src/database/${file}.js`))[name](migrator);
        }
        const before = await select(migratorReal, "SELECT name,applied_at FROM public.crowdradar_migrations ORDER BY name");
        assert.equal(before.length, 13); // Two historic 004 names are distinct.
        for (const [file, name] of entries) {
            guards.assertMigrationTarget(migrator);
            assert.equal(await (await import(`../src/database/${file}.js`))[name](migrator), false);
        }
        assert.deepEqual(await select(migratorReal, "SELECT name,applied_at FROM public.crowdradar_migrations ORDER BY name"), before);
        guards.revokeDemoMigrationAuthorization(migrator);
        assert.throws(() => guards.assertMigrationTarget(migrator), /Destino protegido/);
    });
    await block("explicit grants and idempotent catalog preserve runtime least privilege", async () => {
        await provision.grantDemoApiPermissions(migrator, qa.env);
        await provision.seedDemoSupabaseCatalog(migrator, qa.env);
        assert.deepEqual(await provision.seedDemoSupabaseCatalog(migrator, qa.env), { inserted: 0, unchanged: 5 });
        await safety.assertDemoProvenance(api, qa.env, "api");
    });
    await block("API and migrator cannot create database/roles or mutate protected provenance", async () => {
        for (const db of [apiReal, migratorReal]) {
            for (const sql of ["CREATE DATABASE qa_forbidden_db", "CREATE ROLE qa_forbidden_role", "SET ROLE postgres",
                "UPDATE crowdradar_demo_identity.provenance SET project_ref='wrong'", "DELETE FROM crowdradar_demo_identity.provenance",
                "ALTER TABLE crowdradar_demo_identity.provenance ADD COLUMN forbidden integer", "CREATE TEMP TABLE qa_forbidden_temp(id integer)"]) await denied(db, sql);
            await denied(db, "SELECT secret FROM vault.decrypted_secrets");
        }
        for (const sql of ["CREATE TABLE public.qa_forbidden_table(id integer)", "ALTER TABLE public.users ADD COLUMN forbidden integer",
            "CREATE SCHEMA qa_forbidden_schema", "TRUNCATE public.users", "INSERT INTO public.crowdradar_migrations(name) VALUES('forbidden')"]) await denied(apiReal, sql);
    });
    await block("API cannot read platform data and PUBLIC/anon/authenticated/service_role lack app grants", async () => {
        await denied(apiReal, "SELECT * FROM auth.users");
        await denied(apiReal, "SELECT * FROM storage.objects");
        const rows = await select(qa.admin, `SELECT r.rolname,c.relname FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE r.rolname IN ('anon','authenticated','service_role') AND n.nspname='public' AND c.relkind='r'
            AND has_table_privilege(r.rolname,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`);
        assert.deepEqual(rows, []);
    });
    await block("column permission drift makes provenance fail closed for both roles", async () => {
        for (const [role, db, purpose] of [["crowdradar_demo_api", api, "api"], ["crowdradar_demo_migrator", migrator, "migration"]]) {
            await qa.admin.query(`GRANT UPDATE(project_ref) ON crowdradar_demo_identity.provenance TO ${role}`);
            await assert.rejects(safety.assertDemoProvenance(db, qa.env, purpose), /DEMO_PROVENANCE_UNPROTECTED/);
            await qa.admin.query(`REVOKE UPDATE(project_ref) ON crowdradar_demo_identity.provenance FROM ${role}`);
            await safety.assertDemoProvenance(db, qa.env, purpose);
        }
    });
    await block("effective role membership and schema/database privilege drift are rejected", async () => {
        await assert.rejects(safety.assertDemoProvenance(qa.adapt(migratorReal, "api"), qa.env, "api"), /DEMO_DATABASE_IDENTITY_INVALID/);
        for (const [grant, revoke] of [
            ["GRANT pg_read_all_data TO crowdradar_demo_api", "REVOKE pg_read_all_data FROM crowdradar_demo_api"],
            ["GRANT CREATE ON SCHEMA public TO crowdradar_demo_api", "REVOKE CREATE ON SCHEMA public FROM crowdradar_demo_api"],
            ["GRANT CREATE ON DATABASE crowdradar_demo_infra_test TO crowdradar_demo_api", "REVOKE CREATE ON DATABASE crowdradar_demo_infra_test FROM crowdradar_demo_api"],
            ["GRANT TEMPORARY ON DATABASE crowdradar_demo_infra_test TO crowdradar_demo_api", "REVOKE TEMPORARY ON DATABASE crowdradar_demo_infra_test FROM crowdradar_demo_api"]
        ]) {
            await qa.admin.query(grant);
            try { await assert.rejects(safety.assertDemoProvenance(api, qa.env, "api"), /DEMO_DATABASE_ROLE_EXCESSIVE/); }
            finally { await qa.admin.query(revoke); }
            await safety.assertDemoProvenance(api, qa.env, "api");
        }
    });
    await block("all schema readiness queries succeed under the API role without DDL", async () => {
        const entries = [["migrateAuth", "assertAuthSchemaReady"], ["migrateRecovery", "assertRecoverySchemaReady"],
            ["migratePlaceDetails", "assertPlaceDetailsSchemaReady"], ["migrateReportCompatibility", "assertConsolidatedReportsSchemaReady"],
            ["migrateKarma", "assertKarmaSchemaReady"], ["migrateValidation", "assertValidationSchemaReady"],
            ["migrateUserModeration", "assertUserModerationSchemaReady"], ["migrateReportModeration", "assertReportModerationSchemaReady"],
            ["migrateFavorites", "assertFavoritesSchemaReady"], ["migrateSaturationAlerts", "assertSaturationAlertsSchemaReady"],
            ["migratePushTargetTypes", "assertPushTargetTypesSchemaReady"]];
        for (const [file, name] of entries) await (await import(`../src/database/${file}.js`))[name](apiReal);
    });
    await block("API role reconnects with verified local TLS and still has no DDL", async () => {
        await apiReal.close();
        const reconnect = qa.connect("crowdradar_demo_api");
        await safety.assertDemoProvenance(qa.adapt(reconnect, "api"), qa.env, "api");
        await denied(reconnect, "CREATE TABLE public.qa_forbidden_reconnect(id integer)");
    });
    await block("real TLS rejects an unrelated CA and a hostname outside the certificate", async () => {
        for (const patch of [{ ca: rootCertificates[0] }, { servername: "untrusted.invalid" }]) {
            const invalid = qa.connect("crowdradar_demo_api", undefined, patch);
            await assert.rejects(invalid.authenticate(), error => error.name === "SequelizeConnectionError" &&
                ["SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(error.original?.code));
        }
    });
    evidence.adaptations = qa.adaptations;
    await writeFile(resolve(qa.directory, "../db-local-sql-evidence.json"), JSON.stringify(evidence, null, 2));
});
