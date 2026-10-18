# Contrato API compartido

Corte local 17/10/2026: rama `feature/local-r01-consolidacion-20261017`, NO publicada. Origin/develop ya integra autenticación, recuperación SMTP y mapa; esta rama reúne los aportes de Nick/Manu y sus correcciones. Pruebas/limitaciones en ESTADO_ACTUAL. Una clonación de GitHub todavía no contiene el incremento local.

JSON UTF-8; JWT Bearer en rutas protegidas. Ejecución QA: http://localhost:3033; configuración habitual por entorno. El cliente nunca conecta directamente a PostgreSQL.

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

Historial propio: id,createdAt,level,placeId,placeName; parámetros de otro usuario no cambian la identidad JWT. Sin reportes:200 []. No equivale todavía a estado de validación HU5.3. Perfil excluye hashes/versiones; karma se devuelve como entero seguro (0..9007199254740991), nunca como BIGINT textual ni número truncado.

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
