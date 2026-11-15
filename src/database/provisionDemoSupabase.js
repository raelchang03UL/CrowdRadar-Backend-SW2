import { QueryTypes } from "sequelize";
import { demoSupabaseTarget } from "../config/demoSupabaseTarget.js";
import { requireVerifiedDemoTarget } from "../config/demoSupabaseEnvironment.js";
import { assertDemoInitialEmpty, assertDemoProvenance } from "./demoSupabaseSafety.js";
import { assertMigrationTarget, authorizeDemoMigration, revokeDemoMigrationAuthorization } from "./databaseSafety.js";
import { demoLocalPlaces } from "./demoLocalPlaces.js";

const fail = code => { throw Object.assign(new Error(code), { code }); };
export const demoApiGrants = Object.freeze({
    crowdradar_migrations: "SELECT", places: "SELECT", users: "SELECT,INSERT,UPDATE",
    password_reset_tokens: "SELECT,INSERT,UPDATE", password_recovery_limits: "SELECT,INSERT,UPDATE,DELETE",
    saturation_reports: "SELECT,INSERT,UPDATE", report_karma_awards: "SELECT,INSERT",
    report_validations: "SELECT,INSERT", report_denunciations: "SELECT,INSERT",
    user_moderation_actions: "SELECT,INSERT", report_moderation_actions: "SELECT,INSERT",
    favorites: "SELECT,INSERT,DELETE", push_device_tokens: "SELECT,INSERT,UPDATE,DELETE",
    place_saturation: "SELECT,INSERT,UPDATE", push_notification_outbox: "SELECT,INSERT,UPDATE,DELETE"
});
const sequences = ["users", "password_reset_tokens", "saturation_reports", "user_moderation_actions",
    "report_moderation_actions", "push_device_tokens", "push_notification_outbox"].map(table => `${table}_id_seq`);

// Explicit provisioning only; never imported/called by app startup. The target
// stays null until the new project and owner have independent creation evidence.
export async function provisionDemoSupabase(db, env, target = demoSupabaseTarget) {
    requireVerifiedDemoTarget(target);
    const passwords = [env.DEMO_API_ROLE_PASSWORD, env.DEMO_MIGRATION_ROLE_PASSWORD];
    if (passwords.some(value => typeof value !== "string" || value.length < 32) || passwords[0] === passwords[1]) fail("DEMO_ROLE_PASSWORDS_INVALID");
    return db.transaction(async transaction => {
        const options = { transaction, logging: false };
        await assertDemoInitialEmpty(db, env, target, options);
        // Fixed identifiers; escaped literals never enter output. A pre-existing
        // role/schema causes rollback instead of being adopted or reset.
        for (const [role, password] of [["crowdradar_demo_api", passwords[0]], ["crowdradar_demo_migrator", passwords[1]]]) {
            await db.query(`CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 12 PASSWORD ${db.escape(password)}`, options);
        }
        await db.query("REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC", options);
        await db.query("GRANT CONNECT ON DATABASE postgres TO crowdradar_demo_api,crowdradar_demo_migrator", options);
        await db.query("REVOKE ALL ON SCHEMA public FROM PUBLIC,anon,authenticated,service_role", options);
        await db.query("GRANT USAGE ON SCHEMA public TO crowdradar_demo_api,crowdradar_demo_migrator", options);
        await db.query("GRANT CREATE ON SCHEMA public TO crowdradar_demo_migrator", options);
        await db.query("CREATE SCHEMA crowdradar_demo_identity AUTHORIZATION postgres", options);
        await db.query("REVOKE ALL ON SCHEMA crowdradar_demo_identity FROM PUBLIC,anon,authenticated,service_role", options);
        await db.query(`CREATE TABLE crowdradar_demo_identity.provenance (
            singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton), deployment TEXT NOT NULL,
            project_ref TEXT NOT NULL, organization_id TEXT NOT NULL, owner_account_id TEXT NOT NULL,
            creation_evidence_sha256 CHAR(64) NOT NULL, provenance_id CHAR(64) NOT NULL,
            initial_public_empty BOOLEAN NOT NULL CHECK(initial_public_empty), created_at TIMESTAMPTZ NOT NULL,
            provisioned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp())`, options);
        // Historical column labels in this new private table: owner_account_id
        // holds the verified Dashboard email identifier; created_at is when the
        // new project's creation was observed, not a provider API timestamp.
        await db.query(`INSERT INTO crowdradar_demo_identity.provenance
            (deployment,project_ref,organization_id,owner_account_id,creation_evidence_sha256,provenance_id,initial_public_empty,created_at)
            VALUES (:deployment,:projectRef,:organizationId,:ownerAccountId,:creationEvidenceSha256,:provenanceId,TRUE,:createdAt)`,
        { ...options, replacements: { ...target, ownerAccountId: target.ownerAccountEmail, createdAt: target.observedCreationAt } });
        await db.query("REVOKE ALL ON crowdradar_demo_identity.provenance FROM PUBLIC,anon,authenticated,service_role", options);
        await db.query("GRANT USAGE ON SCHEMA crowdradar_demo_identity TO crowdradar_demo_api,crowdradar_demo_migrator", options);
        await db.query("GRANT SELECT ON crowdradar_demo_identity.provenance TO crowdradar_demo_api,crowdradar_demo_migrator", options);
    });
}

