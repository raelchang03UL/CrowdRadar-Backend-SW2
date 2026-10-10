# Arquitectura backend

Descripción del incremento HU 3.1/Web revisado el 07/10/2026 en `feature/hu-3-1-mapa-lugares`, desde la base `a6da9a7`. Confirmar Git y el estado de integración del PR al reutilizarla. No constituye prueba de despliegue.

## Responsabilidades

```text
Cliente Flutter
  → app.js (CORS, JSON, rutas)
  → src/routes (validación de entrada y JWT)
  → src/controllers (HTTP y respuesta)
  → src/services (reglas y datos públicos)
  → src/repositories (acceso a datos)
  → src/models / Sequelize → PostgreSQL
```

`AuthService` cifra contraseñas con bcrypt; `src/utils/jwt.js` firma JWT de dos horas. El middleware verifica la firma/expiración y usa el usuario del token; no existe aún revocación ni versión de sesión. `UserRepository` excluye `passwordHash` de consulta/actualización del perfil. Lugares filtra activos y valida coordenadas antes de devolver un DTO explícito.

El [contrato API](CONTRATO_API.md) define el intercambio con Flutter. No devolver modelos completos nuevos por comodidad ni aceptar campos de rol/estado desde formularios ciudadanos.

## Configuración y persistencia

`src/config/environment.js` configura DB por `DB_*` o `DATABASE_URL`, TLS opcional con certificado verificado y CORS por orígenes exactos. `.env` es privado. `app.js` autentica conexión, mantiene el histórico `User.sync()` y escucha HTTP; no migra `places`.

`scripts/migrate.js` ejecuta la migración explícita transaccional de `places` y registra su aplicación. `src/database/databaseSafety.js` protege destinos de migración y restringe fixtures/pruebas a DB locales. Ver comandos en [configuración](CONFIGURACION_LOCAL.md). Nuevos esquemas deben extender este ciclo mediante migraciones aditivas, no mediante sincronización automática en cada arranque.

Los scripts no eliminan la base histórica. Cada PC reproduce esquema/fixtures, no copia credenciales. Una migración aplicada no se reescribe para cambiar su significado; añadir una nueva y probar actualización/base limpia.

## Pruebas y límites

`npm test` usa Node Test Runner, HTTP loopback y repositorios/conexiones dobles; cubre validaciones, bcrypt, JWT y contratos básicos. `npm run test:db:places` comprueba SQL real exclusivamente en `crowdradar_hu31_test`. Estos tests no constituyen una prueba E2E completa de autenticación sobre PostgreSQL.

Deuda conocida: migración formal `users`, errores y validaciones desiguales, control de abuso, revocación tras cambio/restablecimiento, catálogo limitado/no paginado y CI. Las funciones de contraseña siguen pendientes. Su diseño debe reutilizar servicios/repositorios, no añadir lógica de seguridad directamente en los controladores.

Para despliegue futuro: URLs por entorno, HTTPS, secretos externos, migraciones controladas, DB con TLS y logs sin credenciales/tokens. No hay proveedor ni despliegue autorizado/configurado en esta guía.
