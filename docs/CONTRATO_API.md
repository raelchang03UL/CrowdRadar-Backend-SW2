# Contrato API compartido

Decisiones de aceptación20/10/2026 ratificadas por Rael: HU1.1/HU2.1responden uniformemente sin revelar existencia de cuentas;HU3.3muestra dirección verificada si existe y «Dirección no registrada» si falta,sin inventar datos;«cercanos»enHU3.5/HU3.6significa catálogo disponible,sinGPSni radio. Sustituyen las redacciones heredadas de esos criterios,conservadas como antecedentes en Issues. No modifican JSON,SMTP ni implementación. Las políticas provisionales de reportes/confiabilidad/períodos ya están autorizadas;no requieren nueva aprobación por ejecutar QA.

Contrato del candidato R01/S3 en `integration/cierre-web-r01-s03-20261019`. Origin/develop comprobado `ffe9b19` ya contiene autenticación/SMTP/mapa de Diego; la consolidación reúne Nick/Manu y correcciones. Publicación acreditada por PR no implica integración en develop, aceptación ni despliegue. Sin cambios JSON de negocio por F11/demo; pruebas actuales en CIERRE_WEB_R01_S03.

JSON UTF-8; JWT Bearer en rutas protegidas. Ejecución QA: http://localhost:3033; configuración habitual por entorno. El cliente nunca conecta directamente a PostgreSQL.

## HU7 — primer incremento de consulta administrativa, 27/10/2026

Alcance local aprobado por Nicolás Kou: permisos de administrador y HU7.2 de extremo a extremo. Issue de referencia: backend #19. Las operaciones de suspensión, reactivación y revisión de reportes pertenecen a los siguientes incrementos; esta sección no las declara implementadas ni integradas.

El rol administrativo canónico es `ADMIN`; el registro ciudadano conserva `USUARIO` y no permite elegir privilegios. Las rutas administrativas consultan la sesión persistida y exigen administrador activo. Una comprobación visual de Flutter nunca sustituye estos permisos. Cada lectura vuelve a comprobar el actor dentro de la transacción SQL. Las respuestas administrativas usan `Cache-Control: no-store`.

| Método/ruta | Entrada | Respuesta |
| --- | --- | --- |
| GET /api/admin/users | `q` opcional, coincidencia parcial literal por nombre completo o correo, sin distinguir mayúsculas; máximo 160 caracteres. `status` opcional: ACTIVO o SUSPENDIDO. `page` entero 1..10000, por defecto 1; `limit` entero 1..50, por defecto 20. | 200 `{data:usuarioAdmin[],pagination:{page,limit,hasNext}}`; sin resultados `data:[]`. Filtros AND, orden ID ascendente. |
| GET /api/admin/users/:id | ID entero PostgreSQL positivo, sin query. | 200 `{data:usuarioAdmin}`; 404 USER_NOT_FOUND. |

`usuarioAdmin` contiene únicamente `id,nombre,apellido,email,rol,status,denouncedReportCount`. El conteo representa reportes distintos del usuario que recibieron al menos una denuncia, independientemente de cuántas denuncias tenga cada reporte. Nunca incluye hashes, versiones de sesión, claves ni tokens. Los nombres/estados/roles históricos ausentes se conservan como null; no se inventa que una cuenta está activa. No hay edición de roles ni de otras cuentas en este incremento.

401 SESSION_INVALID: sesión ausente, expirada, obsoleta o cuenta inactiva. 403 ADMIN_REQUIRED: cuenta autenticada sin privilegio administrativo vigente. 400 ADMIN_QUERY_INVALID / ADMIN_USER_ID_INVALID: formato, rango, parámetros repetidos o desconocidos. 503 SERVICE_UNAVAILABLE: error interno con mensaje público. Los caracteres %, _ y barra invertida se buscan como texto, mediante parámetros SQL.

Flutter aplica la búsqueda con Buscar/Enter, descarta resultados de solicitudes antiguas y limpia la selección previa al cambiar criterios. Cuenta con páginas separadas de lista/detalle, carga, vacío, error/reintento y paginación. Cambiar sesión o cerrar la página descarta respuestas pendientes. Solo se muestra el acceso administrativo a sesiones con rol ADMIN; la API vuelve a verificarlo.

