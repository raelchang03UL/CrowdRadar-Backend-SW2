# Catálogo de demostración local — Miraflores

Verificado el 19/10/2026. **Lugares reales en un entorno demostrativo, sin monitoreo en tiempo real.** No acredita aforo, condiciones actuales, acceso/horarios ni aceptación formal del catálogo por el equipo.

## Fuentes y precisión

Coordenadas WGS84 recuperadas de la API Nominatim de OpenStreetMap el 19/10/2026. Representan el objeto cartográfico, no necesariamente su puerta; no se desplazaron puntos para separarlos. Datos © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). El mapa conserva la atribución. Fuente institucional/operador contrastada para nombre, tipo y ubicación postal. Categorías son la clasificación de esta demo, no datos de saturación.

| ID estable | Lugar / categoría | Latitud, longitud / objeto OSM | Ubicación y fuente contrastada |
| --- | --- | --- | --- |
| -2005 | Parque John F. Kennedy / Parque | -12.1217806, -77.0304221 · [way28798160](https://www.openstreetmap.org/way/28798160) | [Municipalidad](https://www.miraflores.gob.pe/los-servicios/cultura-y-turismo/turismo/atractivos-turisticos/): entre Shell, Lima, Virgen Milagrosa y Av. Óscar Benavides. Dirección postal nula; se conserva la referencia, sin numeración inventada. |
| -2004 | Parque del Amor / Parque | -12.1267365, -77.0365127 · [way76738820](https://www.openstreetmap.org/way/76738820) | [Municipalidad](https://www.miraflores.gob.pe/los-servicios/cultura-y-turismo/turismo/atractivos-turisticos/): Malecón Cisneros. OSM lo denomina Parque Alberto Andrade Carmona; alias registrado en referencia. |
| -2003 | Larcomar / Comercio | -12.1322184, -77.0302263 · [way28993402](https://www.openstreetmap.org/way/28993402) | [Operador](https://www.larcomar.com/): Malecón de la Reserva 610, Miraflores. Se seleccionó mall, no la parada de bus homónima. |
| -2002 | Huaca Pucllana / Cultura | -12.1114871, -77.0339531 · [way496000353](https://www.openstreetmap.org/way/496000353) | [Ministerio de Cultura](https://museos.cultura.pe/index.php/node/349): Calle General Borgoño cuadra 8, Miraflores. Coordenada del recinto arqueológico, no de la puerta/restaurant. |
| -2001 | Museo Amano / Cultura | -12.1140615, -77.0407663 · [node1932068153](https://www.openstreetmap.org/node/1932068153) | [Museo](https://www.museoamano.org/visitanos/): Calle Retiro160, Miraflores. |

Se guardó la respuesta cartográfica consultada en la evidencia local del paquete. No se descargaron fotografías, se inventaron reportes/puntos o se hicieron llamadas de geocodificación desde la app. El caso de puntos superpuestos permanece en QA, sin alterar este catálogo para forzarlo.

## Seguridad e idempotencia

- Solo `crowdradar_demo_local` en localhost/127.0.0.1/::1, con marca de procedencia `CrowdRadar/SW2/demo-local/v1`. La guarda nueva no amplía los runners QA ni los fixtures de desarrollo.
- La CLI no crea bases ni conecta a QA/sistema para aprovisionar. `check` verifica la demo ya identificada sin escribir. Si hay procedencia incierta, detenerse; nunca comentar una base ajena para eludir la barrera. El antiguo modo init se retiró.
- Migraciones históricas001–007 reutilizadas sin editar; ejecución explícita, no al arrancar API. El seed usa una transacción y lock de catálogo. Compara ID/nombre y todos los campos antes de insertar; no hace UPDATE, DELETE, truncado o sobrescrituras. Conflicto revierte el lote; segunda ejecución no duplica ni cambia direcciones. IDs negativos estables, sin consumir la secuencia de usuarios/lugares normales.
- No crea usuarios ni contraseñas, reportes, ledger o estadísticas. Usuario nuevo empieza en0; reportar por UI usa la regla existente de10 puntos/3 minutos y requiere confirmación del servidor. Sin observaciones: información insuficiente, no Tranquilo por defecto.
- La API demo escucha solo127.0.0.1:3043; CORS exacto para127.0.0.1/localhost:5543. SMTP forzado vacío y clave JWT efímera independiente. No se escribe `.env` ni se copia configuración privada al build.

## Entrada reproducible para otro integrante

Requisitos verificados: Git, Node22.20/npm10.9, PostgreSQL18 local, Flutter3.41.9/Dart3.11.5 y navegador. Android SDK no es necesario para Web. Instalar estos requisitos en otra PC es responsabilidad de su operador; esta tarea no instala nada.

En una carpeta nueva, clonar **ambos** repositorios con `-b integration/cierre-web-r01-s03-20261019` cuando la rama esté publicada. `develop` no incorpora este candidato hasta que se fusionen sus PR. No necesitas carpetas tmp, cuentas ni archivos privados de Rael.

### 1. Aprovisionamiento inicial MANUAL

La herramienta de aplicación no necesita una conexión de mantenimiento. Un administrador local debe comprobar en pgAdmin/psql que **crowdradar_demo_local no existe**. Si existe, detenerse y revisar propietario/procedencia/datos; no adoptar, borrar, renombrar ni cambiar su comentario para hacer pasar la guarda.

Solo para una base NUEVA y vacía, el administrador ejecuta secuencialmente, deteniéndose ante cualquier error:

```sql
CREATE DATABASE crowdradar_demo_local;
COMMENT ON DATABASE crowdradar_demo_local IS 'CrowdRadar/SW2/demo-local/v1';
```

Usar el rol local elegido como propietario o pedir al administrador que seleccione ese propietario al crearla. Debe poder aplicar sus migraciones; no se requieren credenciales de otro estudiante. **Este paso administrativo no se ejecutó de nuevo en el cierre**: se conservó la demo creada antes. No hay excepción nueva para postgres/template/Sprint1/QA/Supabase ni SQL remoto autorizado. No ejecutar este procedimiento sobre bases históricas. La CLI ya no ofrece init ni CREATE DATABASE.

### 2. Backend: configuración privada, migraciones y arranque

Desde la raíz de tu clon backend:

```powershell
npm ci
Copy-Item .env.demo.example .env.demo
# Editar .env.demo SOLO en tu PC: DB_HOST,DB_PORT,DB_USER,DB_PASSWORD.
# DB_USER/DB_PASSWORD vienen vacíos, sin credenciales predeterminadas.
$env:CROWDRADAR_DEMO_ENV_FILE = (Resolve-Path .env.demo).Path
npm run demo:local -- check
npm run demo:local -- migrate
npm run demo:local -- seed
npm run demo:local -- serve
```

No copiar sobre un.env.demo ya configurado. `npm ci` usa package-lock.json sin actualizarlo; en esta tarea se usaron dependencias existentes. Configuración demo selecciona únicamente esas4variables: destino fijo, sin URLs remotas, sin SMTP ni JWT del archivo. `check` falla ante nombre/host/procedencia incorrectos; no adopta nada. `migrate` reutiliza001–007 y `seed` no duplica ni cambia filas ajenas. No se copia información de usuarios de otra DB.

### 3. Frontend: build nuevo y servidor local

Desde la raíz de tu clon frontend, en otra terminal:

```powershell
flutter pub get --enforce-lockfile
flutter analyze --no-pub
flutter test --no-pub
$demoBuild = Join-Path (Get-Location).Path ("build/demo-web-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
flutter build web --no-pub --dart-define=API_BASE_URL=http://127.0.0.1:3043 --output="$demoBuild"
node tool/serve_demo_web.mjs "$demoBuild"
```

Se conserva pubspec.lock; no usar pub upgrade. Salida **absoluta** nueva evita un fallo observado de shaders con salida relativa en Windows y no sobrescribe evidencias. `build/` está ignorado. Servidor estático solo loopback, no producción. Si3043/5543 están ocupados, identificar al dueño y detenerse, no finalizar procesos ajenos ni cambiar puertos sin coordinar CORS/API.

Abrir http://127.0.0.1:5543/#/login (API3043). Crear tu propia cuenta sintética con nombre/apellido/distrito de2caracteres o más, teléfono de9dígitos, correo con formato válido y único, contraseña propia de8caracteres o más/máximo72bytesUTF-8. No hay usuario/contraseña precargados. No usar datos personales ni publicar contraseñas. Registro no confirma propiedad del correo.

SMTP demo deshabilitado: recuperación devuelve indisponibilidad uniforme; no afirmar envío real. JWT/usuario solo en memoria: refrescar Flutter exige login; reiniciar API rota su clave demo. Un reporte aceptado suma10puntos una vez y cooldown3min no suma; no generar observaciones para simular monitoreo real.

## Evidencia y límites

Pruebas actuales, capturas ligeras y procedencia accesibles desde [cierre de revisión](CIERRE_WEB_R01_S03.md). Comparaciones históricas C2 usan mismo catálogo5/Kennedy/0observaciones/tamaño; QA9→demo5 es cambio de datos, no mejora visual controlada. No se requieren los snapshots locales para revisar el PR.

No equivale a QA de Release desde cero, SMTP real, aceptación, integración en develop o despliegue. Esos pendientes no bloquean por sí solos publicar una rama de revisión.
