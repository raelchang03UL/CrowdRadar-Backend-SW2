# Base Supabase de la demo — 04/11/2026

El único destino fijado es el proyecto nuevo `crowdradar-demo-web`, ref `ycxuhejpehmdfbvdplpl`, de la organización Free `CrowdRadar Rael` (`uuvuyytnogzwbgikwdyy`). La inspección remota inicial READ ONLY del04/11/2026 a21:50:37.245Z comprobó PostgreSQL17.11, TLS, ausencia de objetos de usuario en `public`, tablas `auth.users`/`storage.objects`/`storage.buckets` vacías y roles demo aún inexistentes. Data API desactivada y SSL obligatorio se comprobaron en Dashboard. Posteriormente se completaron bootstrap, migraciones canónicas, grants mínimos, comprobación de ambos roles y catálogo remoto; la repetición de migraciones informó sin cambios. Las bases y fixtures históricos mantienen sus restricciones.

`src/config/demoSupabaseTarget.js` fija exactamente project-ref, organización/titular, evidencia SHA-256, procedencia, esquemas observados, host/puertos/usuarios y CA. Evidencias depuradas del coordinador: `../qa/supabase-created-evidence.json` (SHA256 `b17e91771b65d68d1e5a971e6dd215e550ffa6d5c333e9193bd70838101da68e`) y `../qa/supabase-preflight-readonly.log`. Un perfil ausente o cualquier otro destino siguen rechazados antes de SQL.

## Identidad y autorización

El perfil versionado procede de evidencia verificada del proyecto **nuevo**: project-ref, ID/nombre de organización, email del titular verificado en Dashboard, momento observado de creación/verificación, huella de esa evidencia, identificador de procedencia, inventario inicial de esquemas, endpoints/usuarios exactos y huella SHA-256 de la CA de cada endpoint. No se aceptan estos datos desde una variable `ALLOW_*`, un dominio genérico, argumentos CLI ni una petición HTTP. Un nombre de host parecido no concede permiso.

`creationEvidenceKind=dashboard-observed-creation` identifica la evidencia de creación observada: `observedCreationAt` es el momento registrado durante esa creación y `verifiedAt` una comprobación igual o posterior. No se presenta como un `created_at` de la API del proveedor. `organizationName` y `ownerAccountEmail` nombran lo verificado en la interfaz; no inventan un slug ni un ID interno de cuenta. Se conservan los nombres SQL de la nueva tabla privada: `created_at` almacena ese momento observado y `owner_account_id` el identificador email verificado; `provisioned_at` sigue siendo el reloj PostgreSQL del aprovisionamiento. Esta aclaración no cambia migraciones001–012 ni adopta automáticamente una base.

`CROWDRADAR_DEPLOYMENT=demo-vercel-20261104` selecciona la configuración estricta; no autoriza por sí solo. El runtime Vercel exige ese identificador. Las URLs deben carecer de parámetros y fragmentos: no pueden sustituir la verificación SSL. Se exige una CA con la huella prevista, `rejectUnauthorized:true` y comprobación de hostname. Los secretos siguen fuera de Git.

| Conexión | Uso y restricciones |
| --- | --- |
| `DEMO_BOOTSTRAP_DATABASE_URL` | Operación administrativa explícita sobre el único destino aprobado; no se entrega a la API. Comprueba inventario y vacío inicial antes de crear roles/procedencia. |
| `MIGRATION_DATABASE_URL` | `crowdradar_demo_migrator`, sin superusuario, CREATEDB, CREATEROLE, REPLICATION, BYPASSRLS, membresías ni creación de otras bases/esquemas. Puede crear/alterar objetos de `public`. |
| `DATABASE_URL` | `crowdradar_demo_api`, sin propiedad de tablas, membresías, DDL ni tablas temporales. Grants explícitos por tabla y secuencia según consultas existentes. |

El bootstrap comprueba ausencia de objetos de usuario en `public`, inventario exacto de esquemas y ausencia de usuarios/objetos/buckets en las tablas de plataforma verificadas. No adopta roles, esquemas ni marcas preexistentes. Crea la procedencia en `crowdradar_demo_identity`, cuyo esquema y tabla pertenecen a `postgres`; API/migrador solo pueden leerla. La guarda detecta permisos de escritura tanto de tabla como por columna.

La API comprueba identidad efectiva, conexión TLS, privilegios y procedencia antes de los SELECT de readiness; no ejecuta DDL. La capacidad de migración requiere la misma comprobación, vive cinco minutos y pertenece únicamente a la instancia Sequelize/configuración validada. Un cambio de gestor, base, host, puerto, usuario o TLS, incluso durante la validación, la invalida. La CLI canónica comprueba esa capacidad antes de cada función y la revoca al terminar. Las funciones/migraciones históricas001–012 se conservan sin cambios.

