# Plan técnico SW2

La línea base Sprint 1 funciona en Android y PostgreSQL local. Este plan separa riesgos de trabajo inmediato: no implica implementar los Sprints 2–8 ni actualizar todas las dependencias.

| Prioridad | Área | Hallazgo y dirección |
| --- | --- | --- |
| Crítico | Reproducibilidad / base de datos | `sequelize.sync()` crea el esquema inicial, pero no versiona cambios. Definir primera migración reproducible antes de ampliar el modelo; mantener `crowdradar_sprint1` intacta. |
| Alto | Autenticación y seguridad | Revisar expiración y persistencia del JWT, validación de entradas, CORS abierto y exposición de errores internos antes de un despliegue público. `npm audit` reporta 2 altas y 3 moderadas; evaluar actualizaciones puntuales, sin `--force`. |
| Alto | Pruebas | Las 4 pruebas backend usan repositorio en memoria; falta automatizar un E2E desechable con PostgreSQL y el contrato consumido por Flutter. Las pruebas Android actuales son manuales. |
| Medio | Configuración | `.env.example` y `--dart-define` permiten desarrollo local; separar explícitamente valores de desarrollo y producción y añadir validación de URL/secretos sin publicar credenciales. |
| Medio | Arquitectura backend | Repositorio, servicios y controladores están separados, pero el arranque acopla HTTP y sincronización de esquema. Extraer el ciclo de DB cuando se introduzcan migraciones, sin refactorización masiva ahora. |
| Medio | Arquitectura frontend | Cubits y servicios cubren Sprint 1; el token vive en memoria y los errores HTTP/red se muestran de modo desigual. Definir una política única de sesión y errores antes de nuevas pantallas. |
| Medio | Experiencia de usuario | La conexión rechazada muestra `ClientException` cruda. Convertir fallos de red en mensaje claro con reintento; conservar los códigos de validación y credenciales incorrectas. |
| Medio | Deuda técnica | Gradle/SDK XML y APIs obsoletas generan advertencias, aunque el APK compila. Revisar versiones de plugin/SDK de forma aislada cuando haya pruebas de regresión, no actualizar en bloque. |
| Mejora futura | Despliegue | Definir entorno de staging, HTTPS, secretos externos, migraciones de despliegue y pipeline de APK release firmado cuando exista un objetivo de publicación. |

## Próximas cinco tareas (valor alto, riesgo acotado)

1. Añadir un script E2E de desarrollo contra una base PostgreSQL desechable para registro, login, perfil y actualización, sin datos persistentes de la entrega.
2. Versionar el esquema `users` con una migración inicial y documentar el paso de `sequelize.sync()` a migraciones en bases nuevas; verificar sobre una base limpia antes de tocar bases existentes.
3. Traducir el error de conexión del frontend a un mensaje comprensible y añadir pruebas del caso backend apagado y de reintento.
4. Revisar una por una las cinco alertas de `npm audit`, aplicar solo actualizaciones compatibles y ejecutar pruebas backend/Android tras cada cambio.
5. Ampliar pruebas de autenticación y perfil (token ausente/expirado, entradas inválidas y respuesta de error) para fijar el contrato antes de añadir funciones.