export async function grantDemoApiPermissions(db, env) {
    await authorizeDemoMigration(db, env);
    try {
        assertMigrationTarget(db);
        return await db.transaction(async transaction => {
            const options = { transaction, logging: false };
            await assertDemoProvenance(db, env, "migration", demoSupabaseTarget, options);
            for (const [table, grants] of Object.entries(demoApiGrants)) {
                await db.query(`REVOKE ALL ON public.${table} FROM PUBLIC,anon,authenticated,service_role,crowdradar_demo_api`, options);
                await db.query(`GRANT ${grants} ON public.${table} TO crowdradar_demo_api`, options);
            }
            // PostgreSQL row locks used by favorites/push require UPDATE on at
            // least one column, even though these operations don't change places.
            await db.query("GRANT UPDATE(id) ON public.places TO crowdradar_demo_api", options);
            for (const sequence of sequences) {
                await db.query(`REVOKE ALL ON SEQUENCE public.${sequence} FROM PUBLIC,anon,authenticated,service_role,crowdradar_demo_api`, options);
                await db.query(`GRANT USAGE ON SEQUENCE public.${sequence} TO crowdradar_demo_api`, options);
            }
        });
    } finally { revokeDemoMigrationAuthorization(db); }
}

export async function seedDemoSupabaseCatalog(db, env) {
    await authorizeDemoMigration(db, env);
    try {
        assertMigrationTarget(db);
        return await db.transaction(async transaction => {
            const options = { transaction, type: QueryTypes.SELECT };
            await assertDemoProvenance(db, env, "migration", demoSupabaseTarget, options);
            await db.query("SELECT pg_advisory_xact_lock(310031)", options);
            let inserted = 0;
            for (const place of demoLocalPlaces) {
                const selected = { ...options, replacements: place };
                const rows = await db.query("SELECT * FROM public.places WHERE id=:id OR lower(nombre)=lower(:nombre) FOR UPDATE", selected);
                if (rows.some(row => Object.keys(place).some(key => row[key] !== place[key]))) fail("DEMO_CATALOG_CONFLICT");
                if (!rows.length) {
                    await db.query(`INSERT INTO public.places (id,nombre,categoria,direccion,referencia,latitud,longitud,activo,demostrativo)
                        VALUES (:id,:nombre,:categoria,:direccion,:referencia,:latitud,:longitud,:activo,:demostrativo)`, selected);
                    inserted++;
                }
            }
            return { inserted, unchanged: demoLocalPlaces.length - inserted };
        });
    } finally { revokeDemoMigrationAuthorization(db); }
}
