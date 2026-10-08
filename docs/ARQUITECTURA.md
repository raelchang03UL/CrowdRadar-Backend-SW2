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

`AuthService` cifra contraseñas con bcrypt; `src/utils/jwt.js` firma JWT HS256 de dos horas con `sessionVersion`. Desde HU 2.3, el middleware verifica firma/expiración y consulta usuario activo/versión en DB para cada petición protegida; falla cerrado si la DB no está disponible. No admite JWT legacy sin versión. `UserRepository` excluye `passwordHash` y `sessionVersion` de consulta/actualización del perfil. Lugares filtra activos y valida coordenadas antes de devolver un DTO explícito.

El cambio de contraseña bloquea la fila de usuario en una transacción, vuelve a verificar su versión/estado, comprueba contraseña actual y no reutilización, y confirma bcrypt más incremento de versión juntos. Dos cambios simultáneos con el mismo JWT no pueden sobrescribirse: el segundo queda invalidado. Las peticiones ya autenticadas/en curso no se cancelan retroactivamente; las siguientes se rechazan. Un login concurrente puede recibir una versión que acaba de invalidarse y deberá repetirse. El cierre local HU 2.4 no incrementa la versión.

El [contrato API](CONTRATO_API.md) define el intercambio con Flutter. No devolver modelos completos nuevos por comodidad ni aceptar campos de rol/estado desde formularios ciudadanos.

## Configuración y persistencia

`src/config/environment.js` configura DB por `DB_*` o `DATABASE_URL`, TLS opcional con certificado verificado y CORS por orígenes exactos. `.env` es privado. `app.js` autentica conexión, verifica esquema de autenticación y escucha HTTP; nunca ejecuta DDL ni sincroniza modelos.

`scripts/migrate.js` ejecuta `001-create-places` (inmutable) y `002-users-session-version`, con transacción, bloqueo e historial por migración. `002` crea el baseline `users` en una DB limpia o reconoce sus columnas previas y añade solo la versión; no transforma datos históricos ni adopta una columna de seguridad sin historial. `src/database/databaseSafety.js` protege destinos de migración y restringe fixtures/pruebas a DB locales. Ver comandos en [configuración](CONFIGURACION_LOCAL.md). Nuevos esquemas deben extender este ciclo mediante migraciones aditivas, no mediante sincronización automática en cada arranque.

Los scripts no eliminan la base histórica. Cada PC reproduce esquema/fixtures, no copia credenciales. Una migración aplicada no se reescribe para cambiar su significado; añadir una nueva y probar actualización/base limpia.

## Pruebas y límites

`npm test` usa Node Test Runner, HTTP loopback y repositorios/conexiones dobles; cubre validaciones, bcrypt, JWT y contratos. `npm run test:db:places` comprueba SQL real exclusivamente en `crowdradar_hu31_test`. `npm run test:db:auth` comprueba migración y flujo HTTP de cambio sobre PostgreSQL exclusivamente en `crowdradar_auth_test`, incluidas concurrencia y rollback. No equivale a una prueba visual del frontend.

Deuda conocida: errores/validaciones históricas de perfil desiguales, control de abuso, recuperación y entrega de correo real, catálogo limitado/no paginado y CI. HU 2.3 añade cambio/revocación por versión; no implementa recuperación/restablecimiento ni tokens de recuperación.

Para despliegue futuro: URLs por entorno, HTTPS, secretos externos, migraciones controladas, DB con TLS y logs sin credenciales/tokens. No hay proveedor ni despliegue autorizado/configurado en esta guía.
