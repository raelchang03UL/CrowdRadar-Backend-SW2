// Explicit operator CLI for the single approved demo. No startup/runtime import.
import assert from 'node:assert/strict';
import { readFile,realpath } from 'node:fs/promises';
import { dirname,resolve,relative,isAbsolute,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Sequelize,QueryTypes } from 'sequelize';
import { demoSupabaseTarget as target } from '../../src/config/demoSupabaseTarget.js';
import { demoDatabaseConfiguration } from '../../src/config/demoSupabaseEnvironment.js';
import { assertDemoProvenance } from '../../src/database/demoSupabaseSafety.js';
const jobId='1';
const jobName='crowdradar-demo-push-20261104';
const apiOrigin='https://crowdradar-demo-api.vercel.app';
const approvedApiOrigin=apiOrigin;
const secretName='crowdradar-demo-push-ycxuhejpehmdfbvdplpl';
const excludedRoles='PUBLIC,anon,authenticated,service_role,crowdradar_demo_api,crowdradar_demo_migrator';
const command="SET statement_timeout='58s'; SELECT crowdradar_demo_jobs.tick()";
const frozenTemplateSha256='9cd33ae675dadaa91446f71bfe0bc32fd7102ccb8eaaae10b5b322dc68c612b3';
const sha=data=>createHash('sha256').update(data).digest('hex');
const repository=resolve(import.meta.dirname,'../..');
const modes=['inspect-readonly','prepare-disabled','probe-disabled','activate','check','disable'];
let stage='arguments';

function externalPath(path) {
    assert.ok(typeof path==='string' && isAbsolute(path),'CRON_CONFIG_PATH_MUST_BE_ABSOLUTE');
    const pathFromRepository=relative(repository,resolve(path));
    assert.ok(pathFromRepository==='..' || pathFromRepository.startsWith('..'+sep) || isAbsolute(pathFromRepository),
        'CRON_PRIVATE_CONFIG_MUST_BE_OUTSIDE_REPOSITORY');
    return resolve(path);
}

export function parseArguments(argv) {
    const [mode,...rest]=argv;
    assert.ok(modes.includes(mode),'CRON_MODE_INVALID');
    const values={};
    for(let index=0;index<rest.length;index++) {
        const key=rest[index];
        assert.ok(['--config','--secret-file','--plan'].includes(key) && !Object.hasOwn(values,key),'CRON_ARGUMENTS_INVALID');
        if(key==='--plan') values[key]=true;
        else { const value=rest[++index]; assert.ok(value && !value.startsWith('--'),'CRON_ARGUMENTS_INVALID'); values[key]=value; }
    }
    const configPath=externalPath(values['--config']);
    assert.equal(Boolean(values['--secret-file']),mode==='prepare-disabled','CRON_SECRET_ARGUMENT_INVALID');
    const secretFilePath=values['--secret-file']?externalPath(values['--secret-file']):undefined;
    return {mode,configPath,secretFilePath,plan:values['--plan']===true};
}

export async function loadConfiguration(configPath) {
    assert.equal(target.projectRef,'ycxuhejpehmdfbvdplpl','CRON_TARGET_INVALID');
    externalPath(await realpath(externalPath(configPath)));
    const data=JSON.parse(await readFile(configPath,'utf8'));
    assert.equal(data.version,1,'CRON_CONFIG_VERSION_INVALID');
    assert.equal(data.projectRef,target.projectRef,'CRON_CONFIG_TARGET_INVALID');
    const env={...data.shared,...data.bootstrap};
    return {env,config:demoDatabaseConfiguration(env,'bootstrap')};
}

