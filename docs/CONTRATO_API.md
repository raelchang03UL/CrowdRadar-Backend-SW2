# Contrato API compartido

## HU8 — favoritos y alertas Web, 30/10/2026

JWT Bearer en favoritos/dispositivos; respuestas no-store. Se conservan rutas previas y filtros HU3. Identificadores de lugar admiten los enteros PostgreSQL no cero, incluidos los negativos de demostración.

| Método/ruta | Contrato |
| --- | --- |
| GET /api/places/favorites |200 {data:Place[]}; solo lugares activos favoritos del usuario autenticado, fecha de marcado descendente. Place conserva dirección y campos públicos, con esFavorito:true. |
| POST /api/places/:id/favorite |201 {message,data:{placeId,esFavorito:true}};409 FAVORITE_ALREADY_EXISTS ante duplicado,404 PLACE_NOT_FOUND si no disponible,400 INVALID_PLACE_ID,401 de sesión o503 público. PK protege simultaneidad. |
| DELETE /api/places/:id/favorite |204 idempotente; solo asociación del usuario autenticado; purga alertas pendientes del lugar para esa cuenta.400/401/503 públicos. |
| GET /api/places y GET /api/places/:id | DTO existente +esFavorito:boolean calculado con la cuenta autenticada; lista conserva nombre/categoria/nivel y detalle conserva direccion. |
| POST /api/notifications/devices | JSON exacto {token,platform}; token es FID de Firebase SDK vigente (20..4096 sin espacios), platform web/android/ios.200 {message,data:{registrationId}}; UUID nuevo en cada registro, asociado a usuario/versión/expiración JWT.400 DEVICE_TOKEN_INVALID,401 vigente o503. |
| DELETE /api/notifications/devices | JSON {token,registrationId?};204 idempotente filtrado por cuenta/sesión y binding cuando se indica. El cliente nuevo envía registrationId capturado para proteger logouts tardíos. |
| POST /api/internal/places/:id/saturation | Secreto x-saturation-event-secret (mínimo32 configurado), cuerpo vacío/{}; recalcula reportes reales. No acepta level.200 {data:{changed,initialized? ,previousLevel?,newLevel?}},401 sin autorización,503 sin configuración. |
| POST /api/internal/push/process | Mismo secreto/cuerpo vacío; pagina favoritos, recalcula y drena.200 {data:{evaluated,configured,sent}}; configured:false significa ningún envío FCM. No es ruta pública del cliente. |

FCM data incluye strings placeId,userId,sessionVersion,registrationId,previousLevel,newLevel. Web DATA-ONLY sin notification: SW y app deben comprobar binding de sesión actual antes de mostrar/abrir y navegar al detalle autenticado correcto. Tras logout/login, el binding anterior se descarta incluso para la misma cuenta. Tokens/bindings de otra cuenta nunca autorizan consultas. Móvil conserva texto genérico. SIN_DATOS representa ausencia de nivel suficiente para comparar alertas; GET saturation mantiene level:null/reason original. La cola no demuestra recepción real ni apertura del navegador.


JSON UTF-8, JWT Bearer en rutas protegidas; el cliente nunca conecta directamente a PostgreSQL. Esta sección describe HU7 vigente,28/10/2026; las rutas previas se conservan debajo.

## HU7 — usuarios y moderación

ADMIN activo revalidado desde BD y sesión vigente en cada operación; registro público conserva USUARIO. Respuestas administrativas no-store. Sin edición de roles; acciones solo sobre ciudadanos. Migraciones008/009 explícitas antes del arranque, que solo comprueba esquema.

| Método/ruta | Entrada y respuesta |
| --- | --- |
| GET /api/admin/users | q parcial literal de nombre/correo, máximo160 caracteres, sin distinguir mayúsculas; status ACTIVO/SUSPENDIDO opcional; page1..10000, limit1..50 (por defecto1/20). Filtros AND;200 data:usuarioAdmin[] y pagination:{page,limit,hasNext}. |
| GET /api/admin/users/:id | ID entero PostgreSQL positivo;200 data:usuarioAdmin;404 USER_NOT_FOUND. |
| POST /api/admin/users/:id/suspend | JSON exacto reason,expectedVersion. Motivo recortado1..500; ciudadano ACTIVO. |
| POST /api/admin/users/:id/reactivate | JSON expectedVersion,note opcional. Observación hasta500, vacío=null; ciudadano SUSPENDIDO. |
| GET /api/admin/users/:id/history | before BIGINT textual opcional;20 eventos por página, ID descendente; data:accion[],pagination:{nextBefore}. |

