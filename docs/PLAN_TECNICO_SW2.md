# Plan técnico SW2

La línea base Sprint 1 funciona en Android y PostgreSQL local. Este plan separa riesgos de trabajo inmediato: no implica implementar los Sprints 2–8 ni actualizar todas las dependencias.

| Prioridad | Área | Hallazgo y dirección |
| --- | --- | --- |
| Crítico | Reproducibilidad / base de datos | HU 3.1 local incorpora migración aditiva y probada de `places`; `users` sigue dependiendo de `User.sync()`. Versionar el esquema histórico y diseñar el camino de despliegue antes de ampliar otros modelos; mantener `crowdradar_sprint1` intacta. |
| Alto | Autenticación y seguridad | JWT sin revocación; recuperación/cambio todavía no existen. CORS ahora usa orígenes explícitos, no `*`. Revisar límites de abuso y expiración antes de exponer la API. El audit histórico del 4/10 reportó 9 paquetes (5 altos, 4 moderados); no se reejecutó en este cierre ni se actualizaron paquetes. |
| Alto | Pruebas | 24 pruebas backend, comprobación PostgreSQL de lugares y 69 Flutter; falta un E2E automatizado completo con PostgreSQL para autenticación y perfil. Los recorridos Android/Web reales son manuales, no un pipeline. |
| Medio | Configuración | DB por variables o URL, TLS verificado opcional y CORS configurable están cubiertos con dobles; solo PostgreSQL local fue ejecutado. Preparar secretos externos y configuración de staging cuando se autorice. |
| Medio | Arquitectura backend | Repositorio, servicios y controladores están separados, pero el arranque acopla HTTP y sincronización de esquema. Extraer el ciclo de DB cuando se introduzcan migraciones, sin refactorización masiva ahora. |
| Medio | Arquitectura frontend | Cubits y servicios cubren Sprint 1; el token vive en memoria y los errores HTTP/red se muestran de modo desigual. Definir una política única de sesión y errores antes de nuevas pantallas. |
| Medio | Experiencia de usuario | Login/registro/mapa ya tienen errores públicos; formulario estable, requisitos y mostrar/ocultar. Revisar en otra PC/Chrome normal y homogeneizar perfil/edición posteriormente, sin rediseño masivo. |
| Medio | Deuda técnica | Gradle/SDK XML y APIs obsoletas generan advertencias, aunque el APK compila. Revisar versiones de plugin/SDK de forma aislada cuando haya pruebas de regresión, no actualizar en bloque. |
| Mejora futura | Despliegue | Definir entorno de staging, HTTPS, secretos externos, migraciones de despliegue y pipeline de APK release firmado cuando exista un objetivo de publicación. |

## Próximas cinco tareas (valor alto, riesgo acotado)

1. Añadir un script E2E de desarrollo contra una base PostgreSQL desechable para registro, login, perfil y actualización, sin datos persistentes de la entrega.
2. Versionar el esquema `users` con una migración inicial y documentar el paso de `sequelize.sync()` a migraciones en bases nuevas; verificar sobre una base limpia antes de tocar bases existentes.
3. Revisar/publicar HU 3.1 con autorización y repetir el recorrido Chrome desde otra sesión/PC con las instrucciones finales.
4. Revalidar una por una las alertas de `npm audit`, proponer actualizaciones compatibles y probarlas por separado, sin `--force`.
5. Refinar HU 2.1–2.2 juntas y acordar entrega de correo, respuesta uniforme y política de sesiones antes de implementarlas en otra rama.

## Hallazgos HU 3.1 — 07/10/2026, no compromisos automáticos

