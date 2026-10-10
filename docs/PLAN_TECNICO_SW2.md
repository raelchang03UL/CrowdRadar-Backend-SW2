# Plan técnico SW2

La línea base Sprint 1 funciona en Android y PostgreSQL local. Este plan separa riesgos de trabajo inmediato: no implica implementar los Sprints 2–8 ni actualizar todas las dependencias.

| Prioridad | Área | Hallazgo y dirección |
| --- | --- | --- |
| Crítico | Reproducibilidad / base de datos | Migraciones explícitas de `places` y `users`/versión de sesión publicadas en ramas de revisión, sin DDL al arrancar. Recuperación añade otra migración aditiva. Revisar/integrar las bases antes de usarlas como línea común; mantener `crowdradar_sprint1` intacta y preparar permisos/backups para despliegue. |
| Alto | Autenticación y seguridad | HU 2.3 invalida sesiones en PostgreSQL; recuperación reutiliza esa política. Falta elegir proveedor/remitente y probar correo real; no cerrar HU 2.1. Mantener HTTPS/secretos fuertes antes de exposición y revisar política de contraseñas/MFA sin cambiarla silenciosamente. Audit histórico: 9 paquetes (5 altos/4 moderados), sin actualización masiva ni nuevo audit en estos incrementos. |
| Alto | Pruebas | C: 51 comprobaciones backend, PostgreSQL auth/recuperación/lugares y 226 Flutter; dos integraciones opt-in aprobadas con widgets+API real. Builds Web/APK correctos. No equivalen a Chrome/Android manual, CI ni entrega de correo; detalle y límites en ESTADO_ACTUAL. |
| Medio | Configuración | DB por variables o URL, TLS verificado opcional y CORS configurable están cubiertos con dobles; solo PostgreSQL local fue ejecutado. Preparar secretos externos y configuración de staging cuando se autorice. |
| Medio | Arquitectura backend | Arranque separado de migraciones; servicios/repositorios controlan transacciones. Revisar errores históricos de perfil y operación de entrega asíncrona antes de producción, sin reestructurar todo el servidor. |
| Medio | Arquitectura frontend | Token solo en memoria, guardas y generaciones preservadas. Pantallas nuevas reutilizan tema/validación; revisar caducidad global y accesibilidad en plataformas reales antes de añadir persistencia. |
| Medio | Experiencia de usuario | Pulido A aplicado a login/registro/perfil/edición/mapa con widgets móviles/escritorio. Repetir Chrome normal/Android y revisar con el equipo; no hay certificación de accesibilidad. |
| Medio | Deuda técnica | Gradle/SDK XML y APIs obsoletas generan advertencias, aunque el APK compila. Revisar versiones de plugin/SDK de forma aislada cuando haya pruebas de regresión, no actualizar en bloque. |
| Mejora futura | Despliegue | Definir entorno de staging, HTTPS, secretos externos, migraciones de despliegue y pipeline de APK release firmado cuando exista un objetivo de publicación. |

## Próximas cinco tareas (valor alto, riesgo acotado)

1. Revisar e integrar, solo con autorización, HU 3.1 y luego las ramas dependientes A/B/C; probar el par de SHA en un clon nuevo del equipo.
2. Elegir proveedor/remitente autorizado, implementar/configurar su adaptador y demostrar entrega/recepción real de recuperación y aviso, sin publicar credenciales.
3. Repetir recorrido final Chrome normal/Android, teclado, enlaces e invalidación entre clientes; registrar capturas sin tokens y corregir únicamente fallos observados.
4. Automatizar CI con lockfiles, PostgreSQL aislado, análisis/tests/builds y la integración opt-in ya disponible; aprobar checks/protecciones por separado.
5. Revalidar alertas de npm audit individualmente y preparar correcciones compatibles con regresión, sin force ni actualizaciones mayores automáticas.

## Hallazgos HU 3.1 — 07/10/2026, no compromisos automáticos