Decisiones aprobadas para los siguientes incrementos: suspensión hasta reactivación manual; motivo obligatorio al suspender y observación opcional al reactivar; historial persistido con actor, fecha y motivo; total de denuncias antes del desglose agrupado, con categoría sin motivo; identidad de denunciantes fuera de la vista inicial. Mantener/retirar exige una decisión explícita; retirar conservará evidencia y el historial propio marcado, excluirá el reporte de consultas públicas/cálculos, mantendrá el karma otorgado y no suspenderá automáticamente al autor. Estos cambios requieren migraciones aditivas y sus pruebas antes de habilitarse.

## Segundo incremento HU7: cuentas e historial — 28/10/2026

Consulta HU7.2 revisada por Nicolás; se implementan ahora suspensión, reactivación y auditoría. `usuarioAdmin` añade `moderationVersion`, entero no negativo exclusivo del contrato administrativo, independiente de la versión privada de sesión. Se envía como `expectedVersion` al decidir; si otro administrador ya cambió la cuenta, 409 ACCOUNT_STATE_CHANGED exige volver a consultarla. No se aplica una decisión basada en una pantalla antigua.

- POST `/api/admin/users/:id/suspend`: JSON exacto `{reason,expectedVersion}`. Motivo recortado, obligatorio, 1..500 caracteres; solo ciudadano USUARIO actualmente ACTIVO.
- POST `/api/admin/users/:id/reactivate`: JSON `{expectedVersion,note?}`. Observación opcional recortada, máximo 500 caracteres; vacío se guarda como null. Solo ciudadano USUARIO actualmente SUSPENDIDO.
- Ambos: confirmación explícita en Flutter, respuesta 200 `{data:usuarioAdmin}`. Actor activo ADMIN revalidado y filas bloqueadas en orden. Cambio de estado, aumento de revisión, invalidación de sesiones/tokens de recuperación e inserción del historial se confirman en una única transacción. Un fallo revierte todo. No se alteran reportes, votos, denuncias ni karma del ciudadano. No hay suspensión automática ni duración programada. Solo reactivación manual y nuevo ingreso.
- GET `/api/admin/users/:id/history`: página de 20 decisiones, orden id descendente. `before` opcional es ID BIGINT positivo textual; devuelve `{data:accion[],pagination:{nextBefore:string|null}}`. `accion`: `id` textual, `action` SUSPEND/REACTIVATE, `reason` string|null, `previousStatus`, `newStatus`, `createdAt` ISO UTC, `adminId`, `adminName` capturado al decidir y `moderationVersion`. Sin acciones previas devuelve lista vacía: no se inventa historial para cuentas antiguas ya suspendidas.

403 MODERATION_CITIZEN_ONLY para cualquier destino distinto de USUARIO, incluida la propia cuenta del administrador. 400 MODERATION_INPUT_INVALID para campos extra, revisiones inválidas o motivos/observaciones inválidos. 409 ACCOUNT_STATE_CHANGED para revisión/estado obsoletos. Resto de errores y `no-store` igual a la consulta. Un fallo de transporte no autoriza reenvío automático: Flutter pide recargar el estado/historial antes de decidir otra vez.

Requiere migración aditiva explícita `008-user-moderation`: columna de revisión en users y tabla user_moderation_actions. El arranque solo comprueba el esquema; no ejecuta DDL. Las decisiones conservar/retirar reportes siguen pendientes de su siguiente incremento.

## HU7.1 — revisión de reportes denunciados, 28/10/2026

Tercer incremento aprobado tras revisar consulta y gestión de cuentas. Nuevas denuncias sobre un reporte conservado vuelven a ponerlo Pendiente (ratificado por Nicolás). No se añade restauración de reportes retirados: quedan disponibles como evidencia administrativa y en el historial privado del autor.

