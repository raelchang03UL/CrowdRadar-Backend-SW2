# Evidencias reales del Sprint 2

Fechas de verificación: 10/10/2026 y reverificación del 16/10/2026. Estado: **en curso** — todo integrado en `develop` y verificado en Web; quedan Android, la aceptación formal del criterio de HU 2.1 y el cierre de Issues (ver «Pendientes»). Este registro se completa al cerrar el Sprint; no reescribe las evidencias del Sprint 1.

## Numeración de sprints

Este registro usa la **numeración histórica** del informe del grupo y de la pestaña `Sprint2` de la hoja de historias, que los Issues conservan como «Sprint de origen documental: Sprint 2». En el **plan vigente** del Project (campo Sprint, consultado el 10/10/2026) la correspondencia es:

| Historias | Numeración histórica (este registro) | Plan vigente (Project) |
| --- | --- | --- |
| HU 1.x | Sprint 1 | Sprint 1 |
| HU 2.x | Sprint 2 | **Sprint 1** |
| HU 3.x–4.x | Sprint 3 y siguientes | **Sprint 2** |

Por tanto, las HU 2.1–2.4 aquí registradas completan el Sprint 1 vigente, y HU 3.1, integrada como base de esta cadena, pertenece al Sprint 2 vigente. El nombre de este archivo y las rutas `evidencias/sprint2/` se conservan sin renombrar para no sobrescribir evidencias ya publicadas.

Responsable del Sprint 2 (numeración histórica): Diego Rodriguez. Código de HU 3.1, pulido A, HU 2.3 (B) y núcleo de HU 2.1–2.2 (C): Rael Chang. Envío de correo, arreglo del mapa y corrección del error persistente: Diego Rodriguez con apoyo de Claude Code.

## Alcance

| HU | Historia | Issue |
| --- | --- | --- |
| 2.1 | Iniciar proceso de recuperación de contraseña | Backend #3 |
| 2.2 | Restablecer contraseña | Backend #4 |
| 2.3 | Cambiar contraseña | Backend #5 |
| 2.4 | Cerrar sesión | Frontend #3 (integrada antes, PR #8) |

La cadena dependía de HU 3.1 (mapa de lugares), que se integró primero.

## Integración en `develop`

Orden acordado: un PR por entrega, con merge commit y sin borrar ramas.

| Paso | Backend | Frontend | Estado |
| --- | --- | --- | --- |
| HU 3.1 | #26 | #9 | Integrado |
| Pulido visual A | — | #11 | Integrado |
| HU 2.3 (B) | #29 | #12 | Integrado |
| HU 2.1–2.2 (C) | #30 | #13 | Integrado |
| Correo SMTP (Brevo) | #31 | — | Integrado el 10/10/2026, con las correcciones pedidas por Rael (`MAIL_FROM` obligatorio con Brevo, guías actualizadas) |
| Referer del mapa Web | — | #14 | Integrado el 10/10/2026 |
| Error persistente al cambiar contraseña | — | #15 | Integrado el 11/10/2026 |
| Evidencias de entrega (este registro) | #32 | — | Integrado el 11/10/2026 |

`develop` tras los merges de HU 2.1–2.3: backend `7f32e62`, frontend `cffd3d5`. Par probado el 10/10: backend `5fd8d4b` (`feature/hu-2-1-correo-smtp`) / frontend `a1808d2` (`fix/web-referrer-mapa`). `develop` tras #31, #14, #15 y #32: backend `46267e7`, frontend `dfdb753`; es el par de la reverificación del 16/10.

## Entorno

| Componente | Versión |
| --- | --- |
| Sistema | Windows 11 Pro (build 26200) |
| Node.js / npm | 24.19.0 / 11.17.0 (la guía indica Node 22; las pruebas pasan igual) |
| PostgreSQL | 18, bases aisladas `crowdradar_auth_test` y `crowdradar_hu31_test`; desarrollo `crowdradar_dev` |
| Flutter / Dart | 3.41.9 / 3.11.5 (commit `00b0c91`, igual que `.metadata`) |
| Navegador | Google Chrome, Flutter Web en `http://localhost:5500/#/` |
| Correo | Brevo (plan gratuito) por SMTP, host `smtp-relay.sendinblue.com:587` |

El `.env` con credenciales locales y la clave SMTP no se publica; la configuración se documenta en `.env.example` y `docs/CONFIGURACION_LOCAL.md`.

## Pruebas automáticas

| Comprobación | Resultado | Salida |
| --- | --- | --- |
| Backend `npm test` (`5fd8d4b`) | 58/58 aprobadas | `evidencias/sprint2/backend-tests-sprint2.txt` |
| `npm run test:db:auth` | 4/4 PASS (PostgreSQL real aislado) | `evidencias/sprint2/backend-postgresql-sprint2.txt` |
| `npm run test:db:recovery` | 6/6 PASS | ídem |
| `npm run test:db:places` | 4/4 PASS | ídem |
| Frontend `flutter analyze --no-pub` (`a1808d2`) | Sin problemas | `evidencias/sprint2/frontend-tests-sprint2.txt` |
| Frontend `flutter test --no-pub` | 226 aprobadas, 2 opt-in omitidas | ídem |