- Alto: acordar una fuente canónica y el proceso de alta de lugares antes de presentar el mapa como monitoreo real. El fixture actual está identificado como demostrativo.
- Medio: la migración explícita de lugares es portable; fixtures siguen restringidos a desarrollo/prueba local. Definir permisos, copias y ejecución controlada de migraciones antes de un despliegue. Nunca reutilizar Supabase en este trabajo.
- Medio: OpenStreetMap requiere conectividad; la caída de teselas no está cubierta por el recorrido negativo del backend. Evaluar mensajes y política de uso antes de despliegue.
- Medio: las 24 pruebas backend y la comprobación PostgreSQL aislada amplían cobertura; todavía falta el E2E automatizado completo y una migración de `users`.
- Mejora futura: paginación/límites del catálogo cuando exista volumen real. No añadir búsqueda, filtros, saturación ni detalles completos dentro de HU 3.1.

## Dirección de incrementos — actualización 08/10/2026

HU 3.1 ya está publicada, aún sin integrar. Rael autorizó A → B → C en ramas dependientes, commits/push a origin sin merge ni cambios de backlog. A/B están publicados; C incorpora solo las partes verificables mientras falte correo real. Los apartados siguientes conservan el alcance de diseño, no comprometen responsables/puntos/fechas ni declaran historias cerradas.

### `feature/hu-2-1-2-recuperacion`

HU 2.1 y 2.2 forman un único recorrido: solicitar y restablecer. Implementado/probado en C con transporte exclusivo de pruebas: respuesta uniforme, límites persistentes, token aleatorio/hash, vencimiento15min, reemplazo y consumo atómico, bcrypt8caracteres/72bytes e invalidación persistente de sesiones. Frontend valida enlace antes del formulario y exige login nuevo. Envío real deshabilitado; faltan proveedor/remitente/adaptador, entrega/recepción y revisión manual antes de aceptar el recorrido completo. No imprimir tokens en logs/evidencias. Retención y entrega durable/reintentos requieren decisión antes de producción.

Criterio uniforme autorizado para sustituir el contradictorio del Issue backend #3 (no editado): misma respuesta pública para correo existente/inexistente, sujeto a validación/límites. Sin proveedor ambos reciben503; con transporte de prueba202/mensaje fijo del contrato. Piso temporal común200ms y entrega asíncrona mitigan atajos, pero no certifican tiempos indistinguibles bajo carga; verificarlo antes de exposición real.

Referencia para respuesta uniforme, token aleatorio/expirable y uso único: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

### `feature/hu-2-3-cambio-password`

Implementada/publicada en B: sesión y contraseña actual, validación/confirmación, rechazo de reutilización, bcrypt y versión de sesión persistente. Invalidación de JWT anteriores y concurrencia probadas; C incorpora también invalidación de recuperaciones pendientes. Falta revisión/integración y recorrido manual final; no mezclar commits con HU 3.1.

HU 2.4 ya está integrada: conservar borrado local/guardas. El cierre local por sí solo no revoca JWT; B/C sí invalidan versiones anteriores tras cambiar/restablecer contraseña. No reimplementar HU 2.4.

### Sprint 3 después de HU 3.1

Siguiente rama propuesta `feature/hu-3-3-detalle-lugar`: endpoint autenticado de detalle con nombre, dirección y categoría, 404 público; pantalla reutilizando mapa/modelo, carga/error/reintento y pruebas de contrato/navegación. Resolver fuente/datos de dirección antes de comprometer. La identificación breve actual no completa HU 3.3. HU 3.2 espera una fuente real/modelo de reportes para saturación: no inventar cifras con fixtures.

### Despliegue futuro (no ejecutado)

Web estático y API persistente se despliegan separadamente; no convertir Express a funciones improvisadamente. Evaluar un host estático (p. ej. Vercel, si se autoriza) y PostgreSQL administrado con TLS verificado, secretos externos, orígenes CORS exactos, HTTPS, backups y migraciones explícitas. El router usa `#/`; cambiarlo a rutas de path exigiría fallback al index. No se creó cuenta, base remota ni despliegue.