usuarioAdmin contiene id,nombre,apellido,email,rol,status,denouncedReportCount,moderationVersion. El conteo es de reportes distintos con denuncias, incluidos revisados/retirados. Campos históricos ausentes permanecen null. Nunca hashes, tokens ni versión privada de sesión. accion contiene id textual,action SUSPEND/REACTIVATE,reason nullable,previousStatus,newStatus,createdAt UTC,adminId,adminName capturado y moderationVersion.

Suspender/reactivar confirma estado, revisión, invalidación de sesiones/recuperación y auditoría en una transacción;200 devuelve data:usuarioAdmin. Motivo obligatorio al suspender; observación opcional al reactivar. Sin duración programada: reactivación manual y nuevo login. No modifica reportes, karma ni rol.409 ACCOUNT_STATE_CHANGED exige actualizar.

| Método/ruta | Entrada y respuesta |
| --- | --- |
| GET /api/admin/reports | state PENDING (predeterminado),KEPT,REMOVED,ALL; authorId opcional; before BIGINT textual opcional. Hasta20 reportes con denuncias, ID descendente; data:reporteAdmin[],pagination:{nextBefore}. |
| GET /api/admin/reports/:id | data:reporteAdmin más reasons:[{reason nullable,count}]; history y historyPagination:{nextBefore}. beforeHistory opcional pagina eventos anteriores de20 en20. |
| POST /api/admin/reports/:id/decision | JSON exacto decision KEEP/REMOVE,reason recortado1..500,expectedVersion,expectedDenunciationCount.200 devuelve detalle actualizado con historial. |

reporteAdmin contiene id textual,placeId,placeName,level,createdAt,author:{id,name,rol},denunciationCount,reviewedDenunciationCount,reviewState,isPublic,moderationVersion. Motivos idénticos recortados se agrupan; null/vacío es Sin motivo y la suma coincide con el total. Sin identidades de denunciantes. Cada evento contiene id textual,decision,reason,adminId,adminName,createdAt,reviewedDenunciationCount,moderationVersion. Total, grupos e historial se leen coherentemente.

KEEP conserva visibilidad; denuncia posterior vuelve a PENDING conservando historial. No se repite KEEP sin denuncias nuevas. REMOVE también puede seguir a KEEP y deja solo lectura; no hay restauración en este alcance. Revisión y total se comparan bajo locks;409 REPORT_STATE_CHANGED exige nueva lectura. Cambio y auditoría son atómicos. Un resultado incierto exige actualizar, sin reenvío automático.

Retirar conserva evidencia, votos, denuncias, premios e historial privado del autor; no suspende ni quita karma/cooldown. Excluye lista/detalle/participación y cálculos públicos actuales e históricos, incluidos mapa, comparación y recomendaciones. own-validation sigue exigiendo autor y devuelve removedFromPublic:true; historial propio incluye isPublic:false. No cambia mínimos, ventanas ni ponderaciones.

Errores administrativos:401 SESSION_INVALID,403 ADMIN_REQUIRED/MODERATION_CITIZEN_ONLY,400 ADMIN_QUERY_INVALID/ADMIN_USER_ID_INVALID/ADMIN_REPORT_ID_INVALID/MODERATION_INPUT_INVALID/REPORT_MODERATION_INPUT_INVALID,404 por recurso ausente y503 SERVICE_UNAVAILABLE sin detalles internos. Parámetros desconocidos/repetidos se rechazan; %, _ y barra invertida se buscan literalmente.

## HU7.3 — aviso al iniciar sesión

POST /api/auth/login devuelve403 ACCOUNT_SUSPENDED y el mensaje público «Tu cuenta está suspendida. Un administrador debe reactivarla para que puedas volver a ingresar.» únicamente si la contraseña es válida y el estado es SUSPENDIDO. No incluye token ni datos de cuenta. Correo inexistente/clave incorrecta devuelve401 INVALID_CREDENTIALS uniforme; otros estados inactivos conservan ese fallo cerrado. Recuperación de contraseña sigue siendo uniforme. Este ajuste autorizado por Nicolás el28/10 satisface el aviso de HU7.3 sin informar estado antes de verificar la clave.

## Antecedentes anteriores a HU7

Los cortes inferiores conservan su fecha y alcance originales. El estado vigente de HU7 es el resumen superior; sus iteraciones previas se conservan en Git.

## Rutas del Release 01

| Método/ruta | Entrada | Éxito / errores |
| --- | --- | --- |
| GET / | Pública | 200 mensaje de API |
| POST /api/auth/register | nombre,apellido,email,password; telefono/distrito opcionales en API | 201;400 validación/duplicado;503 interno |
| POST /api/auth/login | email,password | 200 token+user;400 formato;401 uniforme;403 ACCOUNT_SUSPENDED con clave válida;503 interno |
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