- Alto: acordar una fuente canónica y el proceso de alta de lugares antes de presentar el mapa como monitoreo real. El fixture actual está identificado como demostrativo.
- Medio: la migración explícita de lugares es portable; fixtures siguen restringidos a desarrollo/prueba local. Definir permisos, copias y ejecución controlada de migraciones antes de un despliegue. Nunca reutilizar Supabase en este trabajo.
- Medio: OpenStreetMap requiere conectividad; la caída de teselas no está cubierta por el recorrido negativo del backend. Evaluar mensajes y política de uso antes de despliegue.
- Medio: las 24 pruebas backend y la comprobación PostgreSQL aislada amplían cobertura; todavía falta el E2E automatizado completo y una migración de `users`.
- Mejora futura: paginación/límites del catálogo cuando exista volumen real. No añadir búsqueda, filtros, saturación ni detalles completos dentro de HU 3.1.

## Preparación siguiente — no implementada ni comprometida

Primero revisar e integrar/publicar HU 3.1 con autorización. No crear estas ramas ni modificar Issues/Project en el cierre actual.

### `feature/hu-2-1-2-recuperacion`

HU 2.1 y 2.2 son un único recorrido E2E: solicitar y restablecer. Backend: respuesta uniforme para correo existente/inexistente, límites de abuso; token aleatorio criptográfico, almacenar solo hash, vencimiento corto configurable, invalidar anteriores, consumo atómico de un solo uso mediante transacción/condición para impedir carreras. Guardar contraseña con bcrypt respetando máximo 72 bytes. Proveedor de entrega desacoplado: adaptador falso/local para pruebas privadas, futuro adaptador correo; no imprimir tokens en producción ni incluirlos en evidencias públicas. Frontend: pantallas Web/Android coherentes para solicitud, confirmación genérica, token inválido/expirado y nueva contraseña/confirmación. Pruebas: expiración, reutilización, concurrencia (solo un ganador), solicitudes repetidas y no enumeración. Decidir invalidación de sesiones antes de aceptar el recorrido completo.

Criterio propuesto para reemplazar el contradictorio del Issue backend #3 (no editado): «Ante cualquier correo con formato válido, exista o no una cuenta, el sistema devuelve el mismo estado HTTP y el mensaje “Si existe una cuenta asociada a ese correo, recibirás instrucciones para restablecer tu contraseña”, sin revelar la existencia de la cuenta mediante el cuerpo, los errores ni diferencias observables sistemáticas de tiempo. El envío solo se realiza cuando corresponde y queda sujeto a límites de abuso.»

Referencia para respuesta uniforme, token aleatorio/expirable y uso único: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

### `feature/hu-2-3-cambio-password`

Requiere sesión autenticada y contraseña actual. Validar/confirmar nueva, rechazar actual incorrecta y reutilización inmediata, bcrypt, invalidar recuperaciones pendientes de manera transaccional. Acordar invalidación de sesiones anteriores (el JWT actual es sin estado) antes de prometerla; cubrir backend y frontend, errores y concurrencia. No mezclar con HU 3.1.

HU 2.4 ya está integrada: conservar borrado local/guardas; un JWT emitido todavía no se revoca en backend. No reimplementarla.

### Sprint 3 después de HU 3.1

Siguiente rama propuesta `feature/hu-3-3-detalle-lugar`: endpoint autenticado de detalle con nombre, dirección y categoría, 404 público; pantalla reutilizando mapa/modelo, carga/error/reintento y pruebas de contrato/navegación. Resolver fuente/datos de dirección antes de comprometer. La identificación breve actual no completa HU 3.3. HU 3.2 espera una fuente real/modelo de reportes para saturación: no inventar cifras con fixtures.

### Despliegue futuro (no ejecutado)

Web estático y API persistente se despliegan separadamente; no convertir Express a funciones improvisadamente. Evaluar un host estático (p. ej. Vercel, si se autoriza) y PostgreSQL administrado con TLS verificado, secretos externos, orígenes CORS exactos, HTTPS, backups y migraciones explícitas. El router usa `#/`; cambiarlo a rutas de path exigiría fallback al index. No se creó cuenta, base remota ni despliegue.