## Operaciones explícitas y comprobación remota

`scripts/demo-supabase.js` admite `preflight`, `bootstrap`, `check-api`, `check-migration`, `grants` y `catalog`. El archivo privado de configuración debe seleccionarse explícitamente mediante `node --env-file`; este script no carga `.env` de forma implícita. La migración sigue siendo `scripts/migrate.js`, con las funciones canónicas en su orden existente. El coordinador dispone de helpers privados fuera del backend: preparan `../private/database-env.json` con creación exclusiva, roles aleatorios distintos y URLs codificadas, y ejecutan un modo explícito cada vez. La API/Vercel recibe únicamente las secciones `shared`+`api`; nunca credenciales de bootstrap/migrador.

La carga de catálogo incorpora los cinco lugares demostrativos existentes, con identificadores negativos; no siembra usuarios ni observaciones de saturación. Un conflicto de ID/nombre/datos detiene la operación. El smoke HTTP posterior creó un usuario QA común y un reporte `MODERADO` en el lugar−2001; añadió y retiró un favorito, comprobando persistencia tras nuevos logins. Los grants permiten solo las operaciones SQL utilizadas; `UPDATE(id)` sobre `places` es necesario para los locks de favoritos/alertas de PostgreSQL. La API puede borrar límites expirados para la limpieza acotada del ejecutor autenticado. No tiene escritura sobre historial de migraciones ni procedencia.