- GET `/api/admin/reports`: `state` opcional PENDING (predeterminado), KEPT, REMOVED o ALL; `authorId` opcional entero PostgreSQL positivo; `before` opcional ID BIGINT textual. Devuelve hasta 20 `{data:reporteAdmin[],pagination:{nextBefore:string|null}}`, orden ID numérico descendente. Solo reportes con al menos una denuncia, incluidos revisados/retirados si el filtro lo permite.
- `reporteAdmin`: `id` textual, `placeId,placeName,level,createdAt`, `author:{id,name,rol}`, `denunciationCount` total, `reviewedDenunciationCount`, `reviewState` PENDING/KEPT/REMOVED, `isPublic`, `moderationVersion`. Ninguna identidad de denunciante. Un reporte conservado con denuncias posteriores al total revisado tiene estado efectivo PENDING; mantiene la evidencia de la decisión anterior.
- GET `/api/admin/reports/:id`: mismo `data` más `reasons:[{reason:string|null,count:entero}]`. Se agrupa texto idéntico recortado; null/vacío se muestran como Sin motivo. La suma de grupos siempre equivale al total. Incluye `history` (últimas 20 decisiones) e `historyPagination:{nextBefore}`; `beforeHistory` opcional para páginas anteriores. Lectura coherente de total/grupos en el mismo snapshot SQL.
- POST `/api/admin/reports/:id/decision`: JSON exacto `{decision:'KEEP'|'REMOVE',reason,expectedVersion,expectedDenunciationCount}`. Motivo recortado obligatorio 1..500 caracteres y confirmación en Flutter. Solo autor ciudadano USUARIO. Revalida administrador, autor, versión y total bajo locks; 409 REPORT_STATE_CHANGED si la pantalla quedó obsoleta. No se decide sin denuncias ni se repite KEEP sin denuncias nuevas. REMOVE también puede retirar un reporte conservado. Un retirado queda de solo lectura.
- 200 devuelve el detalle actualizado. Decisión, visibilidad, revisión, total considerado y auditoría se confirman juntos. Historial con ID textual, decisión, administrador/nombre capturado, fecha SQL, motivo y denuncias consideradas. 403 MODERATION_CITIZEN_ONLY para autor no ciudadano; resto de permisos/errores y no-store como las rutas HU7 previas. Un fallo de transporte exige actualizar, sin reenvío automático.

Migración aditiva explícita `009-report-moderation`. Retirar conserva reporte, denuncias, validaciones, premios e historial propio; no suspende al autor ni cambia karma/cooldown. Se excluye de lista/detalle públicos, participación nueva, saturación de mapa/detalle y todas las analíticas públicas (historia, comparación y recomendaciones). La ruta privada own-validation sigue autorizada solo al autor, con `removedFromPublic:true`; el historial propio añade `isPublic:false` y Flutter lo marca Retirado de la vista pública. Los gráficos de períodos anteriores pueden cambiar al recalcular sin ese reporte. No se modifica la regla de personas distintas, mínimos, ventanas o ponderación.

## Rutas del Release 01

| Método/ruta | Entrada | Éxito / errores |
| --- | --- | --- |
| GET / | Pública | 200 mensaje de API |
| POST /api/auth/register | nombre,apellido,email,password; telefono/distrito opcionales en API | 201;400 validación/duplicado;503 interno |
| POST /api/auth/login | email,password | 200 token+user;400 formato;401 uniforme;503 interno |
| POST /api/auth/password/change | JWT;currentPassword,newPassword,confirmPassword | 200 sin JWT;400/401/403/503 según reglas inferiores |
| POST /api/auth/password/forgot | email | 202 uniforme con transporte;400/429/503 |
| POST /api/auth/password/reset/validate | token | 200 valid;400/429/503 |
| POST /api/auth/password/reset | token,newPassword,confirmPassword | 200 sin JWT;400/429/503 |
| GET /api/users/profile | JWT | 200 data:usuario;401/404/503 |
| PUT /api/users/profile | JWT;nombre,apellido,telefono,distrito | 200 data:usuario;400/401/404/503 |
| GET /api/users/karma | JWT | 200 data:{karmaPoints:entero};401/404/503 |
| GET /api/users/reports | JWT;siempre usuario de sesión | 200 data:reporte[];401/503 |
| GET /api/places/categories | JWT;sin query | 200 data:string[];400/401/503 |
| GET /api/places | JWT;nombre,categoria,nivel opcionales | 200 data:lugar[];400/401/503;Cache-Control:no-store |
| GET /api/places/:id | JWT;entero PostgreSQL no cero, incluye demos negativas | 200 data:lugar;400/401/404/503 |
| GET /api/places/:id/saturation | JWT;ID válido | 200 snapshot;400/401/404/503;no-store |
| POST /api/places/:placeId/reports | JWT;solo {level} | 201 data:reporte+premio;400/401/404/409/503 |

`lugar`: id,nombre,categoria,referencia,direccion nullable,latitud,longitud,demostrativo. Solo activos, coordenadas finitas y DTO explícito; nunca estado interno ni votos. Dirección ausente no se sustituye por referencia.

Filtros combinables **AND**: nombre parcial ILIKE literal (recortado,160 caracteres); categoria igualdad literal sensible a mayúsculas (80 Unicode); nivel exacto TRANQUILO/MODERADO/SATURADO. Vacío desactiva su filtro. Arrays/repetidos/clave desconocida se rechazan. Comodines %,_,barra y apóstrofes son texto parametrizado, no SQL. Catálogo de categorías procede de activos y no admite query. Sin coincidencias:200 [].

