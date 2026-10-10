# Contrato API compartido

Fuente canónica backend para coordinar con Flutter. Refleja el incremento HU 3.1/Web revisado el 07/10/2026 en las ramas `feature/hu-3-1-mapa-lugares`, desde backend `a6da9a7` y frontend `f214886`. No es un catálogo de endpoints futuros ni una afirmación de integración en `develop`. Al publicar un cambio de contrato, registrar ambos SHA y pruebas en los PR relacionados.

Base local: `http://localhost:3000`; Android emulado usa `http://10.0.2.2:3000`. JSON UTF-8. Rutas protegidas reciben `Authorization: Bearer <token>`. No incluir token real en este archivo ni evidencias.

## Rutas actuales

| Método/ruta | Entrada | Éxito | Fallos actuales |
| --- | --- | --- | --- |
| GET `/` | Sin autenticación | 200 `{message: "CrowdRadar API"}` | — |
| POST `/api/auth/register` | `nombre`, `apellido`, `email`, `password`; `telefono`/`distrito` opcionales en API | 201 `{message, data: {id,nombre,apellido,email}}` | 400 validación/correo repetido/error del servicio |
| POST `/api/auth/login` | `email`, `password` | 200 `{message, data: {token,user: {id,nombre,apellido,email,rol}}}` | 400 schema; 401 credenciales/error del servicio |
| POST `/api/auth/password/change` | JWT; `currentPassword`, `newPassword`, `confirmPassword` | 200 `{message: "Contraseña actualizada. Inicia sesión nuevamente."}` sin JWT | 400 validación/confirmación/reutilización; 403 actual incorrecta; 401 sesión; 503 indisponibilidad |
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

CORS local admite por defecto `http://localhost:5500`, `http://127.0.0.1:5500` y `http://[::1]:5500`, configurable mediante `CORS_ORIGINS`. No utiliza cookies; JWT sigue siendo obligatorio. CORS no reemplaza autenticación/autorización.

## Sesión e integración

JWT dura dos horas, HS256, con `id` y `sessionVersion` enteros. Cada ruta protegida consulta la versión persistida y el estado ACTIVO; no acepta JWT legacy sin versión. HU 2.3 incrementa la versión en la misma transacción que cambia el hash, invalidando todas las sesiones anteriores incluso tras reiniciar backend. Exige login nuevo, no emite reemplazo automáticamente. Las peticiones ya en curso no se cancelan retroactivamente. Flutter conserva token en memoria; recargar pierde la sesión. HU 2.4 sigue siendo cierre local y por sí solo no revoca un JWT.

## Cambiar este contrato

Antes de implementar una nueva HU, acordar ruta/método, entrada/validación, salida, códigos de error, autenticación y casos negativos con la persona del otro componente. Enlazar los PR. Preferir cambios aditivos compatibles; si se rompe un campo/ruta, definir transición y orden de integración. Registrar el par probado, no solo el SHA del repo actual.

Solo existe `/api/auth/password/change`; solicitud/restablecimiento siguen pendientes. Tampoco hay `/api/places/:id`, búsqueda, filtros, reportes ni saturación. Escribir una propuesta no hace disponible una API; registrarla como propuesta en PLAN_TECNICO hasta implementarla y comprobarla.