Antes de cada merge se probó el commit exacto: HU 3.1 backend 24/24 + places 4/4, frontend 69/69; A 110/110; B backend 36/36 + auth 4/4, frontend 147 (+1 opt-in omitida).

## Recorrido manual en Chrome (10/10/2026)

### HU 2.1 — Iniciar recuperación

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| Desde login, «Recuperar contraseña» pide el correo | Cumple | `01_login.png` |
| Correo registrado: envía instrucciones con la URL y muestra mensaje de envío | Cumple con correo real: llegó «CrowdRadar: restablece tu contraseña» con el enlace | `11_correo_recuperacion_recibido.png` |
| Correo no registrado: mensaje de cuenta inexistente | **Sustituido por la respuesta uniforme**: el mensaje es el mismo para cualquier correo y no revela si la cuenta existe (recomendación OWASP). Ver «Criterio de respuesta uniforme» | `docs/CONTRATO_API.md`, `docs/PLAN_TECNICO_SW2.md` |

Correo con formato inválido: error de validación antes de enviar.

**Criterio de respuesta uniforme.** Hay que distinguir dos cosas:
- **Autorización técnica, registrada:** `docs/CONTRATO_API.md` («Decisión autorizada del hito C») y `docs/PLAN_TECNICO_SW2.md` («Criterio uniforme autorizado para sustituir el contradictorio del Issue backend #3») recogen la decisión de responder igual a correos existentes e inexistentes. Es la base sobre la que se implementó y revisó la cadena.
- **Aceptación formal del criterio de la HU, no registrada:** el texto del Issue #3 no se editó y no consta en él ni en el Project que el Product Owner o el equipo aceptaran el criterio modificado. Este registro no afirma esa aceptación; queda pendiente.

### HU 2.2 — Restablecer contraseña

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| Enlace válido y vigente abre el formulario de nueva contraseña | Cumple (enlace del correo real) | Recorrido; no se captura la URL porque contiene el token |
| Confirmar guarda, muestra éxito y permite entrar con la nueva | Cumple: aviso «Contraseña restablecida. Inicia sesión nuevamente.» y login correcto; llegó el aviso «tu contraseña fue cambiada» | `12_reset_exito_aviso.png` |
| Enlace expirado o inválido impide el formulario y muestra error | Cumple: enlace inventado y enlace ya usado muestran «El enlace no es válido o ha expirado» sin formulario | `10_enlace_invalido.png`, `13_enlace_reutilizado.png` |

### HU 2.3 — Cambiar contraseña

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| Perfil → «Cambiar contraseña» muestra actual y nueva | Cumple (actual, nueva y confirmación) | `03_cambio_formulario.png` |
| Actual correcta + nueva válida actualiza la contraseña | Cumple: vuelve a login; la nueva entra y la anterior se rechaza | Recorrido |
| Actual incorrecta muestra error y rechaza | Cumple | `04_cambio_actual_incorrecta.png` |
| Nueva inválida indica los requisitos incumplidos | Cumple: menos de 8 caracteres, confirmación distinta, igual a la actual | `05_cambio_validaciones.png`, `06_cambio_reutilizada.png` |

Además, el cambio invalida las sesiones abiertas: una segunda pestaña con la sesión anterior ya no accede al perfil (`07_dos_pestanas_sesion_invalidada.png`).

### HU 2.4 — Cerrar sesión

| Criterio | Resultado | Evidencia |
| --- | --- | --- |
| «Cerrar sesión» finaliza la sesión | Cumple | Recorrido |
| Sin sesión, las funciones protegidas piden login | Cumple: `/#/profile` y `/#/map` redirigen a login | `08_guarda_profile_sin_sesion.png`, `09_guarda_map_sin_sesion.png` |
| Tras cerrar, redirige a login | Cumple | Recorrido |

## Reverificación en clon nuevo (16/10/2026)

Clon nuevo de ambos repositorios en otra PC, en `develop` sin cambios locales: backend `46267e7`, frontend `dfdb753`.

| Componente | Versión |
| --- | --- |
| Sistema | Windows 11 Home (build 26200) |
| Node.js | 22.23.2 |
| PostgreSQL | 18, base de desarrollo `crowdradar_dev` (migraciones aplicadas, 3 lugares demo) |
| Flutter | 3.41.9 (commit `00b0c91`) |
| Navegador | Google Chrome, Flutter Web en `http://localhost:5500/#/` |
| Correo | Brevo por SMTP, `smtp-relay.sendinblue.com:587`, remitente verificado propio |

| Comprobación | Resultado |
| --- | --- |
| Backend `npm test` | 59/59 aprobadas |
| Frontend `flutter test --no-pub` | 226 aprobadas, 2 opt-in omitidas |
| Arranque del backend con SMTP | «Recuperación de contraseña: envío por correo habilitado.» |
| `POST /api/auth/password/forgot` | 202 con la respuesta uniforme |

Recorrido manual de HU 2.1–2.2 con correo real (capturas en `evidencias/sprint2/capturas/reverificacion_2026_10_16/`):

| Paso | Resultado | Evidencia |
| --- | --- | --- |
| Solicitud de recuperación desde Web | Llegó «CrowdRadar: restablece tu contraseña» con el enlace (vigencia 15 min, un solo uso) | `01_correo_recuperacion.png` |
| Enlace del correo abre el formulario y guarda la nueva contraseña | Cumple; luego se inició sesión con la nueva | `02_formulario_restablecer.png` (contraseña de una cuenta de prueba) |
| Aviso de cambio | Llegó «CrowdRadar: tu contraseña fue cambiada» indicando el cierre de sesiones | `03_aviso_contrasena_cambiada.png` |
| Reabrir el enlace ya usado | «El enlace no es válido o ha expirado. Solicita uno nuevo.» sin formulario | `04_enlace_reutilizado.png` (token oculto en la URL) |

HU 2.3 y HU 2.4 no se volvieron a capturar en esta reverificación; rigen las evidencias del 10/10.

## Hallazgos y correcciones

1. **Mapa Web bloqueado.** La meta `no-referrer` añadida con la recuperación hacía que OpenStreetMap sirviera «Access blocked» en todas las teselas (`02_mapa_bloqueado_antes.png`). Comprobado descargando las mismas teselas con y sin Referer. Corregido con `strict-origin-when-cross-origin` (PR #14); el token de recuperación va tras `#` y nunca viaja en el Referer (`14_mapa_despues.jpg`).
2. **`PASSWORD_RESET_URL` recortada.** Sin comillas, dotenv trataba `#/reset-password` como comentario; con correo habilitado el arranque se detenía. Corregido en `.env.example` con una prueba que lo vigila (PR #31).
3. **Certificado de Brevo.** Desde Perú, `smtp-relay.brevo.com` presentó un certificado solo válido para `*.sendinblue.com` y la conexión se rechazó (`ESOCKET`). Se usa `smtp-relay.sendinblue.com` (misma IP), con verificación TLS completa.
4. **Error persistente al cambiar contraseña.** «La contraseña actual no es correcta.» seguía visible al corregir los campos (`05`, `06`). Corregido en frontend #15 (`fix/hu-2-3-error-cambio-password`), aprobado por Rael e integrado el 11/10/2026.
5. **Pestaña con sesión invalidada.** Muestra «Tu sesión no está disponible» con «Reintentar» en lugar de volver a login (`07`). La seguridad se cumple (el backend rechaza el JWT anterior); falta el manejo global del 401, que toca `SessionService` y el router y requiere acuerdo del equipo.

## Decisiones

- **Proveedor de correo:** se eligió Gmail, pero la cuenta del proyecto no permitió contraseñas de aplicación; se usa Brevo por SMTP sin cambiar código (adaptador SMTP genérico). Cada integrante configura su propia clave en `.env`.
- **Integración por orden** (un PR por entrega) en lugar del PR consolidado #27/#10.
- **Mensaje uniforme** en la solicitud de recuperación, en lugar de informar que la cuenta no existe: autorizado técnicamente en el hito C; aceptación formal del criterio de HU 2.1 pendiente (ver HU 2.1).

## Pendientes

- Aceptación formal del criterio uniforme de HU 2.1 por el Product Owner o el equipo.
- Android: no se probó en esta PC (sin SDK). Queda como pendiente explícito; el enlace del correo abre la versión Web, no la app nativa.
- Manejo global del 401 (hallazgo 5).
- Integración opt-in `test/local_recovery_api_test.dart`: presupone el clon hermano `../CrowdRadar-Backend/`; en esta PC los clones se llaman `CR-BackEnd`/`CR-FrontEnd` y no se ejecutó.
- `npm audit`: 10 avisos preexistentes (1 crítico en `proxy-addr`, dependencia de Express); ninguno de `nodemailer`. Sin corrección en este Sprint.
- Cerrar los Issues #3, #4 y #5 (backend) y #3 (frontend) cuando todo esté integrado.

## Limitaciones honestas

- No existe CI: los resultados son de ejecuciones locales.
- La entrega de correo no reintenta (cola en memoria); Brevo reescribe el remitente a su dominio `brevosend.com`.
- Las capturas excluyen contraseñas, enlaces con token, el `.env`, el teléfono y el correo personal del responsable.