Saturación: snapshot con placeId,level nullable,reportCount,minimumReports=3,windowMinutes=30,reason INSUFFICIENT_REPORTS/TIE/null,evaluatedAt,updatedAt. Último reporte por persona en ventana inclusiva; empate de máximos o menos de3 personas no produce nivel. Política provisional aprobada por Rael; no es aforo ni monitoreo en tiempo real.

Reporte: nivel TRANQUILO/MODERADO/SATURADO. Errores INVALID_PLACE/INVALID_REPORT_LEVEL (400),PLACE_NOT_FOUND(404),REPORT_COOLDOWN(409),SESSION_INVALID(401),SERVICE_UNAVAILABLE(503). Un reporte por usuario/lugar cada3 minutos según reloj SQL. Se revalida usuario/versión bajo lock. Reporte, ledger único por reporte y +10 karma se confirman en la misma transacción; fallo revierte los tres. Duplicado/rechazo no premia. Recompensa real:pointsAwarded,karmaPoints enteros. Flutter no inventa10 si faltan esos campos.

Historial propio: id como texto BIGINT,createdAt,level,placeId,placeName; parámetros de otro usuario no cambian la identidad JWT. Sin reportes:200 []. El estado de validación HU5.3 se consulta por las rutas nuevas de reportes. Perfil excluye hashes/versiones; karma se devuelve como entero seguro (0..9007199254740991), nunca como BIGINT textual ni número truncado.

## Rutas Sprint 3 — HU5 y HU6

Solo usuarios activos autenticados, Cache-Control:no-store, JSON UTF-8. Ninguna ruta acepta actor/peso/karma enviados por el cliente. Rutas de reportes no admiten query; las analíticas solo los parámetros indicados.

| Método/ruta | Entrada y respuesta |
| --- | --- |
| GET /api/reports | data: últimos 50 reportes de lugares activos, orden createdAt/id descendente |
| GET /api/reports/:id | data: reporte + conteos/estado/confiabilidad; no correo ni autor identificable |
| GET /api/reports/:id/own-validation | Mismo DTO, pero solo autor; ajeno 403 REPORT_FORBIDDEN |
| POST /api/reports/:id/validations | Solo {decision:CONFIRM o REJECT}; 201 data:{decision}; elección definitiva |
| POST /api/reports/:id/denunciations | Solo {reason?:texto hasta 500 caracteres}; 201 data:{report_id:texto}; no ocultar/eliminar |
| GET /api/places/:id/history?from=AAAA-MM-DD&to=AAAA-MM-DD | data:{placeId,placeName,period,blocks,counts,sufficient,insufficient,hasReports} |
| GET /api/places/:id/comparison?from=...&to=...&compareFrom=...&compareTo=... | data:{placeId,timezone,first,second,comparable} |
| GET /api/places/:id/quiet-hours?from=...&to=... | data:{placeId,period,minimumDays:3,reason,recommendations} |

Reporte: id es string decimal positivo hasta 9223372036854775807 (no convertir a Number); placeId entero, placeName, level, createdAt UTC, isOwn, ownDecision nullable, alreadyDenounced, confirmations/rejections enteros, reliability. Sin validaciones: ambos conteos cero, no confiabilidad ficticia.

Reliability: {level:ALTO/MEDIO/BAJO/null,reason:INSUFFICIENT_VALIDATIONS/null,minimumValidators:3,confirmWeight,totalWeight}. Política provisional aprobada: mínimo 3 personas; cada peso = 1 + min(floor(karma/10),4), congelado al votar; apoyo >=2/3 ALTO, <=1/3 BAJO, intermedio MEDIO. No probabilidad certificada. Un voto y una denuncia por persona/reporte, protegidos por PK y transacción; autor recibe 403 SELF_PARTICIPATION. No premios por validar/denunciar. 409 ALREADY_VALIDATED/ALREADY_DENOUNCED; no sobrescribir primera participación.

Historial: fechas reales e inclusivas en America/Lima, de 1 a 31 días por período, final SQL exclusivo. Cada bloque incluye start/end UTC, level nullable, reportCount y reason. Último reporte/persona dentro de esa hora; mínimo 3 y empate de máximos insuficiente. Los bloques sin datos siguen visibles en el resumen; no equivalen a TRANQUILO. Máximo 10000 observaciones distintas por consulta; 422 PERIOD_TOO_DENSE pide acortar período, no devuelve análisis truncado.

