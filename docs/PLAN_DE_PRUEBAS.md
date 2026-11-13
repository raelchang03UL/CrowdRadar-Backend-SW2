# Plan de pruebas — Pruebas unitarias e integrales

Rama `pruebas` (backend y frontend), 13/11/2026. Aplica los temas de ISW2 Semana 10 (pruebas unitarias) y Semana 11 (pruebas de integración y mutación).

## Cómo ejecutar

### Backend (Node 22, `node:test`)

| Comando | Equivalente Maven | Qué ejecuta |
| --- | --- | --- |
| `npm run test:unit` | `mvn test` (Surefire) | Solo `test/unit/**` |
| `npm run test:integration` | `mvn integration-test` (Failsafe) | Solo `test/integration/**` |
| `npm run test:verify` | `mvn verify` | Unitarias y, si pasan, integración |
| `npm test` | — | Toda la suite (pruebas históricas + nuevas) |
| `npm run test:coverage` | JaCoCo | Toda la suite con cobertura de `src/` y `app.js` |
| `npm run test:mutation` | PIT | Stryker sobre la lógica de negocio pura |

Las suites Bottom-Up y Big Bang usan PostgreSQL **local** real. Copia `.env.test.example` como `.env.test` y completa `TEST_DB_USER`/`TEST_DB_PASSWORD` (rol con `CREATEDB`). Cada suite crea su base aislada `crowdradar_pruebas_<suite>` y la borra al terminar. Sin `.env.test` esas suites se marcan como **SKIP**, nunca como aprobadas.

### Frontend (Flutter)

```bash
flutter test --no-pub test/unit
flutter test --no-pub test/integration
flutter test --no-pub
```

## Estructura

```
backend/test/
  unit/cajanegra/    partición de equivalencia y valores límite
  unit/cajablanca/   camino básico (V(G)), condiciones y bucles
  unit/dobles/       Stub, Mock y Spy (mock de node:test ≈ Mockito)
  integration/topdown/   HTTP → controladores → servicios, Stubs abajo
  integration/bottomup/  Driver → repositorios/servicios → PostgreSQL real
  integration/bigbang/   sistema completo por HTTP sobre PostgreSQL real
frontend/test/
  unit/          modelos (caja negra) y PlacesCubit con Mock (caja blanca)
  integration/   Cubit → Servicio → SessionService → HTTP con MockClient
```

## Pruebas unitarias

### Caja negra — ejemplo: `validPassword`

| Condición | Clase válida | Clases no válidas |
| --- | --- | --- |
| Tipo (lógica) | CV1 string | CNV1 null, undefined, número, arreglo |
| Longitud (rango) | CV2 ≥ 8 caracteres | CNV2 < 8 |
| Contenido (lógica) | CV3 algún carácter no espacio | CNV3 solo espacios |
| Tamaño (rango) | CV4 ≤ 72 bytes UTF-8 | CNV4 > 72 bytes |

Valores límite: 7/8/9 caracteres, 72/73 bytes, 36 «ñ» (72 bytes) frente a 36 «ñ» + 1, 8 frente a 7 emojis. Con la misma técnica se prueban `parsePlaceId` (±2147483647, 0, ceros a la izquierda), `parseReportId` (2^63−1), `validCoordinates` (±90, ±180 y ±ε), `parseSaturationFilter` (miembro de conjunto), configuración de entorno (pool 1..20, secreto de 32 caracteres, FCM 6..30) y los esquemas AJV (255/256 caracteres).

### Caja blanca — prueba del camino básico

| Unidad | Nodos predicado | V(G) | Caminos probados |
| --- | --- | --- | --- |
| `reliability()` | count<3, peso=0, ≥2/3, ≤1/3 | 5 | INSUFFICIENT ×2, ALTO, BAJO, MEDIO + fronteras 2/3 y 1/3 |
| `evaluateSaturation()` | snapshot, bucle, reporte inválido, ventana, voto más reciente, mínimo, ganador único | 8 | 8 caminos + bucle con 0, 1 y 100 iteraciones |
| `period()` | formato, fecha inexistente, rango | 4 | 4 caminos + límite de 31 días |
| `requireAdministratorSession()` | 5 condiciones OR + rol | — | cobertura de cada condición simple |
| `PlacesCubit.loadPlaces()` (Flutter) | sesión, varios filtros, nombre, categoría, nivel, éxito | 7 | 7 caminos |

El grafo de flujo y el cálculo `V(G) = P + 1 = A − N + 2` de cada unidad están comentados al inicio de su archivo de prueba.

