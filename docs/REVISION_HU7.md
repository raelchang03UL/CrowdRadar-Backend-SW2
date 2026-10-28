# HU7: alcance y evidencia para revisión

Nicolás Kou / kowisprox, 28/10/2026. Candidato sobre develop backend43964f7 y frontend711384d, conservando su historial. El par final publicado se acredita en los PR compañeros. Los resultados siguientes describen el código HU7 probado localmente; no equivalen a merge ni revisión de otro integrante.

## Historias contrastadas con GitHub

| Historia | Resultado implementado y comprobado |
| --- | --- |
| [HU7.1, issue18](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/issues/18) | Pendientes, detalle con reporte/autor/total, motivos agrupados y decisión conservar/retirar con historial persistido. Nueva denuncia sobre un conservado devuelve Pendiente. |
| [HU7.2, issue19](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/issues/19) | Usuarios/estado, coincidencia parcial literal por nombre/correo y detalle con conteo de reportes distintos denunciados. |
| [HU7.3, issue20](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/issues/20) | Confirmación y motivo, suspensión, bloqueo de ingreso/sesiones previas e historial. Con contraseña válida informa expresamente la suspensión, sin emitir sesión. |
| [HU7.4, issue21](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/issues/21) | Filtro Suspendidas, confirmación de reactivación, observación opcional y nuevo login permitido; sesiones anteriores siguen inválidas. |

**Aviso HU7.3:** AuthService devuelve403 ACCOUNT_SUSPENDED solo después de comprobar la contraseña. Flutter muestra un texto público fijo y conserva el formulario sin iniciar sesión. Correo inexistente/clave incorrecta mantiene401 uniforme; otros estados inactivos fallan cerrados. Ajuste autorizado por Nicolás el28/10 para cumplir el criterio. Recuperación de contraseña permanece uniforme. La revisión del equipo continúa pendiente; no se marcan criterios automáticamente en GitHub.

## Contrato y persistencia

Rutas `/api/admin/users` y `/api/admin/reports`, administrador activo revalidado desde BD, sin edición de roles. Consulta paginada, escrituras con revisión esperada y auditoría transaccional. Contrato exacto en [CONTRATO_API](CONTRATO_API.md), secciones HU7.

Ejecutar `npm run db:migrate` explícitamente sobre la base autorizada antes de iniciar.008 añade revisión/auditoría de usuarios;009 añade visibilidad/revisión/auditoría de reportes. El arranque solo comprueba esquema. Las migraciones anteriores se conservan sin reescritura. No usar force/alter ni adoptar bases históricas.

Retirar conserva reporte, votos, denuncias, premios e historial privado del autor. Lo excluye de consultas/participación y cálculos públicos actuales e históricos. No quita karma, no suspende al autor, no modifica cooldown y no permite restauración en este alcance. El administrador ve el autor y motivos agrupados; no se exponen identidades de denunciantes.

## Verificación realizada

| Nivel | Resultado |
| --- | --- |
| Node, `npm test` |200 aprobadas, cero fallidas/omitidas. Incluye permisos HTTP, aviso de suspensión/privacidad, contratos y regresiones previas. |
| R01 PostgreSQL/HTTP, corrección de revisión |6/6 bloques en una instancia nueva: bases fresh y legacy preparadas con001–009; filas y claves históricas conservadas. |
| S3 PostgreSQL/HTTP, corrección de revisión |7/7 en cada una de cuatro bases: fresh/legacy del cierre y fresh/legacy donde se reprodujo el fallo con006/007. Actualización aditiva, valores iniciales, idempotencia/concurrencia y preservación de usuarios/reportes anteriores. |
| PostgreSQL/HTTP reales, consulta de usuarios |4 bloques: conteos distintos, filtros/literales/páginas, permisos persistidos y preservación. |
| PostgreSQL/HTTP reales, cuentas |6 bloques:008 idempotente/concurrente, doble suspensión200/409, sesiones/recovery, aviso403 con clave válida y401 uniforme sin ella, reactivación, rollback de auditoría y páginas20+4. |
| PostgreSQL/HTTP reales, reportes |8 bloques:009 idempotente/concurrente, grupos2+1, denuncia nueva, decisión obsoleta409, rollback/doble decisión, exclusión pública/consulta privada, karma47 y premio conservados, analíticas, carrera denuncia/retiro e historial20+3. |
| Frontend compañero |615 aprobadas, dos opt-in previas omitidas; análisis limpio. |
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

Se reprodujeron los fallos de R01 y S3 antes de corregir su preparación: la API actual consulta is_public de009. Ambos runners aplican ahora las migraciones necesarias antes de importar/usar la API, manteniendo guardas, comprobaciones de preservación y migraciones históricas intactas. R01 exige que ambos destinos sean inexistentes; repetirlo en otra instancia aislada, nunca borrando bases. S3 conserva también las columnas de moderación que ya existan. Se repitieron npm test y los18 bloques HU7; frontend no cambió y sus resultados anteriores no se repitieron para esta corrección.

Revisión de la corrección por otra persona, Android/lector de pantalla e integración autorizada del par pendientes. No se certifica Internet/nube ni se actualizan dependencias del proyecto. Tras aprobar el par, aplicar migraciones antes de servir el backend y repetir el recorrido sobre los SHA integrados. Mantener Refs a las cuatro historias; no cerrarlas automáticamente.

La demo portable existente conserva SMTP deshabilitado y su aprovisionamiento manual; HU7 no crea administradores desde el registro público. Cada operador debe preparar sus propias cuentas ficticias en su base local autorizada para revisar moderación.