Comparación conserva ambas series/conteos; comparable solo si cada período tiene al menos un bloque suficiente. No normaliza períodos de distinta duración ni promedia categorías. Recomendación exige 3 días suficientes por hora de Lima y al menos un bloque tranquilo; ordena proporción quietDays/days, conserva empates (rank), excluye horas con cero bloques tranquilos. Vacío reason INSUFFICIENT_HISTORY o NO_QUIET_HOURS, nunca una recomendación inventada.

Entradas inválidas: 400 REPORT_ID_INVALID/REPORT_INPUT_INVALID/DECISION_INVALID/REASON_INVALID/PERIOD_INVALID/QUERY_INVALID; recurso ausente/inactivo 404; JWT/estado/versión/expiración inválida 401; falla interna 503 público. Cuerpo global máximo 32 KB (413 BODY_TOO_LARGE); JSON malformado 400 INVALID_JSON. Se revalida la sesión bajo lock antes de escribir. No moderación HU7 ni aceptación humana implícita.

## Validación y errores: distinguir API de interfaz

Registro API exige nombre/apellido de al menos 2 caracteres y correo con formato válido. Schema exige contraseña de al menos 8 caracteres; el servicio además rechaza espacios solos y más de 72 bytes UTF-8 antes de bcrypt. No acepta propiedades extra.

El formulario Flutter es más estricto: teléfono obligatorio de exactamente 9 dígitos y distrito mínimo 2 caracteres. El backend actual permite estos dos campos opcionales como texto. Es una diferencia comprobada, no una garantía de validación equivalente. Alinear reglas debe ser un cambio explícito con pruebas, no una corrección silenciosa del contrato.

Errores usan `{message}` y las rutas auth afectadas añaden `code`; schema histórico añade `errors` de Ajv. Registro/login/cambio y verificación de sesión ocultan fallos internos con 503 `SERVICE_UNAVAILABLE`. Registro conserva su 400 de correo repetido y login 401 de credenciales. Perfil y karma devuelven 404 solo para ausencia comprobada y 503 público ante fallos internos. El karma del perfil se normaliza desde BIGINT a entero seguro. Los clientes no deben mostrar trazas, SQL o cuerpos arbitrarios al usuario.

### HU 2.3: cambiar contraseña

Los tres campos son obligatorios, texto y sin propiedades extra. Nueva: mínimo 8 caracteres Unicode, no solo espacios y máximo 72 bytes UTF-8 (sin truncar). Actual: no vacía y máximo 72 bytes; confirmación idéntica a nueva. No se normalizan ni recortan contraseñas. Se rechaza que la nueva coincida con la actual.

| HTTP | `code` | Significado |
| --- | --- | --- |
| 400 | `PASSWORD_VALIDATION` | Campos/tamaño inválidos |
| 400 | `PASSWORD_MISMATCH` | Confirmación diferente |
| 400 | `PASSWORD_REUSED` | Nueva coincide con contraseña actual |
| 403 | `CURRENT_PASSWORD_INVALID` | Contraseña actual incorrecta |
| 401 | `SESSION_INVALID` | JWT ausente/inválido/expirado/legacy, usuario inactivo/inexistente o versión antigua |
| 503 | `SERVICE_UNAVAILABLE` | No se pudo verificar sesión o confirmar el cambio; no exponer detalles |

Ante 200, el frontend borra sesión local y dirige a login. Ante 401, hace lo mismo solo si la respuesta corresponde a su generación de sesión vigente. Los errores de campos/contraseña conservan el formulario y no abren sesiones nuevas. Respuestas tardías no afectan a una sesión posterior.

### HU 2.1–2.2: solicitud y restablecimiento

Decisión autorizada del hito C: una solicitud no informa si el correo existe. Sustituye el criterio heredado del Issue backend #3 que distinguía cuentas; el Issue permanece sin editar. Correo se recorta y compara en minúsculas; contraseña se conserva literalmente. Si el esquema histórico contiene más de una cuenta activa con el mismo correo normalizado, la solicitud conserva la respuesta uniforme y no elige una cuenta.