### Dobles de prueba

| Mockito | `node:test` |
| --- | --- |
| `when(x).thenReturn(y)` | `mock.method(obj, "x", async () => y)` |
| `verify(mock).x(args)` | `obj.x.mock.calls[0].arguments` |
| `verify(mock, never())` | `obj.x.mock.callCount() === 0` |
| `thenThrow(...)` | implementación que lanza el error |
| `spy(obj)` | `mock.method(obj, "x")` sin implementación |

Se aplican a `AuthService` (repositorio y bcrypt), `SaturationReportService` (Mock inyectado por constructor), `UserService`, `PlaceService`, middlewares y controladores (`req` Stub, `res`/`next` Spies).

## Pruebas de integración

| Estrategia | Archivo | Componentes reales | Elemento de apoyo |
| --- | --- | --- | --- |
| Top-Down, incremento 1 | `topdown/flujoCiudadano` | HTTP, rutas, middlewares, controladores | Stub de servicios |
| Top-Down, incremento 2 | `topdown/flujoCiudadano`, `topdown/correcciones-registro` | + servicios | Stub de repositorios en memoria |
| Bottom-Up, paso 1 | `bottomup/repositoriosYServicios` | repositorios + PostgreSQL | Driver (la prueba) |
| Bottom-Up, paso 2 | `bottomup/repositoriosYServicios` | servicios + repositorios + PostgreSQL | Driver |
| Big Bang | `bigbang/sistemaCompleto` | todo, incluida la inicialización real | ninguno |
| Top-Down (frontend) | `integration/topdown_cubit_servicio_api_test.dart` | Cubit, servicio, sesión, cliente HTTP | Stub del backend (`MockClient`) |

Las pruebas de PostgreSQL cubren restricciones reales (UNIQUE de email), transacciones con rollback, karma, enfriamiento, favoritos, el SQL agregado de saturación, la validación comunitaria y la suspensión por un ADMIN.

## Pruebas de mutación (Stryker)

| Archivo | Mutation score |
| --- | --- |
| `utils/normalization.js` | 100.00 % |
| `services/ReportValidationService.js` | 95.38 % |
| `domain/administration.js` | 93.55 % |
| `utils/passwordPolicy.js` | 91.30 % |
| `services/SaturationQueryService.js` | 86.39 % |
| `services/SaturationReportService.js` | 86.00 % |
| **Total** | **89.82 %** (293 muertos + 7 timeout de 334) |

Un mutante vivo (`number < 0` → `number <= 0` en `reportDto`) reveló un caso límite que faltaba (conteo 0) y se agregó. La mayoría de los mutantes vivos restantes cambian solo textos de mensajes de error.

## Defectos encontrados y corregidos

| # | Defecto | Corrección | Prueba de regresión |
| --- | --- | --- | --- |
| 1 | Registro/login distinguían mayúsculas en el correo: `Ana@x.com` y `ana@x.com` creaban dos cuentas y rompían la recuperación, que sí normaliza | Correo normalizado; búsqueda `LOWER(BTRIM(email))` | `topdown/correcciones-registro`, `bottomup` |
| 2 | Nombre/apellido de solo espacios aceptados | Patrón de 2 caracteres visibles + recorte | `topdown/correcciones-registro`, `cajanegra/esquemas…` |
| 3 | Textos > 255 caracteres terminaban en 503 de la BD | `maxLength: 255` → 400 | ídem |
| 4 | `PUT /profile` con `{}` respondía 200 sin cambios | `minProperties: 1` → 400 | ídem |
| 5 | Rutas inexistentes devolvían HTML | 404 JSON `NOT_FOUND` | ídem y Big Bang |
| 6 | Frontend: `ListTile` de búsqueda dentro de `DecoratedBox` ocultaba el efecto al tocar (fallaban 9 pruebas con Flutter actual) | `Material` con el mismo fondo y borde | pruebas existentes de búsqueda y mapa |

## Resultados de la última ejecución (13/11/2026)

| Proyecto | Comando | Resultado |
| --- | --- | --- |
| Backend | `npm run test:coverage` con `.env.test` | 508 pruebas: 507 aprobadas, 0 fallidas, 1 omitida (histórica) |
| Backend | cobertura | 87.80 % líneas · 92.03 % ramas · 86.32 % funciones |
| Backend | `npm run test:mutation` | 89.82 % |
| Frontend | `flutter test --no-pub` (Flutter estable, Dart 3.14) | 795 aprobadas, 2 omitidas, 0 fallidas |
