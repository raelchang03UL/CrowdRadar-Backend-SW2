# HU7: alcance y evidencia para revisión

Nicolás Kou / kowisprox, 28/10/2026. Candidato sobre develop backend43964f7 y frontend711384d, conservando su historial. El par final publicado se acredita en los PR compañeros. Los resultados siguientes describen el código HU7 probado localmente; no equivalen a merge ni revisión de otro integrante.

## Historias contrastadas con GitHub

| Historia | Resultado implementado y comprobado |
| --- | --- |
| [HU7.1, issue18](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/issues/18) | Pendientes, detalle con reporte/autor/total, motivos agrupados y decisión conservar/retirar con historial persistido. Nueva denuncia sobre un conservado devuelve Pendiente. |
| [HU7.2, issue19](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/issues/19) | Usuarios/estado, coincidencia parcial literal por nombre/correo y detalle con conteo de reportes distintos denunciados. |
| [HU7.3, issue20](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/issues/20) | Confirmación y motivo, suspensión, bloqueo de ingreso y sesiones previas, estado e historial. El texto del tercer criterio tiene la salvedad siguiente. |
| [HU7.4, issue21](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/issues/21) | Filtro Suspendidas, confirmación de reactivación, observación opcional y nuevo login permitido; sesiones anteriores siguen inválidas. |

**Salvedad de aceptación HU7.3:** el issue pide informar expresamente al iniciar sesión que una cuenta está suspendida. AuthService conserva el mensaje uniforme preexistente «Correo o contraseña incorrectos» para cuentas inexistentes, clave incorrecta y cuenta inactiva, conforme al contrato de autenticación ratificado previamente. El bloqueo está implementado y probado, pero no se declara cumplida esa redacción literal. Resolver su alineación con el equipo/JP antes de cerrar la historia; este cambio no modifica silenciosamente el contrato de login ni marca criterios en GitHub.

## Contrato y persistencia

Rutas `/api/admin/users` y `/api/admin/reports`, administrador activo revalidado desde BD, sin edición de roles. Consulta paginada, escrituras con revisión esperada y auditoría transaccional. Contrato exacto en [CONTRATO_API](CONTRATO_API.md), secciones HU7.

Ejecutar `npm run db:migrate` explícitamente sobre la base autorizada antes de iniciar.008 añade revisión/auditoría de usuarios;009 añade visibilidad/revisión/auditoría de reportes. El arranque solo comprueba esquema. Las migraciones anteriores se conservan sin reescritura. No usar force/alter ni adoptar bases históricas.

Retirar conserva reporte, votos, denuncias, premios e historial privado del autor. Lo excluye de consultas/participación y cálculos públicos actuales e históricos. No quita karma, no suspende al autor, no modifica cooldown y no permite restauración en este alcance. El administrador ve el autor y motivos agrupados; no se exponen identidades de denunciantes.

## Verificación realizada

| Nivel | Resultado |
| --- | --- |
| Node, `npm test` |198 aprobadas, cero fallidas/omitidas. Incluye permisos HTTP, contratos y regresiones previas. |
| PostgreSQL/HTTP reales, consulta de usuarios |4 bloques: conteos distintos, filtros/literales/páginas, permisos persistidos y preservación. |
| PostgreSQL/HTTP reales, cuentas |6 bloques:008 idempotente/concurrente, doble suspensión200/409, sesiones/recovery, reactivación, rollback de auditoría y páginas20+4. |
| PostgreSQL/HTTP reales, reportes |8 bloques:009 idempotente/concurrente, grupos2+1, denuncia nueva, decisión obsoleta409, rollback/doble decisión, exclusión pública/consulta privada, karma47 y premio conservados, analíticas, carrera denuncia/retiro e historial20+3. |
| Frontend compañero |612 aprobadas, dos opt-in previas omitidas; análisis limpio y Web release compilada. |
| Navegador IAB real |Web5567/API3067/PostgreSQL5447: búsqueda, suspensión/reactivación, nueva denuncia después de conservar, retiro, ambos historiales, acceso privado del autor y rechazo de terceros. Solo datos sintéticos, sin SMTP. |

Para repetir los runners HU7: utilizar únicamente una instancia local aislada y la base `crowdradar_hu7_test` con procedencia `CrowdRadar/SW2/HU7/local-test/v1`, creada nueva por su operador. No marcar una base existente para eludir la guarda. Aplicar las migraciones explícitas primero. Preparar un archivo privado ignorado con DB_HOST,DB_PORT,DB_NAME,DB_USER,DB_PASSWORD y las opciones locales necesarias; seleccionar su ruta:

```powershell
$env:CROWDRADAR_HU7_QA_ENV_FILE = (Resolve-Path .env.hu7-qa).Path
node scripts/verify-admin-users-db.js
node scripts/verify-user-moderation-db.js
node scripts/verify-report-moderation-db.js
```

Cada runner comprueba destino/procedencia y limpia únicamente sus fixtures. No ejecutar contra la demo de presentación ni bases personales/Sprint1/Supabase. Las secuencias pueden avanzar. `npm test` usa dobles/HTTP local; no reemplaza estos runners SQL.

## Revisión e integración pendientes

Revisión de otra persona, alineación del mensaje HU7.3, Android/lector de pantalla e integración autorizada del par. Los runners históricos R01/S3 no se repitieron en este corte. No se certifica Internet/nube ni se actualizan paquetes. Tras aprobar el par, aplicar migraciones antes de servir el backend y repetir el recorrido sobre los SHA integrados. Mantener Refs a las cuatro historias; no cerrarlas automáticamente.

La demo portable existente conserva SMTP deshabilitado y su aprovisionamiento manual; HU7 no crea administradores desde el registro público. Cada operador debe preparar sus propias cuentas ficticias en su base local autorizada para revisar moderación.
