# Configuración local reproducible

## HU8 local y preparación push — 30/10/2026

Aplicar npm run db:migrate explícitamente: conserva001–009 y añade010-user-favorites/011-saturation-push-alerts. El runtime solo comprueba esquema. No ejecutar sobre bases personales de QA, Sprint1 ni Supabase histórica. Tablas HU8 anteriores identificadas como004 requieren revisión explícita de origen; el migrador no las adopta ni borra.

FCM_PROJECT_ID configura el proyecto autorizado; Firebase Admin usa Application Default Credentials externas (por ejemplo GOOGLE_APPLICATION_CREDENTIALS hacia archivo fuera de Git). Nunca copiar service accounts, JWT o claves al repo ni al chat. Frontend requiere sus define de Firebase/VAPID y permiso de notificaciones del navegador. FCM no configurado conserva pendientes sin afirmar entrega.

PUSH_WORKER_ENABLED=false por defecto. En un servidor local persistente se puede habilitar true para reconciliar reportes reales y drenar cada5s; al cerrar el servidor se detiene. También se puede llamar POST /api/internal/push/process con secreto SATURATION_EVENT_SECRET mínimo32 por encabezado x-saturation-event-secret, cuerpo{}. Solo esta fuente interna calcula niveles, no acepta level del cliente. Configurar CORS_ORIGINS exactos para Web; no añadir este secreto a Flutter.

Para Vercel, un temporizador en memoria no garantiza ejecución: se debe aprobar y verificar un scheduler/ejecutor que invoque reconciliación y drain con presupuesto suficiente, exclusión por leases y monitorización. Este cambio no despliega ni crea cuentas/servicios de pago. La cola es al menos una vez; no promete entrega exactamente una vez ante respuesta ambigua de FCM.

QA reproducible: crear NUEVA crowdradar_hu8_test en clúster PostgreSQL local aislado con comentario CrowdRadar/SW2/hu8-20261030/v1; definir CROWDRADAR_HU8_QA_ENV_FILE hacia archivo externo con DB_NAME/DB_HOST/DB_PORT/DB_USER/DB_PASSWORD. npm run test:db:favorites comprueba identidad y procedencia antes de DDL/DML, no crea/adopta bases, no envía SMTP ni FCM real; verifica001–011 repetidas, HTTP concurrente, reportes reales y entrega FCM con doble. No equivale a push recibido/abierto en Web.


## Entrada vigente — revisión Web R01/S3, 19/10/2026

Para otro integrante: seguir [CATALOGO_DEMO_LOCAL](CATALOGO_DEMO_LOCAL.md), procedimiento completo sin rutas personales ni conexión QA. Clonar ambos repositorios en la rama `integration/cierre-web-r01-s03-20261019` cuando esté publicada; instalar desde locks en tu PC y configurar `.env.demo` privado desde el ejemplo vacío. Aprovisionamiento administrativo inicial MANUAL; CLI solo check/migrate/seed/serve contra la demo exacta identificada. API3043/Web5543,SMTP deshabilitado,sesión en memoria. No crea/adopta bases ni amplía databaseSafety.

Versiones comprobadas: Node22.20.0/npm10.9.3,PostgreSQL18.1,Flutter3.41.9/Dart3.11.5; SDK/dependencias/secretos fuera de Git. [Cierre de revisión](CIERRE_WEB_R01_S03.md) controla par/procedencia/pruebas; los PR acreditan publicación. No instalado en otra PC/Linux ni integrado/aceptado/desplegado por estas instrucciones.

Clonar la rama publicada obtiene código/documentación, no DB en ejecución,cuentas,SDK ni.env. Develop solo incorpora PR fusionados. No copiar carpetas temporales ni snapshots como instalación. Apartados QA/históricos inferiores conservan sus destinos y restricciones; no son requisitos para ejecutar la demo.

## Conservación de clones y procedimiento QA anterior

Usar una carpeta nueva para revisión; no reset/stash/limpieza sobre archivos ajenos. Para trabajo diario, develop sigue siendo la base integrada. La consolidación es una excepción aprobada de revisión, no base automática para siete implementaciones paralelas.

En un equipo nuevo, las dependencias se instalan desde los locks mediante npm ci / flutter pub get, con autorización de quien opera. En esta tarea solo se reutilizaron paquetes existentes; no se certificó instalación limpia en otra PC/Linux.

## QA de aceptación Web — 20/10/2026

Perfil explícito `CROWDRADAR_QA_RUN=cierre-20261019`: admite únicamente `crowdradar_cierre_fresh_20261019` y `crowdradar_cierre_legacy_20261019` en loopback, con procedencia `CrowdRadar/SW2/cierre-20261019/v1`. El runner R01 comprueba **ambas inexistentes antes de crear cualquiera**. No adopta, borra ni vuelve a marcar destinos existentes. El aprovisionamiento requiere un operador PostgreSQL local autorizado para CREATE DATABASE; las migraciones/fixtures solo se ejecutan después de conectar al destino aislado, nunca en una base de sistema. El rol usado aquí no se propone como rol de producción.

```powershell
# Desde el clon backend; archivo privado propio con DB_* locales, sin DATABASE_URL.
$env:CROWDRADAR_QA_RUN='cierre-20261019'
$env:CROWDRADAR_QA_ENV_FILE=Read-Host 'Ruta absoluta de configuración QA privada'
npm run test:db:consolidation  # solo primera ejecución; conservar las dos bases
npm run test:db:sprint3
$env:CROWDRADAR_S3_QA_DATABASE='crowdradar_cierre_legacy_20261019'
npm run test:db:sprint3
Remove-Item Env:CROWDRADAR_S3_QA_DATABASE
npm run test:db:recovery
npm run qa:serve  # API3053, loopback; CORS exacto Web5553; SMTP deshabilitado
```

En esta PC el par YA existe y se conserva. No repetir el primer comando para crear desde cero: el rechazo es intencional. Usar otra instancia PostgreSQL local aislada/aprobada si se necesita reproducir el aprovisionamiento; no cambiar nombres/guardas ni borrar datos para ensayar. Los runners posteriores exigen identidad/procedencia antes de migrar.

Desde frontend, en otra terminal y sin ejecutar los dos opt-in simultáneamente:

```powershell
$env:CROWDRADAR_QA_RUN='cierre-20261019'
$env:CROWDRADAR_QA_ENV_FILE=Read-Host 'Ruta absoluta del mismo archivo privado QA'
$env:CROWDRADAR_API_INTEGRATION='1'
flutter test --no-pub test/local_api_smoke_test.dart --dart-define=API_BASE_URL=http://127.0.0.1:3053
Remove-Item Env:CROWDRADAR_API_INTEGRATION
$env:CROWDRADAR_RECOVERY_INTEGRATION='1'
flutter test --no-pub test/local_recovery_api_test.dart --dart-define=API_BASE_URL=http://127.0.0.1:3031
Remove-Item Env:CROWDRADAR_RECOVERY_INTEGRATION
$qaWebOutput=Join-Path (Get-Location).Path ('build/qa-web-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
flutter build web --no-pub --dart-define=API_BASE_URL=http://127.0.0.1:3053 --output="$qaWebOutput"
node tool/serve_demo_web.mjs "$qaWebOutput" 5553
```

Recovery levanta su propio hijo privado3031, valida destino declarado y transporta enlaces únicamente por IPC al test; ningún buzón HTTP ni correo real. El smoke de cambio usa la API3053 iniciada y verificada sobre fresh. Ambos conservan cuentas sintéticas y aserciones de contraseña/JWT. Web5553 corresponde a este QA; la demo3043/5543 conserva sus datos/configuración. Resultados y límites en CIERRE_WEB_R01_S03.

## QA aislada anterior — destinos de 17/10/2026

1. PostgreSQL local y archivo privado con DB_HOST,DB_PORT,DB_USER,DB_PASSWORD. Nunca pegarlo en chat/Git. No usar DATABASE_URL remota.
2. Definir CROWDRADAR_QA_ENV_FILE con la ruta del archivo privado; ejecutar `npm run test:db:consolidation`.
3. El runner identifica y crea exclusivamente crowdradar_consolidacion_fresh_20261017 y crowdradar_consolidacion_legacy_20261017; se niega a adoptar bases existentes. Prueba desde cero/legacy,idempotencia,concurrencia,preservación,HTTP,rollback. No borra bases; no usar una base personal para repetirlo. Para una nueva ejecución local, revisar explícitamente otro par de destinos/guardas o usar una instancia PostgreSQL QA limpia, sin eliminar lo anterior automáticamente.
4. Tras la consolidación, ejecutar `npm run test:db:sprint3`: prepara007–009 en el destino QA y añade solo cuentas/observaciones QA nuevas en cada ejecución;7 bloques PostgreSQL/HTTP reales. Desde HU7, el runner de consolidación prepara001–009 y S3 comprueba también la preservación de las columnas de moderación; la API actual requiere is_public de009. Para repetir sobre legacy, definir CROWDRADAR_S3_QA_DATABASE=crowdradar_consolidacion_legacy_20261017 (la guarda solo acepta las dos bases del perfil QA seleccionado); se verificó7/7 también allí. Luego `npm run qa:serve` usa solo la base fresh ya probada,API en127.0.0.1:3033 (solo esta PC),SMTP deshabilitado. No copia.env ni altera datos personales. CORS exacto permite Web5533/5534.
5. El recorrido QA histórico usó API3033/Web5533 y una herramienta estática externa. No es requisito para otro integrante ni un despliegue. Demo3043/5543 y su servidor versionado están en CATALOGO_DEMO_LOCAL; no detener QA para ejecutarla.
6. Crear cuenta sintética propia por UI, entrar→lugar→reporte→perfil/historial. No hay credencial predeterminada. SMTP real requiere autorización y configuración por separado.

El runner CLI normal ahora prepara 001–007;005 reconoce explícitamente las dos historias publicadas de reportes y conserva sus claves/filas,006 añade karma yledger. Reportes antiguos empiezan sin premio retrospectivo. Si encuentra un esquema desconocido o una columna karma sin historial, detenerse y revisar; no borrar/adoptar automáticamente. 007 añade votos/denuncias e índice horario. Arranque solo SELECT/readiness.

Las reglas aprobadas para este incremento son cooldown3 minutos y premio10 puntos. Aunque la configuración histórica permita otros valores, cambiarlos requiere acuerdo explícito del equipo; no es una preferencia visual.

Las instrucciones siguientes describen la ejecución general de la base, no prueban una instalación nueva realizada hoy.

## Primer despliegue: procedimiento condicionado — 20/10/2026

