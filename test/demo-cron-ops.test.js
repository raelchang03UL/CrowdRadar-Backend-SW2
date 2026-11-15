import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,writeFile,rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArguments,loadConfiguration } from '../scripts/ops/demo-cron.mjs';

const repository=resolve(import.meta.dirname,'..');
const cli=resolve(repository,'scripts/ops/demo-cron.mjs');
const externalConfig=resolve(tmpdir(),'crowdradar-cron-no-file.json');

test('operator arguments require explicit external config and reject ambiguous/extra options',()=>{
    const accepted=parseArguments(['check','--config',externalConfig,'--plan']);
    assert.equal(accepted.mode,'check');
    assert.equal(accepted.plan,true);
    for(const args of [[],['unknown'],['check'],['check','--config','relative.json'],
        ['check','--config',resolve(repository,'private.json')],
        ['check','--config',externalConfig,'--config',externalConfig],
        ['check','--config',externalConfig,'--secret-file',resolve(tmpdir(),'secret.txt')],
        ['prepare-disabled','--config',externalConfig],
        ['check','--config',externalConfig,'--host','foreign.example']]) assert.throws(()=>parseArguments(args));
});

test('--plan reads no config and makes no network call, including for activate',()=>{
    const networkBlock=`import net from 'node:net';import tls from 'node:tls';
        const blocked=()=>{throw new Error('NETWORK_FORBIDDEN_IN_PLAN')};
        net.connect=blocked;net.createConnection=blocked;tls.connect=blocked;globalThis.fetch=blocked;`;
    const stdout=execFileSync(process.execPath,['--import',`data:text/javascript,${encodeURIComponent(networkBlock)}`,
        cli,'activate','--config',externalConfig,'--plan'],{encoding:'utf8',windowsHide:true});
    const plan=JSON.parse(stdout);
    assert.equal(plan.mode,'activate');
    assert.equal(plan.projectRef,'ycxuhejpehmdfbvdplpl');
    assert.equal(plan.configurationRead,false);
    assert.equal(plan.networkAccess,false);
    assert.equal(plan.sqlExecuted,false);
    assert.equal(plan.writes,true);
});

test('foreign project or host is rejected locally before a connection exists',async()=>{
    const prefix=resolve(tmpdir(),'crowdradar-cron-ops-');
    const directory=await mkdtemp(prefix);
    try {
        const path=join(directory,'config.json');
        await writeFile(path,JSON.stringify({version:1,projectRef:'abcdefghijklmnopqrst'}));
        await assert.rejects(loadConfiguration(path),/CRON_CONFIG_TARGET_INVALID/);
        await writeFile(path,JSON.stringify({version:1,projectRef:'ycxuhejpehmdfbvdplpl',
            shared:{CROWDRADAR_DEPLOYMENT:'demo-vercel-20261104',DB_SSL:'true'},
            bootstrap:{DEMO_BOOTSTRAP_DATABASE_URL:'postgres://postgres.ycxuhejpehmdfbvdplpl:dummy@foreign.example:5432/postgres'}}));
        await assert.rejects(loadConfiguration(path),{code:'DEMO_CONNECTION_INVALID'});
    } finally {
        assert.ok(resolve(directory).startsWith(prefix));
        await rm(directory,{recursive:true,force:true});
    }
});

test('packaged SQL/prosrc and API evidence preserve the exact deployed bytes',async()=>{
    const sha=value=>createHash('sha256').update(value).digest('hex');
    const folder=resolve(repository,'scripts/ops');
    const template=await readFile(join(folder,'demo-cron-http-function.sql'));
    assert.equal(sha(template),'9cd33ae675dadaa91446f71bfe0bc32fd7102ccb8eaaae10b5b322dc68c612b3');
    const body=template.toString('utf8').replace('__PINNED_DEMO_API_ORIGIN_SQL_LITERAL__',"'https://crowdradar-demo-api.vercel.app'").split('$function$')[1];
    assert.equal(sha(body),'f210e0996ded6d627a592a758de28c365fcc6fd6b65b292475d4f2a49db98b5c');
    const binding=JSON.parse(await readFile(join(folder,'demo-cron-target.json'),'utf8'));
    const evidence=await readFile(join(folder,'demo-cron-api-origin-evidence.json'));
    assert.equal(sha(evidence),binding.apiOriginEvidenceSha256);
});