API: Supavisor transaccional, una conexión Sequelize por instancia, mínimo cero y liberación ociosa breve. Migraciones: conexión directa o pooler de sesión en el endpoint exacto aprobado. Las consultas pg/Sequelize actuales no usan prepared statements con nombre. El pool de una conexión es una decisión conservadora para esta demo y exige comprobar que cada consulta dentro de una transacción reciba esa transacción. No limita por sí solo el total de conexiones al escalar ni acredita rendimiento remoto. [Conexiones oficiales de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

La conexión administrativa de sesión/TLS se comprobó en la inspección inicial. Los checks de API/migrador posteriores al aprovisionamiento pasaron; la API desplegada comprobó readiness y ejecutó las transacciones de favorito/reporte por su configuración de pooler. Data API está desactivada en Dashboard; la comprobación efectiva de no exposición de REST/GraphQL sigue pendiente. No se acredita carga ni suspensión/reconexión del proveedor.

Evidencias remotas conservadas en `../qa` respecto del backend: `supabase-bootstrap.log`, `supabase-migrations-first.log`, `supabase-migrations-replay.log`, `supabase-api-grants.log`, `supabase-role-checks.log` y `supabase-catalog.log`. El recorrido HTTP `remote-write-one-user-one-report-20261104-smoke01.json` terminó PASS a22:22:25.318Z:34 solicitudes y99 comprobaciones; usuario1, reporte1 y favorito retirado. No usó SQL directo ni envíos SMTP/FCM. El despliegue API correspondiente es `dpl_Ak4MTJFq4S9PzH44fVUvuTmcipj7`, fuente `7780db488892a0dc3c45edfc7a9622b846e71847`.

Una lectura posterior con el rol API, TLS/procedencia y transacción READ ONLY REPEATABLE READ, a22:28:56.825Z verificó15 tablas,13 entradas del ledger canónico, cinco lugares, dos usuarios, un reporte, un favorito, un dispositivo Web FCM activo y cero outbox. La cuenta humana indicada tenía Kennedy como favorito. Son conteos de ese snapshot, no valores permanentes; no se retornaron correos, tokens ni bindings (`../qa/supabase-api-readonly-summary.json`). Los13 archivos históricos conservan los blobs Git de `db926c84`; la diferencia de bytes del checkout es únicamente LF→CRLF por `core.autocrlf=true`, con ambas huellas registradas.

## Respaldo privado y restauración aplicacional verificados

El coordinador ejecutó un respaldo READ ONLY del proyecto exacto a22:58:00.812Z, con snapshot consistente, y restauró esquema/datos en la base local **nueva** `crowdradar_demo_restore_20261104`, puerto55491. Resultado PASS a22:58:59.515Z: conteos iguales al snapshot,20 FK validadas, ocho secuencias comprobadas,13 entradas canónicas y catálogo5. Archivo custom de54.655bytes, SHA256 `1d6518f3087db945d2b92d662f4d8f231a7c560dbeec3f9576eca39603a73e5f`. [Resumen público depurado](evidence/demo-20261104/public-backup-restore-summary.json).

Solo se copiaron `public` y `crowdradar_demo_identity`; no roles, ACL, Vault, cron, http ni schemas de plataforma. El archivo contiene datos personales, hashes de contraseña y tokens: permanece privado, al igual que logs y copia restaurada, con ACL del titular verificadas. No se incluyen aquí filas ni correo humano. El ensayo utilizó el helper local `../qa/demo-private-backup-restore.mjs`, fuera del producto; no acredita recuperación completa de infraestructura, secretos, permisos cloud ni restauración remota.

Para repetir por un operador autorizado: verificar primero project-ref/host/usuario/CA/procedencia exactos; usar pooler de sesión5432 y entorno libpq limpio, con contraseña únicamente en un `PGPASSFILE` privado protegido. Crear un directorio privado nuevo que no exista. Estos comandos ilustran las herramientas; no sustituyen las guardas ni el inventario permitido del ensayo:

```powershell
$env:PGHOST = 'aws-0-us-east-1.pooler.supabase.com'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = 'postgres.ycxuhejpehmdfbvdplpl'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = 'C:\privado\supabase-ca.crt'
$env:PGPASSFILE = 'C:\privado\source.pgpass'
$env:PGOPTIONS = '-c default_transaction_read_only=on'
pg_dump --format=custom --schema=public --schema=crowdradar_demo_identity --strict-names --no-acl --no-comments --no-security-labels --no-publications --no-subscriptions --no-tablespaces --no-large-objects --file='C:\privado\respaldo-nuevo\application.dump'
pg_restore --list --file='C:\privado\respaldo-nuevo\toc.txt' 'C:\privado\respaldo-nuevo\application.dump'
```

Antes de restaurar: verificar SHA256 y TOC, rechazar objetos/funciones inesperados y excluir únicamente la creación del schema `public` ya existente. Verificar físicamente el clúster local55491 y su procedencia; exigir ausencia de la base nueva, crearla con propietario migrador local sin privilegios globales y revocar acceso PUBLIC. No usar `--create`, `--clean` ni desactivar triggers. Cambiar **todos** los parámetros PG de conexión al destino local verificado, incluidos CA/passfile; `PGHOST=localhost`, `PGHOSTADDR=127.0.0.1`, `PGPORT=55491`, `PGDATABASE` igual a la base nueva y `PGUSER` al migrador LOCAL. Mantener verify-full y usar `PGOPTIONS=-c default_transaction_read_only=off` solo para esta restauración local:

```powershell
pg_restore --dbname=crowdradar_demo_restore_20261104 --no-owner --no-acl --no-tablespaces --no-security-labels --no-publications --no-subscriptions --single-transaction --exit-on-error --use-list='C:\privado\respaldo-nuevo\restore.list' 'C:\privado\respaldo-nuevo\application.dump'
```

Comparar conteos del snapshot, catálogo, ledger, FK validadas y secuencias antes de declarar éxito. Una base existente o un error requiere revisión; no adoptar ni borrar automáticamente. REST `/rest/v1/` y GraphQL `/graphql/v1` devolvieron401 sin credenciales a22:52:57Z: eso confirma rechazo anónimo, **no** prueba Data API desactivada; la configuración Dashboard es evidencia separada.

## Evidencia local y límites

Se creó un clúster PostgreSQL18.1 exclusivo en `tmp/cierre-demo-web-20261104/qa/postgres`, loopback `127.0.0.1:55491`, base de usuario `crowdradar_demo_infra_test`. No se migró `postgres` de sistema ni se reutilizó otra instancia. TLS usa una CA local de prueba de tres días; claves y configuración privada permanecen fuera del repositorio backend y bajo permisos del usuario local.

El harness `test/helpers/demoSupabaseLocalHarness.js` solo se activa mediante `test/demo-supabase-local.test.js` con `CROWDRADAR_DEMO_SQL_QA=local-20261104` y `node --experimental-test-module-mocks --test test/demo-supabase-local.test.js`. Sin ese opt-in, la suite normal lo omite. Antes de SQL verifica directorio físico del clúster, dirección, puerto y comentario de procedencia. No conecta con Supabase.

El adapter exclusivo de prueba hace exactamente tres transformaciones, registradas en la evidencia:

1. `REVOKE CREATE,TEMPORARY ON DATABASE postgres FROM PUBLIC` se dirige a la base de usuario del fixture.
2. El `GRANT CONNECT ON DATABASE postgres` equivalente se dirige a esa misma base de usuario.
3. La columna `current_database() AS database` se comprueba contra el nombre real del fixture y se normaliza al nombre contractual `postgres` para probar el resto de la guarda.

El perfil y endpoint sintéticos se inyectan únicamente mediante el módulo de pruebas; son independientes del proyecto real fijado. Estas transformaciones permiten probar SQL/permisos reales sin tocar una base de sistema; **no prueban identidad, propiedad, hostname ni TLS de Supabase**. La evidencia remota se identifica separadamente en los apartados anteriores.

Resultados conservados bajo `../qa` respecto del backend:

- `db-safety-unit-final.log`:13/13 pruebas focalizadas de configuración/guardas; incluyen cambios internos del gestor, verificador TLS inesperado y carrera durante autorización.
- `db-local-sql-second.log` y `db-local-sql-evidence-initial.json`:9 bloques SQL más el test padre,10/10; bootstrap desde vacío,001–012 y13 entradas históricas, repetición idempotente, permisos y readiness.
- `db-local-sql-final.log` y `db-local-sql-evidence.json`: comprobación posterior de permisos por columna, membresía y privilegios efectivos, reconexión y rechazo real de CA/hostname incorrectos. El bloque de vacío inicial se omite al repetir porque su resultado inicial se conserva; no se vuelve a adoptar ni reinicializar la base.
- `db-migration-byte-preservation.json`:13 archivos históricos con hash Git canónico conservado; la verificación posterior de bytes crudos distingue CRLF de checkout en `supabase-api-readonly-summary.json`.
- `runtime-db-smoke-rerun.log`:7/7 bloques SQL/HTTP con rol API y pool uno; registro/login/favorito/tres reportes, reconciliación concurrente con un evento, claim sin envío doble, backoff/reintento con proveedor simulado y conexión libre durante la entrega. Ocho consumos concurrentes persistieron y tres fueron permitidos;701 límites vencidos se eliminaron en lotes500+201 conservando la ventana reciente. API temporal3054 y pools del runner cerrados; fixtures sintéticos locales conservados.

Las pruebas locales anteriores no enviaron correos ni push reales ni ejecutaron SQL remoto. El aprovisionamiento y el smoke remoto posteriores tienen sus propias evidencias indicadas arriba. La suite final pasó266 pruebas, con0 fallidas y1 opt-in omitida (`backend-publication-full-network.log`), incluidas las cuatro pruebas del operador de cron; la inicialización local con configuración de API y base remota pasó configuración/imports/readiness (`backend-runtime-diagnostic-readiness.txt`).

## Ejecución periódica autorizada y activa

Por autorización explícita de Rael se preparó y activó `pg_cron`1.6.4 con `http`1.6 y Vault0.3.1; `pg_net` permanece ausente. Job1, `crowdradar-demo-push-20261104`, ejecuta cada minuto sobre el origen fijo `https://crowdradar-demo-api.vercel.app`. La preparación creó ambos interruptores apagados; activación a22:32:26.761Z verificó primero el resultado `DISABLED` sin envío y confirmó `active=true`/`enabled=true` en una transacción (`supabase-cron-prepare.log`, `supabase-cron-activation.log`).

La primera ejecución automática comenzó22:33:00.086Z y terminó233ms después: SQL succeeded, HTTP200, `configured:true,evaluated:1,sent:0`, sin fallos (`supabase-cron-first-run.log`). Tras tres reportes QA autorizados en Kennedy, la ejecución22:35:00.128Z terminó3,235s después con `sent:1`, una fila outbox SENT y failures0 (`supabase-cron-after-transition.log`). Ese primer envío acredita aceptación del proveedor; su recepción humana no quedó confirmada.

El usuario aclaró que no estaba seguro de haber recibido la alerta y pidió repetir. Tres reportes QA `MODERADO` (6/7/8) a22:45:30 provocaron una nueva transición; el cron automático22:46:00 produjo HTTP200, `evaluated:1,sent:1,configured:true` y outboxSENT2 acumulados. El check de la CLI canónica a22:46:10.429Z confirmó la misma huella prosrc, ambos interruptores activos y cero fallos; también conservó los diez ciclos22:36–22:45 con sent0, comprobando ausencia de nuevos envíos sin transición. Evidencias: `fcm-kennedy-repeat-20261104.json` y `supabase-cron-after-repeat.log`. No hubo dispatch FCM manual.

Rael confirmó en el chat a17:46 America/Lima: «Sí, llegó y abrió Parque Kennedy». La lectura API de22:46:44.297Z correlaciona evento2/lugar−2005 con SENT a22:46:00.409Z, un intento, ningún código de error y cero outbox para las cuentas QA (`supabase-outbox-after-repeat.log`). Esto verifica recepción y apertura del flujo HU8 en la demo Web con pestaña viva. No acredita Android ni navegador cerrado. La aceptación humana y los ciclos sin cambio quedan resumidos en `../qa/cron-operational-followup-20261104.json`.

HTTP está aislado en `crowdradar_demo_http`, esquema propiedad postgres sin USAGE para API/migrador. El ejecutor privado es SECURITY DEFINER con search_path=pg_catalog, URL literal y procedencia fijadas. Los grants de Vault/cron administrados por Supabase se conservan, incluidos los de service_role; ese rol/plataforma sigue siendo de confianza. API/migrador no tienen acceso a esos esquemas ni al secreto. Data API permanece apagada, sin wrappers públicos que lean Vault y sin credenciales administrativas en Vercel.

El sondeo manual a22:23:48.443Z verificó readiness200, POST interno sin secreto401 y una ejecución autenticada200, sin redirección, con `configured:true`, `evaluated:0`, `sent:0` (`demo-cron-api-origin-evidence.json`). Esto acredita el contrato del ejecutor y su configuración, sin entrega a dispositivos.

El cliente `http` puede seguir redirecciones futuras; el sondeo directo previo no elimina ese riesgo y debe repetirse tras cambios. Conexión5s, espera HTTP55s y statement_timeout58s frente a Function60s: un timeout es resultado incierto, no cancelación del API. Ante excepción hay65s de pausa antes de reintentar; tres fallos consecutivos o401/403/3xx observable apagan ambos interruptores. Lote50/envío secuencial y reintentos del SDK no garantizan terminar dentro del plazo. Lease2min y fence por intento no evitan un duplicado si FCM acepta y la Function termina antes de guardar SENT. No se habilitaron pagos; vigilar recursos, cuotas y pausas del plan Free.

## Operación reproducible del cron

`scripts/ops/demo-cron.mjs` reúne inspección, preparación y control del único destino fijado. Requiere `--config` con ruta absoluta a un JSON privado **fuera del repositorio**, formato del coordinador `{version:1,projectRef,shared,bootstrap}`. `shared` contiene `CROWDRADAR_DEPLOYMENT`, `DB_SSL`, `DB_SSL_CA`; `bootstrap` contiene `DEMO_BOOTSTRAP_DATABASE_URL`. No se incluyen secretos en estos comandos ni se suministra el archivo a Vercel. La CLI, SQL y dos JSON de evidencia pública están excluidos del despliegue.

```powershell
# Sustituir por la ruta privada autorizada del operador.
$cronConfig = 'C:\ruta-privada\database-env.json'
node scripts/ops/demo-cron.mjs check --config $cronConfig --plan
node scripts/ops/demo-cron.mjs check --config $cronConfig
# Desactivación explícita: ambos interruptores en false dentro de una transacción.
node scripts/ops/demo-cron.mjs disable --config $cronConfig
# Solo para reactivar el mismo job después de revisar la causa de una parada.
node scripts/ops/demo-cron.mjs activate --config $cronConfig
```

`--plan` valida argumentos sin leer configuración ni abrir red/SQL; no certifica credenciales. `check` usa READ ONLY y devuelve estado/logs agregados, sin secretos. `activate` exige ambos interruptores apagados, health ready200/401 directo y prueba DISABLED antes de activarlos; no hace un dispatch manual. `probe-disabled` permite esa prueba separada. `inspect-readonly` inspecciona versiones/permisos. `prepare-disabled` conserva la operación inicial para revisión y exige además `--secret-file` en el directorio privado; rechaza objetos existentes y no debe repetirse sobre el job actual.

La operación requiere revisar `active`, `enabled`, `failures` y `configured`: un HTTP200 con `configured:false` conserva reconciliación y no dispara la parada por fallos HTTP. No hay alerta externa automática ante una parada. `disable` también exige archivos de configuración/evidencia y función sin deriva; una discrepancia detiene la CLI y requiere revisión del propietario, sin eludir las guardas.

El control verifica job1/nombre/cron/URL/procedencia, metadatos de función y SHA del cuerpo. Plantilla SQL SHA256 `9cd33ae675dadaa91446f71bfe0bc32fd7102ccb8eaaae10b5b322dc68c612b3`; prosrc desplegado `f210e0996ded6d627a592a758de28c365fcc6fd6b65b292475d4f2a49db98b5c`. `.gitattributes` conserva exactamente los bytes SQL/JSON. Cuatro pruebas focalizadas comprobaron parsing, rechazo de config ajena, `--plan` con red bloqueada y ambas huellas; la suite final posterior incluyó esos casos (266 aprobadas/1 opt-in omitida). El empaquetado no volvió a mutar SQL remoto.