Preparación autorizada; **ejecución cloud, creación de proyectos/cuentas, SQL remoto, pagos e instalaciones nuevas no autorizados en este cierre**. Este procedimiento se ejecutará en orden cuando exista un paquete aprobado. No confundir aceptación Web local con compatibilidad del runtime remoto. Decisiones y brechas en [arquitectura](ARQUITECTURA.md#arquitectura-candidata-de-primer-despliegue--20102026); seguimiento único en [plan técnico](PLAN_TECNICO_SW2.md#preparación-del-primer-despliegue--20102026).

### D0. Fijar versión, operadores y destinos

Registrar SHA backend/frontend realmente integrados, hashes de locks, versión Flutter/Dart/Node/npm, evidencia de aceptación y resultado de audit. El par publicado de entrada es B`05b399a` / F`4a227bb`; no usarlo como supuesto SHA de `develop`. Conservar versiones locales verificadas Flutter3.41.9/Dart3.11.5 y Node22.20.0/npm10.9.3; verificar el Node22.x efectivo de Vercel y dependencias nativas en Linux. No prometer una revisión patch exacta que el proveedor no permita fijar.

En cada clon elegido, registrar `git status --short`, `git rev-parse HEAD` y el hash SHA256 de `package-lock.json` o `pubspec.lock`. Un árbol con cambios sin identificar no constituye el artefacto de salida. Las versiones Node mayores disponibles y sus actualizaciones menores dependen del proveedor: revisar la [política oficial de Node](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) al ejecutar.

Rael coordina aprobación y registro del par; Diego aporta configuración/evidencia del SMTP existente; Nick y Manu se consultan ante diferencias del contrato/esquema de lugares/reportes. Esto no cambia asignaciones del Project ni atribuye implementación ajena. Elegir un operador de consola por servicio y custodia privada antes de compartir accesos; no compartir contraseñas de cuenta.

Acciones humanas mínimas: confirmar elegibilidad/cupo gratuito y operador; aprobar identidad de dos proyectos Vercel y un proyecto **nuevo** Supabase con región/project-ref/hosts/base/roles; autorizar remitente y destinatario de prueba Brevo; introducir secretos directamente en configuración privada. Nadie necesita pegarlos en chat o Git.

### D1. Preparar runtime y seguridad con pruebas locales

Antes de conectar Supabase, preparar y revisar el incremento de inicialización descrito en arquitectura: validación esperada por el handler, SELECT de readiness, configuración SMTP y pool único por instancia; fallo cerrado sin DDL. Probar configuración inválida, llamadas iniciales concurrentes y ausencia de esquema. Ejecutar `npm ci` desde lock en el entorno de build aprobado y `npm test`; esto es instrucción futura, no instalación realizada ahora.

Revalidar audit de producción y desarrollo por separado; la referencia publicada anterior registra10 paquetes (1crítico/5altos/4moderados). Clasificar ruta afectada y corrección compatible antes de exposición; cualquier riesgo residual requiere una decisión registrada, no `audit fix --force` ni equiparar tests verdes con ausencia de vulnerabilidades.

La API actual usa IP del socket para recuperación. Definir una política verificable de proxy/IP de Vercel y probar que una cabecera enviada por el cliente no elude límites ni hace que todas las personas compartan una IP. No activar `trust proxy=true` genérico. Conservar límites persistentes de recuperación y diseñar límites distribuidos para registro/login/lecturas/escrituras, presupuesto de consultas y respuesta429; CORS no reemplaza autenticación ni antiabuso. [Express detrás de proxies](https://expressjs.com/en/guide/behind-proxies/).

### D2. Autorizar y preparar solo el Supabase nuevo

La guarda actual bloquea Supabase y la base `postgres`; sigue así. Para el futuro proyecto nuevo, revisar una autorización de identidad exacta: project-ref, hosts direct/pooler, base, roles y operación. No añadir un flag global `ALLOW_SUPABASE`, renombrar una base para eludir la guarda ni relajar la protección de `postgres` local, Sprint1 o Supabase histórico. Primero pruebas negativas locales de destinos alternativos; después aprobación expresa del SQL remoto.

Crear roles mínimos: migrador DDL separado y API DML según consultas verificadas; sin superusuario/CREATEDB/DDL para API ni permisos amplios por comodidad. `MIGRATION_DATABASE_URL` solo en el entorno de migración, nunca Vercel runtime. API usa `DATABASE_URL`, `DB_POOL_MAX=1`, `DB_POOL_MIN=0` inicialmente; registrar límite de clientes/pooler, reserva y concurrencia máxima antes de carga. Un pool por instancia multiplica conexiones al escalar.

Copiar conexiones desde el panel. Candidato API: pooler transaccional; migración/backup: directa o sesión si la red no permite directa. Probar prepared statements/estado de sesión con las versiones reales pg/Sequelize; no copiar opciones de otro driver. Validar locks, premios atómicos, SET LOCAL y rollback bajo concurrencia. TLS debe verificar certificado/host mediante `DB_SSL=true`, `rejectUnauthorized:true` y CA correspondiente; probar rechazo de CA/host inválidos. Revisar además `sslcert`, `sslkey`, `sslrootcert` en URLs: pg puede sustituir el objeto SSL; no desactivar validación para conectar. [Supabase conexiones](https://supabase.com/docs/guides/database/connecting-to-postgres), [pg TLS](https://node-postgres.com/features/ssl).

Deshabilitar Data API en el panel del proyecto nuevo; comprobar REST y GraphQL sin exposición de tablas internas, incluidos permisos heredados `anon`/`authenticated`/`PUBLIC`. Flutter solo llama Express, conserva JWT propio y no necesita Supabase Auth ni claves cliente. [Procedimiento oficial](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api).

El operador aprobado debe abrir **Integrations → Data API**, desactivar **Enable Data API** y guardar evidencia depurada; comprobar además el acceso efectivo a GraphQL y permisos de funciones, sin deducir su cierre de un simple404. La consola y las conexiones SQL son superficies separadas: no entregar acceso privilegiado al JP por carecer Free de un rol solo lectura de Dashboard.

Ejecutar migraciones001–007 una vez mediante el CLI/rol migrador **después** de habilitar únicamente el destino aprobado. Conservar identidades históricas, registrar historial y repetir idempotencia; no correr fixtures/runners QA locales contra nube. Cargar solo catálogo/datos sintéticos aprobados con un procedimiento remoto independiente; los seeds locales no deben desbloquearse para aprovecharlos.

### D3. Configurar y verificar API/correo

En Vercel API, raíz backend y runtime Node compatible; secretos privados `DATABASE_URL`, `DB_SSL_CA`, `JWT_SECRET`, `SMTP_USER`, `SMTP_PASSWORD`; configuración `DB_SSL=true`, pool acotado, `CORS_ORIGINS` con **origen HTTPS exacto**, `PASSWORD_RESET_URL` HTTPS `/#/reset-password`, host/puerto SMTP y `MAIL_FROM` verificado. Ninguna variable migradora, clave Supabase, JWT o SMTP se compila en Web. Mantener3min/+10 y políticas aprobadas, no ajustarlas para demo. Previews necesitan origen y configuración explícitos; no permitir comodines de subdominios ni compartir producción automáticamente.

La lista de configuración del despliegue debe identificar el custodio y el entorno, sin copiar valores: API recibe `DATABASE_URL`, `DB_SSL`, `DB_SSL_CA`, `DB_POOL_MAX/MIN/IDLE_MS/ACQUIRE_MS`, `JWT_SECRET`, `CORS_ORIGINS`, `SMTP_HOST/PORT/USER/PASSWORD`, `MAIL_FROM` y `PASSWORD_RESET_URL`; el operador de migración recibe su `MIGRATION_DATABASE_URL` y TLS; Web solo `API_BASE_URL` pública. El adaptador ya selecciona TLS directo en465 y STARTTLS obligatorio en587; no inventar una variable `SMTP_SECURE` que el código no consume. Confirmar que la URL de reset apunta al Web realmente servido y que los cambios de variables crean el nuevo despliegue esperado.

Conservar Brevo/Adapter de Diego. Su evidencia previa no prueba este runtime. Vercel bloquea25 y permite465/587, pero SMTP requiere completar conexión/TLS/envío dentro del ciclo de vida. El proveedor recomienda HTTP por fiabilidad; cambiar transporte no está aprobado y no se propone reimplementarlo en este cierre. Probar SMTP existente con remitente/destinatario autorizados: frío/caliente, timeout, rechazo del proveedor, recepción y reset/aviso sin log de enlace. [Restricciones y ciclo SMTP](https://vercel.com/kb/guide/sending-emails-from-an-application-on-vercel).

La cola RAM actual no sobrevive a terminación de Function. `waitUntil` solo extiende una promesa hasta el límite de ejecución; no aporta persistencia, reintentos o confirmación de entrega. La aceptación del hosting requiere decidir y probar el nivel de fiabilidad del correo; si se exige recuperación tras caída, aprobar outbox/worker con custodia segura, expiración, reintentos e idempotencia. Una respuesta202 o aceptación SMTP no demuestra recepción. No exponer recuperación como operativa con esta puerta sin resolver.

### D4. Construir Web y publicar el par aprobado

En un clon limpio o build aislado del SHA frontend aprobado, usando Flutter fijado y los locks existentes:

```powershell
# Pasos para el futuro entorno de build aprobado; API pública, nunca secretos.
flutter pub get --enforce-lockfile
flutter analyze --no-pub
flutter test --no-pub
$deployApi = Read-Host 'URL HTTPS exacta de la API aprobada'
if (-not $deployApi.StartsWith('https://')) { throw 'Se requiere API HTTPS aprobada' }
$deployOutput = Join-Path (Get-Location).Path ("build/web-release-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
flutter build web --no-pub --dart-define="API_BASE_URL=$deployApi" --output="$deployOutput"
Get-FileHash -Algorithm SHA256 (Join-Path $deployOutput 'main.dart.js')
```

Registrar SHA/par/variables públicas/hash del artefacto y conservar salida anterior. Configurar proyecto Web Vercel como sitio estático, con esa salida exacta o build Linux equivalente reproducido; publicar por un operador autorizado mediante el mecanismo de artefactos/build aprobado, no versionar `build/` en el repositorio. Mantener `#/` y política referrer de OSM; no añadir rewrites de path innecesarios. Deploy API compatible primero, luego Web; son operaciones separadas. Comparar versiones desplegadas y hacer smoke del **par servido**, no de localhost. No se ejecutó ninguno de esos pasos cloud. [Build Flutter Web](https://docs.flutter.dev/deployment/web).

### D5. Operación, fallos y criterio de apertura

Antes de acceso compartido: login, permisos, filtros/detalle, reporte/karma/historial, participación/analítica, reset recibido e invalidación; fallos de DB, TLS, proveedor, timeout/concurrencia, reinicio y cuota. Registrar resultados por capa y SHA sin secretos. Logs: fecha, correlation-id, operación/código, duración y versión; excluir cuerpos auth, email, JWT, enlace, cadenas DB y PII. Definir retención y operador que consulta métricas/errores/cuotas; no prometer monitoreo24/7.

Propuesta inicial para aprobar: backup privado cifrado antes de cada migración y diario mientras la demo reciba datos; restauración ensayada en destino nuevo y autorizado, nunca encima de históricos. Esto propone RPO24h, no un resultado conseguido; RTO se medirá en el ensayo. Mantener custodia/retención y prueba de restauración, no subir dumps al repo. SupabaseFree no incluye backups automáticos; recomienda exportaciones externas. [Backups oficiales](https://supabase.com/docs/guides/platform/backups).

El runbook que se apruebe debe fijar operador, herramienta ya disponible, versión compatible de `pg_dump`/`pg_restore` o CLI, conexión directa/sesión privada, archivo fuera del repo, cifrado/custodia, retención y destino nuevo de restauración. Autenticar mediante configuración privada de PostgreSQL; no poner contraseñas o URLs completas en argumentos/logs. Ensayar restauración y comparar historial de migraciones, recuentos e invariantes de usuarios/reportes/ledger antes de afirmar que el backup es recuperable. La cuota de dos proyectos puede impedir ensayar una restauración remota gratuita: acordar un destino local aislado o cupo disponible, sin borrar proyectos para hacer espacio.

Rollback: conservar el par anterior compatible y sus configuraciones; retirar tráfico/promoción antes de exponer un cambio incompatible. Revertir despliegue de aplicación no revierte esquema ni datos: preferir migración correctiva hacia delante y restauración solo con aprobación, estimación de pérdida y destino identificado. Probar ambos lados y registrar si queda integración parcial; VercelHobby limita Instant Rollback al despliegue de producción anterior. [Alcance de rollback](https://vercel.com/docs/instant-rollback).

### D6. Coste cero y colaboración: verificación oficial20/10/2026

| Servicio | Condición actual relevante | Decisión operativa antes de ejecutar |
| --- | --- | --- |
| VercelHobby | Uso personal/no comercial, cuotas; sobrepasarlas puede suspender uso hasta renovación. Colaboración de código pública gratuita; privados requieren condiciones de equipo que Hobby no cubre y no se conectan repos de organizaciones a Hobby. | Comprobar elegibilidad del proyecto académico y operador; no prometer7 asientos gratis ni reescribir autores para desplegar. Si falla una condición, detener esa elección y pedir alternativa sin activar pago. [Hobby](https://vercel.com/docs/plans/hobby), [colaboración](https://vercel.com/docs/deployments/troubleshoot-project-collaboration), [restricciones Git](https://vercel.com/docs/limits#connecting-a-project-to-a-git-repository). |
| SupabaseFree | 2proyectos activos,500MB de base/proyecto,5GB egress, pausa tras1semana inactivo; miembros de Dashboard ilimitados, sin backup automático ni roles Read-only/project-scoped gratuitos. | Verificar cupo sin borrar proyectos existentes; cuentas propias con mínimo acceso disponible y evidencia depurada para el JP, no hacerlo administrador para visualizar. Prever reactivación y backup. [Precio](https://supabase.com/pricing), [roles](https://supabase.com/docs/guides/platform/access-control). |
| BrevoFree | 300envíos/día y1usuario de consola. | Operador actual custodia configuración; cada integrante desarrolla con entorno local sin compartir login. Cuota del proveedor no garantiza entrega de tareas que nuestra Function pierda. [Límites](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan). |

Presupuesto propuesto0, sin tarjeta/add-ons/upgrade automático, sujeto a aceptación de límites y disponibilidad de cuentas. Revalidar al ejecutar porque condiciones pueden cambiar. Este plan no concede autorización de despliegue ni convierte preparación cloud en criterio retroactivo de todas las HU Web locales.

### Control de salida y ejecución de D0–D6

| Paso / responsable de seguimiento | Entrada y acción concreta | Evidencia requerida antes del siguiente paso |
| --- | --- | --- |
| D0 / Rael | Par integrado revisado, operadores de cuentas y condiciones D6 aprobados; registrar identidad exacta de destinos nuevos y límite0. | Manifiesto sin secretos con SHA/locks/versiones, project-ref/hosts/base/roles, URLs y aprobación de operaciones. Si falta, continuar preparación local únicamente. |
| D1 / Rael, con revisión de otra persona | Incremento acotado de inicialización/IP/avisos, conservando SMTP y contrato. | PR y pruebas locales de arranque frío/concurrente/esquema ausente, rechazo de cabeceras falsas, presupuesto del pool y decisión por aviso; permiso específico para ejecutar el ensayo cloud. |
| D2 / operador Supabase identificado | Proyecto NUEVO autorizado, guardas específicas aprobadas, roles/TLS y conexión de migración privada. Aplicar001–007 solo al destino identificado. | Migraciones/idempotencia, API sin DDL, pruebas de rechazo TLS/destinos erróneos, Data API cerrada, transacciones concurrentes y reserva de conexiones; sin fixtures QA remotos. |
| D3 / operador Vercel y referente SMTP Diego | Configuración privada por entorno y remitente/destinatario autorizados; ejecutar ensayo del Adapter existente en runtime real. | Recepción y reset/aviso verificables, invalidación de sesiones, errores uniformes y prueba de timeout/terminación; decisión explícita sobre durabilidad y límites antes de ofrecer recuperación compartida. |
| D4 / operador de publicación identificado por Rael | API compatible publicada en el destino aprobado; build Web del SHA con URL HTTPS exacta. | Dos IDs/URLs de despliegue, par de SHA, hash Web, smoke autenticado del par servido y CORS positivo/negativo. Despliegue parcial registrado, sin declarar atomicidad. |
| D5 / operador de operación identificado | Par servido, datos sintéticos autorizados y runbook de backup/retirada aprobado. | Pruebas de fallos, logs depurados, control de cuota, restauración ensayada y retirada/rollback compatible con esquema; pendientes y responsable de respuesta registrados. |
| D6 / Rael | Revalidar límites y acceso de cada proveedor antes de D0 y de cada cambio de servicio. | Aceptación de coste0 y restricciones de colaboración. Si exige pago o permiso no aprobado, conservar la alternativa documentada y detener esa operación. |

La solicitud futura de ejecución será una sola: operadores/cuentas, dos proyectos Vercel, identidad Supabase nueva, SQL/migraciones aprobados, catálogo sintético, remitente/destinatario, secretos colocados privadamente, límite0 y mecanismo de retirada. Estos campos faltantes no se sustituyen por nombres inventados ni habilitaciones globales. Los cambios de runtime/guardas se revisan antes; ningún comando de los apartados cloud se ejecutó en este cierre.

## Antecedente de preparación de nube — 18–19/10/2026, no ejecutado

Arquitectura propuesta: navegador/Android → API propia HTTPS/JWT → PostgreSQL NUEVO; recuperación → adaptador SMTP/Brevo existente. Flutter recibe solo API_BASE_URL pública. Ninguna clave DB, JWT_SECRET, SMTP, anon/service-role de Supabase se compila en el frontend. No se usa Supabase Auth ni acceso directo a tablas desde el navegador.

Preparado y probado localmente: DATABASE_URL para API; MIGRATION_DATABASE_URL solo para CLI (fallback local a DB_*); DB_POOL_MAX/MIN/IDLE_MS/ACQUIRE_MS acotados, migrador max1; DB_SSL=true + DB_SSL_CA con rejectUnauthorized:true. La API no lee la URL del migrador. Tests no prueban permisos efectivos ni TLS remoto. Migraciones históricas y databaseSafety intactos: Supabase sigue bloqueado, sin bypass.

Pasos humanos mínimos, DESPUÉS de revisión y aprobación del proyecto/destino exactos:

1. Elegir un proyecto NUEVO y región, verificar condiciones/cuotas vigentes y aprobar presupuesto cero. No reutilizar Supabase histórico ni prometer gratuidad ilimitada.
2. Preparar roles separados: migrador propietario DDL; API sin superusuario/CREATEDB/DDL y con acceso solo a tablas/secuencias necesarias (incluidos límites de recuperación, ledger y votos). Probar permisos efectivos y denegaciones antes de cargar datos; no otorgar DELETE general por comodidad. Es un plan, no grants aplicados.
3. Copiar conexiones desde el panel, sin adivinar host. Evaluar pooler de transacción para API (inicialmente DB_POOL_MAX=1 por instancia) y directa/session para migración; comprobar compatibilidad del driver con prepared statements/estado de sesión. Nuestros locks y SET LOCAL son transaccionales; no se probaron sobre pooler remoto. Aplicar CA/TLS verificado; nunca rejectUnauthorized:false.
4. Deshabilitar Data API y comprobar que tablas internas no son accesibles vía REST/GraphQL; revisar grants por defecto y roles anon/authenticated. El navegador usa exclusivamente nuestra API. No afirmar que RLS por sí sola reemplaza autorización de Express.
5. Frontend estático: compilar localmente con API_BASE_URL=https://dominio-API-aprobado y publicar SOLO build/web en el proyecto Vercel autorizado, conservando referrer strict-origin-when-cross-origin. GoRouter usa fragmentos. SDK/build no van al Git del código. Aquí se compiló y sirvió localmente, no se ejecutó Vercel CLI ni un build cloud.
6. API en Vercel **BLOQUEADA, no compatible aún demostrada**: default export de app.js evita startServer/readiness/SMTP; falta inicialización única fail-closed, presupuesto de conexiones, pruebas de frío/caliente y ciclo de vida. No se añadió un archivo de despliegue que oculte esa brecha.
7. Correo serverless **BLOQUEADO**: queueDelivery vive en RAM tras 202, sin reintentos/durabilidad. Elegir paquete acotado (p. ej. outbox transaccional + trabajador aprobado) y probar fallos/reintentos/idempotencia antes de publicar. waitUntil solo prolonga trabajo, no garantiza entrega durable. Conservar el adaptador SMTP y probar Brevo/remitente verificado solo con autorización expresa.
8. Configurar secretos SOLO servidor, CORS con origen HTTPS exacto, URL reset HTTPS y política de proxy explícita basada en la plataforma (no trust proxy=true genérico). Validar límites distribuidos: recuperación ya persiste en PostgreSQL; falta estrategia general antiabuso/carga. Resolver los avisos compatibles de dependencias en paquete autorizado y probar el par antes de habilitar tráfico.

Referencias oficiales verificadas el 18/10/2026: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [conexiones/pooling/TLS Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [deshabilitar Data API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api). Son guías del proveedor, no evidencia de un despliegue nuestro. No se crearon cuentas, proyectos, roles remotos ni servicios.

### Puerta de demostración gratuita — revalidada 19/10/2026, no activada

- **Flutter Web/Vercel:** build local aprobado sobre el diff actual; servir build/web no necesita Android SDK. Falta un build reproducible Linux/CI con Flutter fijado, variables públicas por entorno y despliegue autorizado. Solo API_BASE_URL se compila como configuración pública, nunca secretos. Se conserva router con fragmento; no agregar rewrites de path innecesarios.
- **Express/Vercel:** el proveedor admite app.js/export por defecto o listener y ejecuta Express como una Function. Por tanto no se declara que Express sea incompatible. En NUESTRO código default app no ejecuta startServer: omite validateEnvironment/readiness y construcción SMTP. Falta una inicialización única y esperada, fail-closed, comprobable en frío/caliente y sin DDL; pool por instancia/budget total, puertos SMTP permitidos y pruebas sobre el runtime real. No se instaló CLI ni se hizo vercel dev/deploy. [Soporte oficial](https://vercel.com/docs/frameworks/backend/express).
- **Vercel Hobby/equipo:** gratuito para uso personal no comercial, con cuotas, no gratuidad ilimitada ni SLA. La documentación permite colaboración de código en repositorios públicos; restringe colaboración en privados y conexión de Hobby a repositorios de organizaciones. Los actuales son públicos/personales. Para siete estudiantes, acordar operador/propiedad/despliegue y no prometer siete asientos de consola gratis. No privatizar como sustituto de gestionar secretos ni reescribir autores para desplegar. [Hobby](https://vercel.com/docs/plans/hobby), [colaboración](https://vercel.com/docs/deployments/troubleshoot-project-collaboration), [restricciones Git](https://vercel.com/docs/limits#connecting-a-project-to-a-git-repository).
- **Supabase Free:** hasta dos proyectos activos, 500 MB de base por proyecto y 5 GB de egress; pausa tras una semana de inactividad y sin backups automáticos en Free. Dashboard admite miembros ilimitados, aunque granularidad avanzada de roles no equivale a Free. Prever backup/export sintético seguro y reactivación antes de demo. Ningún proyecto existente/nuevo fue consultado o cambiado. [Precio y límites oficiales](https://supabase.com/pricing).
- **Brevo Free:** 300 envíos diarios y un usuario de consola; no siete cuentas administrativas ni cuota por cada integrante. Mantener adaptador SMTP de Diego, remitente autorizado y custodia privada del operador. Falta configuración/recepción nueva en este par, no implementación del adaptador. No compartir login de consola ni secretos en Git/chat. [Límites oficiales](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan).

**Autorización Supabase pendiente:** databaseSafety bloquea Supabase y database=postgres. La base habitual de un proyecto nuevo se llama postgres: también requiere una excepción precisa, no quitar la protección global. Antes de habilitar nada, aprobar proyecto NUEVO identificado, región, project-ref, hosts direct/pooler exactos, nombre de base y roles. Una política limitada a esa identidad debe conservar el rechazo de postgres local/sistema, Sprint1, proyectos históricos y cualquier otro host. Probarla con dobles antes de SQL remoto; no un ALLOW_SUPABASE genérico ni cambiar DB_NAME para eludirla.

API: rol DML mínimo sobre tablas/secuencias necesarias, sin DDL/superusuario/CREATEDB. Migrador: URL/rol separados, sin distribuirlo a la API. Pool API inicial max1 por instancia (no uno para toda la nube), presupuesto de concurrencia global; migraciones directa/session, aplicación transaction pooler si se demuestra compatibilidad pg/Sequelize. Sin prepared statements nombradas ni estado de sesión fuera de la transacción; locks actuales son transaccionales y SET LOCAL. Seleccionar host/puerto del panel, no adivinarlo; probar concurrencia/cold-start con ese pooler. [Conexiones oficiales](https://supabase.com/docs/guides/database/connecting-to-postgres), [pool Sequelize](https://sequelize.org/docs/v6/other-topics/connection-pool/).

TLS verificado: DB_SSL=true, rejectUnauthorized:true y CA autorizada cuando corresponda, incluyendo migrador. La validación actual rechaza sslmode/ssl en URL, pero aún debe revisar también sslcert/sslkey/sslrootcert, porque pg puede reemplazar el objeto SSL con parámetros de conexión. No se probó TLS remoto ni se considera endurecimiento completo. Nunca usar rejectUnauthorized:false. [Advertencia oficial de pg](https://node-postgres.com/features/ssl).

Deshabilitar Data API en el proyecto nuevo y probar que los endpoints autogenerados no exponen usuarios, hashes, recuperación o tokens; revisar también grants de anon/authenticated y cualquier acceso GraphQL habilitado. Flutter habla únicamente con Express. No confundir permisos mínimos con tener tablas públicas protegidas por apariencia. [Data API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api).

**Correo y ciclo de vida:** mínimo de compatibilidad serverless propuesto, NO implementado: inyectar un planificador de tareas que registre/espere las promesas existentes con el mecanismo de plataforma, sin reimplementar SMTP ni exponer información de cuentas. waitUntil puede prolongar la ejecución dentro del límite de la Function; no aporta persistencia, reintentos ni recepción. La cola pendingDeliveries de RAM actual puede perderse y consume errores. [Semántica oficial](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil).

Para exigir entrega durable hace falta un paquete separado aprobado (p. ej. outbox transaccional + worker con lease/reintentos/expiración/idempotencia). Su diseño debe resolver custodia cifrada/retención del enlace temporal, no guardar token plano ni invalidar enlaces arbitrariamente en cada reintento; SMTP no permite prometer exactamente una recepción. No certificar ni el202 ni waitUntil como correo entregado. Conservar respuesta uniforme/límites PostgreSQL, token de un uso y15min, validación backend e invalidación de sesiones.

Antes de exposición: HTTPS para API/Web/reset por entorno, CORS por origen exacto (previews explícitamente aprobadas, no comodín), secretos solo servidor y ningún migrador en runtime. Aprobar política de IP/proxy de Vercel: hoy recuperación usa socket y detrás de proxy podría agrupar clientes; no activar trust proxy=true genérico. Login/lecturas/votos aún no tienen estrategia distribuida global de abuso/carga; CORS no es autorización ni defensa DDoS. Vercel incluye mitigación DDoS automática, pero tráfico servido antes de bloquear o no reconocido puede consumir cuota; no garantiza inmunidad ni reemplaza límites de aplicación. [Alcance oficial](https://vercel.com/docs/vercel-firewall/ddos-mitigation). Revisar avisos audit compatibles, cuotas, logs sin datos sensibles, backups/restauración y fallos de proveedor antes de demo pública. Todo esto sigue pendiente, no desplegado.

## Configuración general e historial HU3.6 (distinto de demo)

**Revisión HU 3.6:** la rama `feature/hu-3-6-filtro-saturacion` depende de HU 3.2 (padre backend `0605b51`). Para este par se usa también el frontend HU 3.6; los PR apuntan a sus padres HU 3.2 mientras no se integren. No hay paquetes, variables ni migraciones nuevas: requiere el esquema compartido de reportes ya indicado en HU 3.2. `npm run test:db:saturation-filter` solo verifica `crowdradar_auth_test` local previamente preparada; no crea bases ni migra, y revierte sus fixtures. No ejecutarlo en Sprint 1/Supabase. El recorrido Web puede usar datos transaccionales en esa base; esos datos QA no son niveles reales ni se confirman. Android queda pendiente para después.

Inicia PostgreSQL 18. Desde `psql` o pgAdmin, crea **solo si no existe** la base de desarrollo:

```sql
CREATE DATABASE crowdradar_dev;
```

En PowerShell:

```powershell
# Desde la raíz de tu clon backend; no requiere una ruta personal.
Copy-Item .env.example .env
# Edita .env y coloca la contraseña PostgreSQL y un JWT_SECRET largo y aleatorio propios.
# El bloqueo entre reportes del mismo usuario y lugar dura 3 minutos por defecto.
# Puedes cambiarlo con REPORT_COOLDOWN_MINUTES, usando un entero mayor que cero.
# Mantén DB_NAME=crowdradar_dev, DB_HOST=localhost, DB_PORT=5432 y PORT=3000.
npm ci
npm test
npm run db:migrate
# Opcional: tres lugares ilustrativos, nunca saturación real.
npm run db:seed:demo
npm start
```

`npm start` **no crea ni migra tablas**: `npm run db:migrate` prepara explícitamente `places` y `users`/`sessionVersion`. La migración `002-users-session-version` preserva las columnas y filas históricas; si encuentra un esquema desconocido, se detiene para revisión, sin borrarlo. El arranque autentica y verifica que la migración esté aplicada; ya no usa `User.sync()`. El usuario que migra necesita permiso de creación/alteración de tablas. Comprueba `http://localhost:3000/`; si `psql` no está en PATH, usa `& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -U postgres -d crowdradar_dev -c "\dt"`. `.env` está ignorado y `.env.example` no contiene secretos reales.

Para reproducir el mapa HU 3.1 antes de iniciar el servidor:

```powershell
npm run db:migrate
npm run test:db:places
# Opcional: tres lugares DEMOSTRATIVOS, no una fuente real.
npm run db:seed:demo
npm start
```

Los fixtures solo admiten PostgreSQL local con `crowdradar_dev` o `crowdradar_hu31_test`; la prueba de lugares crea/reutiliza únicamente la segunda y necesita permiso `CREATEDB`. `npm run test:db:auth` usa otra base exclusiva, `crowdradar_auth_test`, para probar usuarios, migración y concurrencia del cambio de contraseña. La migración bloquea destinos históricos/de sistema/Supabase; no se ejecutó remotamente. No borra tablas ni bases. Sin seed se obtiene una lista vacía. Una tabla `places` preexistente sin historial causa un error deliberado: revisar su origen, no borrarla ni usar `force`.

Después de aplicar HU 2.3, inicia sesión de nuevo: los JWT sin `sessionVersion` no se aceptan. El cambio exitoso de contraseña invalida todas las versiones anteriores y exige login en cada cliente; recargar Flutter también pierde su sesión local en memoria. La UI utiliza `POST /api/auth/password/change` con contraseña actual, nueva y confirmación. No hace falta una nueva variable de entorno ni instalar paquetes para este incremento.

La configuración opcional `DATABASE_URL`, `DB_SSL`, `DB_SSL_CA` y `CORS_ORIGINS` está descrita en el README y `.env.example`. `REPORT_COOLDOWN_MINUTES` también es opcional y toma `3` si no se define; controla el periodo de bloqueo de reportes de saturación por usuario y lugar. Mantén TLS verificado para una futura base remota autorizada. No hay despliegue en esta tarea.

### Recuperación de contraseña — hito C

Al actualizar este incremento, `npm run db:migrate` aplica además `003-password-recovery`: dos tablas nuevas para hashes de enlaces y límites persistentes, sin modificar usuarios ni reescribir 001/002. El arranque exige ese esquema y sigue sin ejecutar DDL. `npm run test:db:recovery` aplica/comprueba 003 exclusivamente en `crowdradar_auth_test` local, conservando los datos de otras ejecuciones.

`PASSWORD_RESET_URL="http://localhost:5500/#/reset-password"` define la base local confiable. Las comillas son obligatorias en `.env`: sin ellas dotenv trata `#/reset-password` como comentario y el arranque con correo se detiene por URL no confiable. El servicio añade el token a la query del fragmento; no utiliza cabeceras del cliente. Fuera de desarrollo/pruebas locales se exige HTTPS. No se admiten credenciales, query ni rutas distintas en la URL configurada. Con correo configurado, el arranque valida esa URL y se detiene si falta o no es confiable; sin correo, la API y el cambio autenticado arrancan aunque falte esa variable.

#### Correo por SMTP (Brevo)

Proveedor: Brevo (plan gratuito) por SMTP mediante `nodemailer`. Gmail se descartó porque la cuenta del proyecto no permitió crear contraseñas de aplicación; el adaptador es SMTP genérico y también funcionaría con Gmail (`smtp.gmail.com`, 465, contraseña de aplicación). Sin variables `SMTP_*`, `/password/forgot` sigue devolviendo 503 `RECOVERY_UNAVAILABLE` uniforme y no consulta cuentas; no hay flag de captura en el servidor normal. Para habilitar el envío en tu PC:

1. Crea tu cuenta Brevo gratuita, verifica tu teléfono y añade un remitente en ⚙️ → Senders, Domains & Dedicated IPs → Senders (confirmar el correo que llega).
2. En ⚙️ → SMTP & API → SMTP genera una clave SMTP. Copia el login (`…@smtp-brevo.com`) y la clave; solo se muestra una vez.
3. En tu `.env` (nunca en `.env.example`, documentos ni capturas compartidas) define `SMTP_HOST=smtp-relay.sendinblue.com`, `SMTP_PORT=587`, `SMTP_USER=<login>`, `SMTP_PASSWORD=<clave>` y `MAIL_FROM=CrowdRadar <remitente verificado>`. `MAIL_FROM` es obligatorio con Brevo.
4. Reinicia `npm start`. El log indica `envío por correo habilitado`. Una configuración incompleta, un puerto inválido o una `PASSWORD_RESET_URL` no confiable detienen el arranque con un mensaje sin secretos.

**Host:** usar `smtp-relay.sendinblue.com`, no `smtp-relay.brevo.com`. El 10/10/2026, desde Perú, `smtp-relay.brevo.com` resolvió al relay `smtp-relay-offshore-southamerica-east-v2`, cuyo certificado (Let's Encrypt) solo incluye nombres `sendinblue.com`; la verificación TLS fallaba (`ESOCKET`, altname inválido) y no se envió nada. Ambos nombres apuntan a la misma IP; con `sendinblue` la validación TLS completa y la autenticación son correctas. No desactivar la verificación de certificados para evitarlo.

El puerto 465 usa TLS directo; cualquier otro exige STARTTLS. La entrega es asíncrona y no se reintenta (cola en memoria): un fallo del proveedor no cambia la respuesta uniforme y solo registra su código (`EAUTH` clave rechazada, `ESOCKET` conexión/certificado), nunca destinatario, enlace ni token. Brevo reescribe el remitente `@gmail.com` a su dominio `brevosend.com` porque no puede firmar en nombre de Gmail; si no llega, revisar spam y Transactional → Logs en Brevo. Las contraseñas y enlaces nunca se escriben en documentos/logs.

Las pruebas construyen `PasswordRecoveryService` con `delivery.sendResetLink({email,resetUrl})` y `delivery.sendPasswordChangedNotification({email})`, y lo inyectan mediante `createApp({recoveryService})`. El transporte de memoria existe solo bajo `test/helpers`; se consulta después de `drainDeliveries()` dentro del proceso de prueba. Los runners QA separan sus presupuestos de abuso mediante un namespace de claves exclusivo de cada ejecución, conservando SQL/umbrales reales. Esto no se aplica al arranque normal.

No declarar HU 2.1/Sprint 2 terminados con un correo capturado: todavía faltan entrega real y recorrido manual de las plataformas afectadas.

### Antecedente HU3.2 aislada — no describe toda la consolidación

Este incremento local exige ejecutar `npm run db:migrate` antes de iniciar: añade `004-saturation-reports` después de 001–003 y el arranque verifica su existencia únicamente con SELECT. La migración es el archivo exacto `src/database/migrateReports.js` de `feature/hu-4-1-nivel-saturacion`, commit `d49578cfdff7ef5bdc77c97c14207642715f41b1`; requiere coordinar su integración con HU 4.1, sin copiar su endpoint POST ni cambiar su historial. `004-saturation-reports` y `004-places-direccion` son claves de historial independientes; conservar ambos nombres, sin renumerar migraciones aplicadas.

No se añade variable, paquete ni seed de niveles. La lista sigue siendo compatible; GET `/api/places/:id/saturation` consulta la estimación con JWT y muestra falta de información si no hay tres personas recientes. Regla provisional: 30 minutos, último reporte por persona, nivel más votado y empate sin nivel; aprobación del usuario no sustituye el acuerdo del equipo. Ver [contrato](CONTRATO_API.md).

```powershell
# Con PostgreSQL local y crowdradar_auth_test ya preparada por el runner auth:
npm run test:db:saturation
```

El runner rechaza destinos externos antes de conectar y fija exclusivamente `crowdradar_auth_test`, sin usar `DB_NAME` como destino ni crear/eliminar bases. Aplica migraciones explícitas, compara filas/historial previos, prueba SQL/HTTP/JWT con fixtures en una transacción y la revierte por completo. Las secuencias pueden avanzar; ninguna fila falsa se confirma. Ejecutar secuencialmente con otros runners que usen esa base para que las comparaciones de preservación no se superpongan. Android sigue sin validar por decisión del usuario; no se instala SDK/emulador ni se usa teléfono para este incremento.

### Reportes de saturación

La migración `004-saturation-reports` crea la tabla `saturation_reports` al ejecutar `npm run db:migrate`, después de las migraciones anteriores. El endpoint requiere JWT y permite los niveles `TRANQUILO`, `MODERADO` y `SATURADO`. El primer reporte se registra normalmente; los reportes posteriores del mismo usuario para el mismo lugar se rechazan durante `REPORT_COOLDOWN_MINUTES` (3 minutos por defecto). La migración no crea la base PostgreSQL ni modifica el archivo `.env` real.

## 3. Android y Flutter

Instala Flutter 3.41.9 estable fuera del repo y añade `<flutter>\bin` al PATH de usuario. Dart viene incluido. Instala Java 21 y Android SDK Command-line Tools, platform-tools/ADB, Platform 36, Build-Tools 36 y un emulador API 36; acepta las licencias de los paquetes instalados. Usa `flutter doctor -v` y `flutter devices` para comprobarlo. No se necesita Android Studio para la compilación por línea de comandos.

Con el backend aún en ejecución:

```powershell
# Desde la raíz de tu clon frontend.
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter emulators
# En esta PC: flutter emulators --launch CrowdRadar_API36
# Espera a que Android arranque y consulta el ID real con flutter devices.
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

El APK queda en `build/app/outputs/flutter-apk/app-debug.apk` y no entra a Git. Para teléfono físico, sustituye `10.0.2.2` por la IP LAN de la PC, permite el puerto 3000 en el firewall local y usa la misma red. `localhost` dentro de Android **no** es la PC. El backend acepta HTTP local; esta configuración no es apta para producción.

En esta PC con una ruta de usuario que contiene espacios, Gradle falló inicialmente con `Unable to establish loopback connection`. Se resolvió en la terminal de compilación usando una carpeta temporal corta ya creada (`C:\Users\RAELCH~1\t`) para `TEMP`, `TMP` y `JAVA_TOOL_OPTIONS=-Djava.io.tmpdir=C:\Users\RAELCH~1\t`. Es una contingencia local; no la copies si tu compilación normal funciona.

## 4. Flutter Web / Chrome (misma aplicación)

Con backend en puerto 3000, abre otra terminal normal:

```powershell
# Desde la raíz de tu clon frontend.
# Solo si todavía no están resueltos los paquetes: flutter pub get
flutter run -d chrome --web-hostname=localhost --web-port=5500 --no-pub --dart-define=API_BASE_URL=http://localhost:3000
```

URL: **http://localhost:5500/#/login**. Se conserva el router con fragmento `#/`; `/login` sin `#` no es la URL canónica. `web/index.html` solo inicia Flutter, no es otra aplicación. No desactives la seguridad del navegador. En esta PC Oracle ocupa `127.0.0.1:5500`: no detenerlo. `--web-hostname=localhost` enlazó Flutter a `::1:5500`, y localhost accedió correctamente por IPv6. Si falla, revisa `Get-NetTCPConnection -LocalPort 5500 -State Listen` y la resolución IPv6 de localhost; no cambies silenciosamente a 5000.

Para crear tu cuenta: Regístrate → nombre/apellido/distrito de 2 caracteres o más, correo único válido, contraseña propia de mínimo 8 caracteres y máximo 72 bytes, teléfono de 9 dígitos → Registrarme. El aviso confirma la cuenta y vuelve a login; usa ese mismo correo/contraseña. La cuenta persiste en `crowdradar_dev`; la sesión/JWT solo en memoria: recargar pide login. Nunca publiques la contraseña. El usuario demo opcional se documenta en README, sin claves predeterminadas.

Para reiniciar: en Backend `npm start`; en Frontend repite el comando Chrome anterior. Mantén ambas terminales abiertas; Ctrl+C detiene cada proceso propio. Para validar Web final: `flutter analyze --no-pub`, `flutter test --no-pub` y `flutter build web --no-pub --dart-define=API_BASE_URL=http://localhost:3000`. La carpeta `build/web` está ignorada.