La entrega usa SMTP (Brevo) cuando el servidor tiene `SMTP_*` configurado (ver [configuración](CONFIGURACION_LOCAL.md)); entonces `forgot` responde 202 con el mensaje uniforme. Sin esa configuración, el arranque normal **no envía correo** y `forgot` responde siempre 503 `RECOVERY_UNAVAILABLE` antes de consultar cuentas o generar tokens; configurar `PASSWORD_RESET_URL` por sí solo no habilita envío. Ninguna ruta, cuerpo ni código cambia para el frontend.

| HTTP | `code` | Significado |
| --- | --- | --- |
| 400 | `EMAIL_VALIDATION` | Email/cuerpo de solicitud inválido |
| 400 | `RESET_TOKEN_INVALID` | Token ausente, malformado, desconocido, expirado, consumido o usuario inactivo; mismo mensaje |
| 400 | `PASSWORD_VALIDATION` / `PASSWORD_MISMATCH` / `PASSWORD_REUSED` | Reglas de contraseña idénticas al cambio autenticado |
| 429 | `RATE_LIMITED` | Demasiados intentos; `Retry-After: 900` |
| 503 | `RECOVERY_UNAVAILABLE` | No existe entrega configurada; uniforme para cualquier correo |
| 503 | `SERVICE_UNAVAILABLE` | Error de persistencia/operación, sin detalles internos |

El mensaje común de enlace inválido es `El enlace no es válido o ha expirado. Solicita uno nuevo.` No incluye correo, token ni motivos diferenciados. Flutter valida primero el enlace mediante `/reset/validate`, antes de mostrar los campos; la validación no garantiza que otro cliente no lo consuma o expire después. El endpoint de restablecimiento vuelve a verificarlo y consumirlo atómicamente.

Tokens de 32 bytes criptográficos, representados por 64 caracteres hexadecimales minúsculos; en DB solo SHA-256, con vigencia de 15 minutos y un enlace sin consumir por usuario. Nueva solicitud invalida el enlace previo. Cambio autenticado y restablecimiento invalidan enlaces pendientes dentro de la misma transacción que actualiza hash/versión. Un único reset concurrente gana. Validaciones fallidas y rollback no consumen el enlace.

Límites persistentes PostgreSQL en ventanas de 15 minutos: solicitud 10 por IP y 3 por correo normalizado; validar/restablecer comparten 30 por IP. IP procede del socket; no se confía `X-Forwarded-For`. No bloquean login ni cambian el estado de la cuenta. La respuesta de solicitud tiene un piso común de 200 ms y no espera I/O del proveedor; esto mitiga el atajo de cuentas inexistentes, sin prometer tiempos idénticos bajo carga extrema.

La base del enlace proviene exclusivamente de `PASSWORD_RESET_URL`, nunca de `Host`/`Origin`. En Flutter Web local: `http://localhost:5500/#/reset-password`; el token se añade a la query **dentro del fragmento GoRouter**. HTTPS fuera de desarrollo/pruebas loopback. La URL no admite credenciales, query prefijada ni una ruta distinta. Las respuestas usan `Cache-Control: no-store` y `Referrer-Policy: no-referrer`; Web también define política de referencia. No capturar URLs con tokens en evidencias o logs.

Tras reset exitoso se incrementa `sessionVersion`, se exige login y se programa un aviso de cambio a través de la misma interfaz de entrega, sin contraseña/token. La notificación ocurre después del commit y usa el mismo adaptador SMTP que el enlace. Criterios basados en [OWASP Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

CORS local admite por defecto `http://localhost:5500`, `http://127.0.0.1:5500` y `http://[::1]:5500`, configurable mediante `CORS_ORIGINS`. No utiliza cookies; JWT sigue siendo obligatorio. CORS no reemplaza autenticación/autorización.

## Sesión e integración

JWT dura dos horas, HS256, con `id` y `sessionVersion` enteros. Cada ruta protegida consulta la versión persistida y el estado ACTIVO; no acepta JWT legacy sin versión. HU 2.3 incrementa la versión en la misma transacción que cambia el hash, invalidando todas las sesiones anteriores incluso tras reiniciar backend. Exige login nuevo, no emite reemplazo automáticamente. Las peticiones ya en curso no se cancelan retroactivamente. Flutter conserva token en memoria; recargar pierde la sesión. HU 2.4 sigue siendo cierre local y por sí solo no revoca un JWT.



## Cambios y límites

Contrato local conciliado, no autorización de publicación ni aceptación humana. SMTP es Adapter de Diego, no reimplementado. Recepción real histórica identificada en ESTADO_ACTUAL; sin SMTP privado la recuperación responde503. No se han habilitado nube, moderación ni favoritos.