async function prepareOrInspect(mode,{db,env,configPath,secretFilePath}) {
    const select=(sql,options={})=>db.query(sql,{...options,type:QueryTypes.SELECT});
    if (mode === "inspect-readonly") {
        await db.transaction(async transaction => {
            const options = { transaction };
            await db.query("SET TRANSACTION READ ONLY", options);
            await assertDemoProvenance(db, env, "bootstrap", target, options);
            const extensions = await select(`SELECT name,default_version,installed_version FROM pg_available_extensions
                WHERE name IN ('pg_cron','http','supabase_vault','pg_net') ORDER BY name`, options);
            const owners = await select(`SELECT e.extname,pg_get_userbyid(e.extowner) AS owner,n.nspname AS schema
                FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
                WHERE e.extname IN ('pg_cron','http','supabase_vault','pg_net') ORDER BY e.extname`, options);
            const [logging] = await select(`SELECT current_setting('log_parameter_max_length') AS parameters,
                current_setting('log_parameter_max_length_on_error') AS error_parameters,
                current_setting('pgaudit.log_parameter',true) AS audit_parameters`, options);
            const permissions = await select(`SELECT r.rolname,n.nspname,c.relname,
                has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
                has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
                has_any_column_privilege(r.oid,c.oid,'SELECT') AS can_select_column,
                has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') AS can_write
                FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE r.rolname IN ('crowdradar_demo_api','crowdradar_demo_migrator')
                AND n.nspname IN ('vault','net','cron','crowdradar_demo_jobs','crowdradar_demo_http') AND c.relkind IN ('r','v')
                ORDER BY r.rolname,n.nspname,c.relname`, options);
            console.log(JSON.stringify({ projectRef: target.projectRef, readOnly: true, extensions, owners, permissions, logging,
                pgNetApproved: false, preparationActivation: "disabled", secretValuesRead: false }, null, 2));
        });
    } else {
        const binding = JSON.parse(await readFile(resolve(import.meta.dirname, "demo-cron-target.json"), "utf8"));
        assert.equal(binding.projectRef, target.projectRef, "CRON_ORIGIN_TARGET_INVALID");
        assert.equal(binding.activation, "disabled", "CRON_ACTIVATION_NOT_ALLOWED");
        assert.match(binding.apiOriginEvidenceSha256 ?? "", /^[a-f0-9]{64}$/, "CRON_ORIGIN_UNVERIFIED");
        assert.equal(binding.apiOrigin, approvedApiOrigin, "CRON_ORIGIN_NOT_APPROVED");
        const evidenceBytes = await readFile(resolve(import.meta.dirname, "demo-cron-api-origin-evidence.json"));
        assert.equal(createHash("sha256").update(evidenceBytes).digest("hex"), binding.apiOriginEvidenceSha256, "CRON_ORIGIN_EVIDENCE_MISMATCH");
        const evidence = JSON.parse(evidenceBytes);
        assert.equal(evidence.projectRef, target.projectRef, "CRON_ORIGIN_EVIDENCE_MISMATCH");
        assert.equal(evidence.apiOrigin, approvedApiOrigin, "CRON_ORIGIN_EVIDENCE_MISMATCH");
        assert.ok(Number.isFinite(Date.parse(evidence.verifiedAt)) && Date.parse(evidence.verifiedAt) >= Date.parse(target.verifiedAt), "CRON_ORIGIN_EVIDENCE_MISMATCH");
        const origin = new URL(binding.apiOrigin);
        assert.ok(origin.protocol === "https:" && origin.origin === binding.apiOrigin && !origin.username && !origin.password, "CRON_ORIGIN_INVALID");
        const endpoint = `${origin.origin}/api/internal/push/process`;
        // No credential is sent by this redirect probe. No database writes yet.
        const response = await fetch(endpoint, { method: "POST", body: "{}", headers: { "content-type": "application/json" },
            redirect: "error", signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 401, "CRON_ENDPOINT_NOT_READY");
        assert.equal((await response.json()).code, "SATURATION_SOURCE_UNAUTHORIZED", "CRON_ENDPOINT_NOT_READY");
        const privateDirectory = await realpath(dirname(configPath));
        const secretFile = await realpath(secretFilePath);
        assert.equal(dirname(secretFile).toLowerCase(), privateDirectory.toLowerCase(), "CRON_SECRET_PATH_INVALID");
        const secret = (await readFile(secretFile, "utf8")).replace(/\r?\n$/, "");
        assert.ok(secret.length >= 32 && secret.length <= 256 && !/\s/.test(secret), "CRON_SECRET_INVALID");
        const created = await db.transaction(async transaction => {
            const options = { transaction };
            await assertDemoProvenance(db, env, "bootstrap", target, options);
            const previous = await select("SELECT nspname FROM pg_namespace WHERE nspname IN ('crowdradar_demo_jobs','crowdradar_demo_http')", options);
            assert.equal(previous.length, 0, "CRON_EXISTING_SCHEMA_NOT_ADOPTED");
            const net = await select("SELECT 1 FROM pg_extension WHERE extname='pg_net'", options);
            assert.equal(net.length, 0, "CRON_PG_NET_NOT_APPROVED");
            const vault = await select("SELECT 1 FROM pg_extension WHERE extname='supabase_vault'", options);
            assert.equal(vault.length, 1, "CRON_VAULT_MISSING");
            // The new project's Vault must not contain an unrelated workload.
            const [{ populated }] = await select("SELECT EXISTS (SELECT 1 FROM vault.secrets) AS populated", options);
            assert.equal(populated, false, "CRON_EXISTING_VAULT_NOT_ADOPTED");
            const secretRows = await select("SELECT id FROM vault.secrets WHERE name=:name", { ...options, replacements: { name: secretName } });
            assert.equal(secretRows.length, 0, "CRON_EXISTING_SECRET_NOT_ADOPTED");
            const existingExtensions = await select("SELECT extname FROM pg_extension WHERE extname IN ('http','pg_cron')", options);
            assert.equal(existingExtensions.length, 0, "CRON_EXISTING_EXTENSION_NOT_ADOPTED");
            // Supabase owns extension functions and their PUBLIC grants. Isolate
            // http in a schema WE own instead of attempting ineffective REVOKE.
            await db.query("CREATE SCHEMA crowdradar_demo_http AUTHORIZATION postgres", options);
            await db.query(`REVOKE ALL ON SCHEMA crowdradar_demo_http FROM ${excludedRoles}`, options);
            await db.query("CREATE EXTENSION http WITH SCHEMA crowdradar_demo_http VERSION '1.6'", options);
            await db.query("CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog VERSION '1.6.4'", options);
            const owned = await select(`SELECT extname,pg_get_userbyid(extowner) AS owner FROM pg_extension WHERE extname IN ('http','pg_cron')`, options);
            assert.equal(owned.length, 2, "CRON_EXTENSIONS_MISSING");
            assert.ok(owned.every(row => ['postgres','supabase_admin'].includes(row.owner)), "CRON_EXTENSION_OWNER_UNSUPPORTED");
            const httpFunctions = await select(`SELECT n.nspname AS schema,
                pg_get_userbyid(n.nspowner) AS schema_owner,pg_get_userbyid(p.proowner) AS owner
                FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
                JOIN pg_extension e ON e.oid=d.refobjid WHERE e.extname='http'`, options);
            assert.ok(httpFunctions.length > 0 && httpFunctions.every(row => row.schema === 'crowdradar_demo_http'
                && row.schema_owner === 'postgres' && ['postgres','supabase_admin'].includes(row.owner)), "CRON_HTTP_PRIVILEGES_UNSUPPORTED");
            // Vault/cron platform ACLs remain unchanged. service_role/platform
            // administrators are trusted; API/migrator must have no route in.
            const unsafeSchemas = await select(`SELECT r.rolname,n.nspname FROM pg_roles r CROSS JOIN pg_namespace n
                WHERE r.rolname IN ('crowdradar_demo_api','crowdradar_demo_migrator')
                AND n.nspname IN ('vault','cron','crowdradar_demo_http') AND has_schema_privilege(r.oid,n.oid,'USAGE,CREATE')`, options);
            assert.equal(unsafeSchemas.length, 0, "CRON_SECRET_SCHEMA_UNPROTECTED");
            const unsafeVault = await select(`SELECT r.rolname,c.relname FROM pg_roles r CROSS JOIN pg_class c
                JOIN pg_namespace n ON n.oid=c.relnamespace WHERE r.rolname IN ('crowdradar_demo_api','crowdradar_demo_migrator')
                AND n.nspname='vault' AND c.relkind IN ('r','v') AND
                (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
                OR has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))`, options);
            assert.equal(unsafeVault.length, 0, "CRON_VAULT_APP_PRIVILEGE_INVALID");
            const applicationRoles = await select(`SELECT rolname FROM pg_roles r
                WHERE rolname IN ('crowdradar_demo_api','crowdradar_demo_migrator')
                AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit)
                AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=r.oid)`, options);
            assert.equal(applicationRoles.length, 2, "CRON_APP_ROLE_EXCESSIVE");
            const conflict = await select("SELECT jobid FROM cron.job WHERE jobname=:name", { ...options, replacements: { name: jobName } });
            assert.equal(conflict.length, 0, "CRON_EXISTING_JOB_NOT_ADOPTED");
            await db.query("CREATE SCHEMA crowdradar_demo_jobs AUTHORIZATION postgres", options);
            await db.query(`REVOKE ALL ON SCHEMA crowdradar_demo_jobs FROM ${excludedRoles}`, options);
            await db.query(`CREATE TABLE crowdradar_demo_jobs.state (
                singleton boolean PRIMARY KEY DEFAULT TRUE CHECK(singleton), job_id bigint,
                enabled boolean NOT NULL DEFAULT FALSE, failures integer NOT NULL DEFAULT 0,
                last_attempt_at timestamptz, retry_after timestamptz,
                api_origin text NOT NULL, provenance_id char(64) NOT NULL)`, options);
            await db.query(`CREATE TABLE crowdradar_demo_jobs.runs (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
                status integer, outcome text NOT NULL, evaluated integer, sent integer, configured boolean)`, options);
            await db.query(`REVOKE ALL ON ALL TABLES IN SCHEMA crowdradar_demo_jobs FROM ${excludedRoles}`, options);
            await db.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA crowdradar_demo_jobs FROM ${excludedRoles}`, options);
            await db.query(`INSERT INTO crowdradar_demo_jobs.state(api_origin,provenance_id) VALUES(:origin,:provenance)`,
                { ...options, replacements: { origin: origin.origin, provenance: target.provenanceId } });
            // Bound parameters must not enter PostgreSQL query/error logs.
            await db.query("SET LOCAL log_parameter_max_length=0", options);
            await db.query("SET LOCAL log_parameter_max_length_on_error=0", options);
            const [audit] = await select("SELECT current_setting('pgaudit.log_parameter',true) AS parameters", options);
            assert.ok(!['on','true','1'].includes(audit.parameters), "CRON_SECRET_PARAMETER_LOGGING_ENABLED");
            await db.query("SELECT vault.create_secret($1,$2,$3)", { ...options, bind: [secret, secretName, "CrowdRadar demo executor; owner/cron only"] });
            const template = await readFile(resolve(import.meta.dirname, "demo-cron-http-function.sql"), "utf8");
            assert.equal(template.split("__PINNED_DEMO_API_ORIGIN_SQL_LITERAL__").length, 2, "CRON_SQL_ORIGIN_INVALID");
            const sql = template.replace("__PINNED_DEMO_API_ORIGIN_SQL_LITERAL__", db.escape(origin.origin));
            assert.ok(sql.includes(target.provenanceId) && sql.includes(target.projectRef), "CRON_SQL_BINDING_MISMATCH");
            await db.query(sql, options);
            await db.query(`REVOKE ALL ON FUNCTION crowdradar_demo_jobs.tick() FROM ${excludedRoles}`, options);
            const [scheduled] = await select("SELECT cron.schedule(:name,'* * * * *',:command) AS id",
                { ...options, replacements: { name: jobName,
                    command: "SET statement_timeout='58s'; SELECT crowdradar_demo_jobs.tick()" } });
            await db.query("SELECT cron.alter_job(:id,active := false)", { ...options, replacements: { id: scheduled.id } });
            await db.query("UPDATE crowdradar_demo_jobs.state SET job_id=:id", { ...options, replacements: { id: scheduled.id } });
            const exposed = await select(`SELECT r.rolname,p.proname FROM pg_roles r CROSS JOIN pg_proc p
                JOIN pg_namespace n ON n.oid=p.pronamespace WHERE r.rolname IN ('crowdradar_demo_api','crowdradar_demo_migrator')
                AND (n.nspname='crowdradar_demo_jobs' OR EXISTS (SELECT 1 FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
                    WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e' AND e.extname='http'))
                AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_function_privilege(r.oid,p.oid,'EXECUTE')`, options);
            assert.equal(exposed.length, 0, "CRON_API_PRIVILEGE_INCREASE");
            return { jobId: scheduled.id, active: false, enabled: false, projectRef: target.projectRef, apiOrigin: origin.origin };
        });
        console.log(JSON.stringify({ prepared: created, httpCallsWithSecret: 0, pgNetInstalled: false }, null, 2));
    }
}

async function controlCron(mode,{db,env}) {
    const template = await readFile(resolve(import.meta.dirname, 'demo-cron-http-function.sql'));
    assert.equal(sha(template), frozenTemplateSha256, 'CRON_CONTROL_TEMPLATE_CHANGED');
    const binding = JSON.parse(await readFile(resolve(import.meta.dirname, 'demo-cron-target.json'), 'utf8'));
    const evidenceBytes = await readFile(resolve(import.meta.dirname, 'demo-cron-api-origin-evidence.json'));
    const evidence = JSON.parse(evidenceBytes);
    assert.equal(binding.projectRef, target.projectRef, 'CRON_CONTROL_ORIGIN_INVALID');
    assert.equal(binding.apiOrigin, apiOrigin, 'CRON_CONTROL_ORIGIN_INVALID');
    assert.equal(binding.apiOriginEvidenceSha256, sha(evidenceBytes), 'CRON_CONTROL_EVIDENCE_CHANGED');
    assert.equal(evidence.projectRef, target.projectRef, 'CRON_CONTROL_EVIDENCE_INVALID');
    assert.equal(evidence.apiOrigin, apiOrigin, 'CRON_CONTROL_EVIDENCE_INVALID');
    assert.ok(evidence.healthStatus===200 && evidence.unauthorizedPostStatus===401 && evidence.authorizedPostStatus===200
        && evidence.redirects===false && evidence.configured===true, 'CRON_CONTROL_API_NOT_READY');
    const rendered = template.toString('utf8').replace('__PINNED_DEMO_API_ORIGIN_SQL_LITERAL__',db.escape(apiOrigin));
    const body = rendered.split('$function$');
    assert.equal(body.length,3,'CRON_CONTROL_SQL_INVALID');
    const expectedFunctionBodySha256 = sha(body[1]);
    if (mode==='activate') {
        // Fresh non-authenticated probes never send the executor credential.
        stage='fresh-api-probe';
        const health = await fetch(`${apiOrigin}/health/ready`,{redirect:'error',signal:AbortSignal.timeout(10000)});
        assert.equal(health.status,200,'CRON_CONTROL_HEALTH_NOT_READY');
        const healthBody = await health.json();
        assert.equal(healthBody.ready,true,'CRON_CONTROL_HEALTH_BODY_INVALID');
        const unauthorized = await fetch(`${apiOrigin}/api/internal/push/process`,{method:'POST',body:'{}',
            headers:{'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
        assert.equal(unauthorized.status,401,'CRON_CONTROL_ENDPOINT_NOT_READY');
        assert.equal((await unauthorized.json()).code,'SATURATION_SOURCE_UNAUTHORIZED','CRON_CONTROL_ENDPOINT_NOT_READY');
    }
    stage='database-verification';
    const result = await db.transaction({isolationLevel:'REPEATABLE READ'},async transaction=>{
        const options={transaction,type:QueryTypes.SELECT,logging:false};
        const select=sql=>db.query(sql,options);
        if(mode==='check') await db.query('SET TRANSACTION READ ONLY',{transaction,logging:false});
        await assertDemoProvenance(db,env,'bootstrap',target,{transaction,logging:false});
        const [timestamp]=await select('SELECT clock_timestamp() AS inspected_at');
        const jobs=await select(`SELECT jobid::text,jobname,schedule,command,database,username,active
            FROM cron.job WHERE jobid=1 OR jobname='crowdradar-demo-push-20261104'`);
        assert.equal(jobs.length,1,'CRON_CONTROL_JOB_AMBIGUOUS');
        const job=jobs[0];
        assert.ok(job.jobid===jobId && job.jobname===jobName && job.schedule==='* * * * *' && job.command===command
            && job.database==='postgres' && job.username==='postgres','CRON_CONTROL_JOB_CHANGED');
        const states=await select(`SELECT singleton,job_id::text,enabled,failures,last_attempt_at,retry_after,api_origin,provenance_id
            FROM crowdradar_demo_jobs.state${mode==='check'?'':' FOR UPDATE'}`);
        assert.equal(states.length,1,'CRON_CONTROL_STATE_INVALID');
        const state=states[0];
        assert.ok(state.singleton===true && state.job_id===jobId && state.api_origin===apiOrigin
            && state.provenance_id===target.provenanceId,'CRON_CONTROL_STATE_CHANGED');
        const functions=await select(`SELECT p.prosrc,pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.pronargs,
            p.prorettype='jsonb'::regtype AS returns_jsonb,l.lanname
            FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
            WHERE n.nspname='crowdradar_demo_jobs' AND p.proname='tick'`);
        assert.equal(functions.length,1,'CRON_CONTROL_FUNCTION_AMBIGUOUS');
        const fn=functions[0];
        assert.ok(fn.owner==='postgres' && fn.prosecdef===true && fn.pronargs===0 && fn.returns_jsonb===true
            && fn.lanname==='plpgsql' && JSON.stringify(fn.proconfig)===JSON.stringify(['search_path=pg_catalog']), 'CRON_CONTROL_FUNCTION_METADATA_CHANGED');
        assert.equal(sha(fn.prosrc),expectedFunctionBodySha256,'CRON_CONTROL_FUNCTION_BODY_CHANGED');
        const owners=await select(`SELECT nspname,pg_get_userbyid(nspowner) AS owner FROM pg_namespace
            WHERE nspname IN ('crowdradar_demo_jobs','crowdradar_demo_http') ORDER BY nspname`);
        assert.equal(owners.length,2,'CRON_CONTROL_PRIVATE_SCHEMAS_MISSING');
        assert.ok(owners.every(row=>row.owner==='postgres'),'CRON_CONTROL_SCHEMA_OWNER_CHANGED');
        const exposed=await select(`SELECT r.rolname,n.nspname FROM pg_roles r CROSS JOIN pg_namespace n
            WHERE r.rolname IN ('crowdradar_demo_api','crowdradar_demo_migrator')
            AND n.nspname IN ('vault','cron','crowdradar_demo_http','crowdradar_demo_jobs')
            AND has_schema_privilege(r.oid,n.oid,'USAGE,CREATE')`);
        assert.equal(exposed.length,0,'CRON_CONTROL_APP_PRIVILEGE_DRIFT');
        const exposedFunction=await select(`SELECT rolname FROM pg_roles
            WHERE rolname IN ('anon','authenticated','service_role','crowdradar_demo_api','crowdradar_demo_migrator')
            AND has_function_privilege(oid,'crowdradar_demo_jobs.tick()','EXECUTE')`);
        assert.equal(exposedFunction.length,0,'CRON_CONTROL_FUNCTION_EXPOSED');
        const extensions=await select(`SELECT extname,extversion,extnamespace::regnamespace::text AS schema FROM pg_extension
            WHERE extname IN ('http','pg_cron','pg_net','supabase_vault') ORDER BY extname`);
        assert.equal(extensions.length,3,'CRON_CONTROL_EXTENSION_SET_CHANGED');
        assert.ok(extensions.some(row=>row.extname==='http' && row.extversion==='1.6' && row.schema==='crowdradar_demo_http')
            && extensions.some(row=>row.extname==='pg_cron' && row.extversion==='1.6.4')
            && extensions.some(row=>row.extname==='supabase_vault' && row.extversion==='0.3.1'),'CRON_CONTROL_EXTENSION_CHANGED');
        const [{count}]=await select("SELECT COUNT(*)::integer AS count FROM vault.secrets WHERE name='crowdradar-demo-push-ycxuhejpehmdfbvdplpl'");
        assert.equal(count,1,'CRON_CONTROL_SECRET_REFERENCE_INVALID');
        let probeOutcome;
        if(mode==='probe-disabled' || mode==='activate') {
            assert.ok(job.active===false && state.enabled===false,'CRON_CONTROL_ALREADY_ACTIVE');
            const [probe]=await select('SELECT crowdradar_demo_jobs.tick() AS result');
            assert.deepEqual(probe.result,{outcome:'DISABLED'},'CRON_CONTROL_DISABLED_PROBE_FAILED');
            probeOutcome=probe.result.outcome;
        }
        if(mode==='activate' || mode==='disable') {
            const enabled=mode==='activate';
            await db.query(`UPDATE crowdradar_demo_jobs.state SET enabled=:enabled
                ${enabled?',failures=0,retry_after=NULL':''} WHERE singleton AND job_id=1`,
                {transaction,logging:false,replacements:{enabled}});
            await db.query('SELECT cron.alter_job(1,active := :enabled)',{transaction,logging:false,replacements:{enabled}});
        }
        const [after]=await select(`SELECT s.enabled,j.active,s.failures,s.last_attempt_at,s.retry_after
            FROM crowdradar_demo_jobs.state s JOIN cron.job j ON j.jobid=s.job_id WHERE s.singleton AND j.jobid=1`);
        if(mode==='activate' || mode==='disable') assert.ok(after.active===(mode==='activate') && after.enabled===(mode==='activate'),'CRON_CONTROL_SWITCH_MISMATCH');
        const runs=await select('SELECT started_at,status,outcome,evaluated,sent,configured FROM crowdradar_demo_jobs.runs ORDER BY id DESC LIMIT 12');
        const cronRuns=await select('SELECT status,start_time,end_time FROM cron.job_run_details WHERE jobid=1 ORDER BY runid DESC LIMIT 12');
        const outbox=await select('SELECT status,COUNT(*)::integer AS count FROM public.push_notification_outbox GROUP BY status ORDER BY status');
        return {mode,inspectedAt:timestamp.inspected_at,projectRef:target.projectRef,jobId,jobName,apiOrigin,
            functionBodySha256:expectedFunctionBodySha256,templateSha256:frozenTemplateSha256,probeOutcome,
            secretValueRead:false,manualHttpWithSecret:false,readOnly:mode==='check',state:after,runs,cronRuns,outbox};
    });
    console.log(JSON.stringify(result,null,2));
}

export async function main(argv=process.argv.slice(2)) {
    let db;
    try {
        const args=parseArguments(argv);
        if(args.plan) {
            console.log(JSON.stringify({mode:args.mode,projectRef:target.projectRef,apiOrigin,jobId,
                writes:['prepare-disabled','activate','disable'].includes(args.mode),
                configurationRead:false,networkAccess:false,sqlExecuted:false,
                secretRequired:args.mode==='prepare-disabled',templateSha256:frozenTemplateSha256}));
            return;
        }
        stage='configuration';
        const {env,config}=await loadConfiguration(args.configPath);
        db=new Sequelize(config.database,config.username,config.password,config.options);
        const context={db,env,configPath:args.configPath,secretFilePath:args.secretFilePath};
        if(['inspect-readonly','prepare-disabled'].includes(args.mode)) await prepareOrInspect(args.mode,context);
        else await controlCron(args.mode,context);
    } catch(error) {
        const firstLine=error.message?.split(/\r?\n/)[0];
        const code=/^CRON_[A-Z0-9_]+$/.test(firstLine??'')?firstLine:
            /^[A-Z0-9_]+$/.test(error.code??'')?error.code:'CRON_OPERATION_FAILED';
        console.error(JSON.stringify({outcome:'FAIL',code,stage,privateDetailsSuppressed:true}));
        process.exitCode=1;
    } finally {if(db) await db.close();}
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await main();
