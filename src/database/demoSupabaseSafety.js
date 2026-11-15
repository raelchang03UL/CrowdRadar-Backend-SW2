import { QueryTypes } from "sequelize";
import { demoSupabaseTarget } from "../config/demoSupabaseTarget.js";
import { demoDatabaseConfiguration, demoRoles, isDemoDeployment, requireVerifiedDemoTarget } from "../config/demoSupabaseEnvironment.js";

const fail = code => { throw Object.assign(new Error(code), { code }); };
const select = (db, sql, options = {}) => db.query(sql, { ...options, type: QueryTypes.SELECT });

export function assertDemoSupabaseConnection(db, env, purpose, target = demoSupabaseTarget) {
    const expected = demoDatabaseConfiguration(env, purpose, target);
    const tls = db.options?.dialectOptions?.ssl;
    const manager = db.connectionManager?.config;
    const exactTls = value => value?.rejectUnauthorized === true && value.ca === expected.options.dialectOptions.ssl.ca &&
        value.servername === expected.options.host && JSON.stringify(Object.keys(value).sort()) === JSON.stringify(["ca", "rejectUnauthorized", "servername"]);
    if (db.config?.database !== expected.database || db.config?.host !== expected.options.host ||
        Number(db.config?.port) !== expected.options.port || db.config?.username !== expected.username ||
        manager?.database !== expected.database || manager?.host !== expected.options.host ||
        Number(manager?.port) !== expected.options.port || manager?.username !== expected.username ||
        !exactTls(tls) || !exactTls(manager?.dialectOptions?.ssl)) fail("DEMO_CONNECTION_MISMATCH");
}

export async function assertDemoDatabaseIdentity(db, env, purpose, target = demoSupabaseTarget, options = {}) {
    assertDemoSupabaseConnection(db, env, purpose, target);
    const rows = await select(db, `SELECT current_database() AS database, current_user AS role,
        session_user AS session_role, r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
        EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS member_of_role,
        COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()), false) AS ssl,
        has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
        has_database_privilege(current_user, current_database(), 'TEMP') AS database_temp,
        EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
            AND has_schema_privilege(current_user, n.oid, 'CREATE')) AS schema_create,
        EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relowner=r.oid) AS owns_relation
        FROM pg_roles r WHERE r.rolname=current_user`, options);
    const row = rows[0];
    if (rows.length !== 1 || row.database !== "postgres" || row.role !== demoRoles[purpose] ||
        row.session_role !== demoRoles[purpose] || row.ssl !== true) fail("DEMO_DATABASE_IDENTITY_INVALID");
    if (purpose !== "bootstrap" && ["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls", "member_of_role", "database_create", "database_temp"].some(key => row[key] !== false)) fail("DEMO_DATABASE_ROLE_EXCESSIVE");
    if (purpose === "api" && (row.schema_create !== false || row.owns_relation !== false)) fail("DEMO_DATABASE_ROLE_EXCESSIVE");
    return row;
}

export async function assertDemoInitialEmpty(db, env, target = demoSupabaseTarget, options = {}) {
    await assertDemoDatabaseIdentity(db, env, "bootstrap", target, options);
    const schemas = await select(db, `SELECT nspname AS initial_schema FROM pg_namespace
        WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' ORDER BY nspname`, options);
    if (JSON.stringify(schemas.map(row => row.initial_schema).sort()) !== JSON.stringify([...target.initialSchemas].sort())) fail("DEMO_INITIAL_SCHEMA_UNKNOWN");
    const objects = await select(db, `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
        UNION ALL SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
        UNION ALL SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
        WHERE n.nspname='public' AND t.typrelid=0 AND t.typelem=0
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e')
        UNION ALL SELECT nspname FROM pg_namespace WHERE nspname='crowdradar_demo_identity'`, options);
    if (objects.length) fail("DEMO_INITIAL_DATABASE_NOT_EMPTY");
    const existing = await select(db, `SELECT EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM storage.objects)
        OR EXISTS (SELECT 1 FROM storage.buckets) AS existing_data`, options);
    if (existing.length !== 1 || existing[0].existing_data !== false) fail("DEMO_INITIAL_DATABASE_NOT_EMPTY");
}

export async function assertDemoProvenance(db, env, purpose, target = demoSupabaseTarget, options = {}) {
    requireVerifiedDemoTarget(target);
    await assertDemoDatabaseIdentity(db, env, purpose, target, options);
    const rows = await select(db, `SELECT deployment, project_ref, organization_id, owner_account_id,
        creation_evidence_sha256, provenance_id, initial_public_empty, created_at
        FROM crowdradar_demo_identity.provenance`, options);
    const row = rows[0];
    if (rows.length !== 1 || row.deployment !== target.deployment || row.project_ref !== target.projectRef ||
        row.organization_id !== target.organizationId || row.owner_account_id !== target.ownerAccountEmail ||
        row.creation_evidence_sha256 !== target.creationEvidenceSha256 || row.provenance_id !== target.provenanceId ||
        row.initial_public_empty !== true || new Date(row.created_at).toISOString() !== new Date(target.observedCreationAt).toISOString()) fail("DEMO_PROVENANCE_INVALID");
    const permissions = await select(db, `SELECT pg_get_userbyid(c.relowner) AS owner, pg_get_userbyid(n.nspowner) AS schema_owner,
        has_table_privilege(current_user, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS can_change,
        has_any_column_privilege(current_user, c.oid, 'INSERT,UPDATE,REFERENCES') AS can_change_column,
        has_schema_privilege(current_user, n.oid, 'CREATE') AS can_create
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='crowdradar_demo_identity' AND c.relname='provenance' AND c.relkind='r'`, options);
    if (permissions.length !== 1 || permissions[0].owner !== "postgres" || permissions[0].schema_owner !== "postgres" ||
        (purpose !== "bootstrap" && (permissions[0].can_change !== false || permissions[0].can_change_column !== false || permissions[0].can_create !== false))) fail("DEMO_PROVENANCE_UNPROTECTED");
}

export async function assertDemoApiDatabaseReady(db, env = process.env) {
    if (isDemoDeployment(env)) await assertDemoProvenance(db, env, "api");
}
