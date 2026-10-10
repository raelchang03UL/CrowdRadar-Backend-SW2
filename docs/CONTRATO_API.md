# Contrato API compartido

Fuente canónica backend para coordinar con Flutter. Refleja HU 3.1 y los incrementos A/B/C de revisión al08/10/2026, todavía sin integrar en `develop`. El par C usa `feature/hu-2-1-2-recuperacion` en ambos repositorios desde los padres B backend `97e607e`/frontend `1e62c75`; pruebas en ESTADO_ACTUAL. No es un catálogo de endpoints futuros. Al publicar un cambio de contrato, registrar ambos SHA y pruebas en los PR relacionados cuando sus bases permitan abrirlos.

Base local: `http://localhost:3000`; Android emulado usa `http://10.0.2.2:3000`. JSON UTF-8. Rutas protegidas reciben `Authorization: Bearer <token>`. No incluir token real en este archivo ni evidencias.

## Rutas actuales

| Método/ruta | Entrada | Éxito | Fallos actuales |
| --- | --- | --- | --- |
| GET `/` | Sin autenticación | 200 `{message: "CrowdRadar API"}` | — |
| POST `/api/auth/register` | `nombre`, `apellido`, `email`, `password`; `telefono`/`distrito` opcionales en API | 201 `{message, data: {id,nombre,apellido,email}}` | 400 validación/correo repetido/error del servicio |
| POST `/api/auth/login` | `email`, `password` | 200 `{message, data: {token,user: {id,nombre,apellido,email,rol}}}` | 400 schema; 401 credenciales/error del servicio |
| POST `/api/auth/password/change` | JWT; `currentPassword`, `newPassword`, `confirmPassword` | 200 `{message: "Contraseña actualizada. Inicia sesión nuevamente."}` sin JWT | 400 validación/confirmación/reutilización; 403 actual incorrecta; 401 sesión; 503 indisponibilidad |
| POST `/api/auth/password/forgot` | Público; `{email}` | 202 `{message: "Si el correo corresponde a una cuenta, recibirás un enlace para restablecer tu contraseña."}` con transporte configurado | 400 formato; 429 abuso; 503 recuperación deshabilitada/servicio |
| POST `/api/auth/password/reset/validate` | Público; `{token}` | 200 `{valid: true}`; no consume ni envía correo | 400 enlace inválido/expirado/usado; 429 abuso; 503 servicio |
| POST `/api/auth/password/reset` | Público; `{token,newPassword,confirmPassword}` | 200 `{message: "Contraseña restablecida. Inicia sesión nuevamente."}` sin JWT | 400 enlace/contraseña/confirmación/reutilización; 429 abuso; 503 servicio |
| GET `/api/users/profile` | JWT | 200 `{data: usuario}` | 401 token; 404 usuario/error del servicio |
| PUT `/api/users/profile` | JWT; subconjunto de `nombre`, `apellido`, `telefono`, `distrito` | 200 `{message,data: usuario}` | 401 token; 400 validación/usuario/error del servicio |
| GET `/api/places` | JWT | 200 `{data: lugar[]}`; vacío `[]` | 401 token; 503 mensaje público de carga |

`usuario` es la representación actual de Sequelize de `users` sin `passwordHash` ni `sessionVersion`: id/nombre/apellido/email/telefono/distrito/rol/status y timestamps. No prometer estos campos internos como contrato nuevo para otros modelos. Flutter consume solo los datos necesarios de `UserModel`.

`lugar` contiene `id` entero, `nombre` texto, `categoria` texto, `referencia` texto o null, `latitud` número finito entre -90/90, `longitud` número finito entre -180/180 y `demostrativo` booleano. Los fixtures reservan IDs negativos, por tanto no suponer `id > 0`. Solo se devuelven activos en orden ascendente de ID. No hay dirección, saturación ni endpoint de detalle todavía.

## Validación y errores: distinguir API de interfaz

Registro API exige nombre/apellido de al menos 2 caracteres y correo con formato válido. Schema exige contraseña de al menos 8 caracteres; el servicio además rechaza espacios solos y más de 72 bytes UTF-8 antes de bcrypt. No acepta propiedades extra.

El formulario Flutter es más estricto: teléfono obligatorio de exactamente 9 dígitos y distrito mínimo 2 caracteres. El backend actual permite estos dos campos opcionales como texto. Es una diferencia comprobada, no una garantía de validación equivalente. Alinear reglas debe ser un cambio explícito con pruebas, no una corrección silenciosa del contrato.

Errores usan `{message}` y las rutas auth afectadas añaden `code`; schema histórico añade `errors` de Ajv. Registro/login/cambio y verificación de sesión ocultan fallos internos con 503 `SERVICE_UNAVAILABLE`. Registro conserva su 400 de correo repetido y login 401 de credenciales. `UserController` histórico todavía requiere normalización de errores. Los clientes no deben mostrar trazas, SQL o cuerpos arbitrarios al usuario.

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

## Cambiar este contrato

Antes de implementar una nueva HU, acordar ruta/método, entrada/validación, salida, códigos de error, autenticación y casos negativos con la persona del otro componente. Enlazar los PR. Preferir cambios aditivos compatibles; si se rompe un campo/ruta, definir transición y orden de integración. Registrar el par probado, no solo el SHA del repo actual.

Las rutas de recuperación están implementadas y probadas con correo en memoria exclusivo de pruebas; la entrega real por SMTP se habilita por configuración y su recepción se registra en ESTADO_ACTUAL. No hay `/api/places/:id`, búsqueda, filtros, reportes ni saturación. Escribir una propuesta no hace disponible una API; registrarla como propuesta en PLAN_TECNICO hasta implementarla y comprobarla.
