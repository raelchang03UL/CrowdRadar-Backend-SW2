# Estado actual

## HU8 integrado localmente para revisión — 30/10/2026

Implementación backend22486caba0a9d831597e3382988947be890361cc sobre develop06de599f494a66131cfe339557306e31a2d34c31, rama feature/hu-8-4-eliminar-favoritos. Tres merges locales preservan los aportes originales1762613/853781a/3c68fca y sus autores; correcciones registradas como colaboración delegada asistida. No se fusionó develop ni se desplegó. El par frontend y publicación/revisión se deben comprobar en los PR existentes.

HU8.1/8.2/8.4 backend comprobadas con HTTP/PostgreSQL: marcar/doble envío409/PK, lista propia, estado en detalle/lista, eliminar idempotente, re-agregar y cuenta ajena sin cambios. Capas, SMTP, sesiones, HU1–7 y migraciones001–009 conservadas.010/011 nuevas desde esquema vacío y repetidas; filas existentes de favoritos/baseline se conservaron. Los nombres004 de las ramas HU8 previas requieren revisión explícita si alguien ya los aplicó; no se adopta esquema desconocido.

HU8.3 implementación local: primer favorito fija baseline real atómico;3 POST de reportes de usuarios distintos cambian SIN_DATOS→SATURADO, producen1 evento y1 llamada al doble FCM. Reconciliar sin cambio no duplica; retiro HU7 y expiración30min también cambian el cálculo. Re-registro con mismo JWT cambia binding; logout antiguo, transferencia de FID, favorito retirado o versión revocada no autorizan entrega a otra sesión/cuenta. Web recibe DATA-ONLY y depende de comprobación de binding en app/SW antes de mostrar/abrir.

Validación final: npm test219/219 (0 fallos/omitidas),130JS con node --check, git diff --check correcto. Clúster QA nuevo127.0.0.1:55488, crowdradar_hu8_test con procedencia CrowdRadar/SW2/hu8-20261030/v1:7 bloques HU8 aprobados; regresión PostgreSQL R01:6/6, S3:7/7fresh+7/7legacy, HU7:18/18. Ninguna conexión a bases personales/Sprint1/Supabase ni correo real. [Evidencia reproducible](evidencias/hu8_2026_10_30/backend-verificacion.txt).

Límite abierto: NO se demostró recepción ni apertura FCM real en Web. Falta configuración Firebase/VAPID/ADC autorizada y recorrido navegador/proveedor; no compartir secretos por chat. El worker local opt-in y endpoint interno están implementados, pero Vercel requiere ejecutor/scheduler durable aprobado y validado. No se declara HU8.3 terminada ni “solo falta despliegue”. npm ci reprodujo el lock aportado con Firebase Admin14.5:301paquetes,9 avisos audit (5 moderados/3 altos/1 crítico); no se hicieron actualizaciones automáticas.


## HU7 para revisión — 28/10/2026

Rama feature/hu-7-moderacion-kou; aporte de Nicolás Kou, cuenta kowisprox. [Backend42](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/42) y [frontend23](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/pull/23). Los heads de los PR identifican el par publicado. Pendiente revisión ajena e integración; no se cierran historias automáticamente.

- HU7.1–7.4 implementadas: usuarios/búsqueda/detalle; suspensión y reactivación manual; reportes denunciados con total, motivos agrupados, decisiones e historiales persistidos. Nueva denuncia sobre un conservado devuelve Pendiente.
- HU7.3 informa suspensión con403 ACCOUNT_SUSPENDED únicamente después de comprobar la contraseña. Correo inexistente o clave incorrecta conserva401 uniforme. No emite token a cuentas suspendidas; sesiones anteriores permanecen inválidas después de reactivar y se requiere un nuevo login.
- Migraciones explícitas008/009, aditivas; aplicar npm run db:migrate antes de servir. Arranque solo SELECT. ADMIN activo revalidado, destinos ciudadanos y revisión/total esperados; decisión y auditoría atómicas. Retirar conserva evidencia privada, cuenta y karma; excluye cálculos públicos actuales e históricos.
- Verificación actual: npm test200/200; frontend615 aprobadas, cero fallidas y dos opt-in previas omitidas; análisis limpio. Los tres runners HU7 completaron18 bloques SQL/HTTP reales en crowdradar_hu7_test local5447, incluidos aviso correcto/clave errónea, rollback, concurrencia y preservación. Sin SMTP ni acceso a bases históricas.
- Observación de revisión corregida: R01 prepara001–009 y S3 añade007–009 antes de usar la API actual. R01 pasó6/6 en instancia nueva; S3 pasó7/7 en cuatro bases fresh/legacy, incluidas las de reproducción con esquemas006/007. Comprobaciones de preservación ampliadas para columnas nuevas y previas; migraciones históricas y guardas intactas. npm test200/200 y18 bloques HU7 repetidos.
- Recorrido Web y capturas portables en el frontend; [criterios y reproducción](REVISION_HU7.md), [contrato](CONTRATO_API.md). Frontend sin cambios en esta corrección; Android, lectores de pantalla y nube siguen pendientes.

## Antecedentes anteriores a HU7

Los cortes inferiores conservan su fecha y alcance originales. El estado vigente de HU7 es el resumen superior; sus iteraciones previas se conservan en Git.

## Vigente: aceptación Web y revisión de integración — 20/10/2026

Par funcional: B`5d467ca66adb7a9dc26d2d0e13b87c957258e69d` / F`1ef1b9b7312bd8d57d508c10888427bb2cb1d005`, con documentación posterior sin cambios funcionales. PR#39/backend y #21/frontend requieren revisión de otra persona antes de merge según CONTRIBUTING/COORDINACION. Los SHA publicados actuales se verifican en sus PR; no confundir preparación con develop integrado.

- Backend177/177,96JS sintácticamente válidos; Flutter562 en batería general y las2opt-in ejecutadas aparte1/1cada una, análisis limpio y Web58s/API3053. R01 PostgreSQL nuevo/legacy6/6; S3fresh7/7+legacy7/7; recuperación6bloques, sin correo real. Detalle en CIERRE_WEB_R01_S03.
- Solo se crearon los dos destinos locales de cierre expresamente autorizados, inexistentes antes del aprovisionamiento. No adopción/borrados; procedencia estricta y migraciones históricas intactas. QA/demo/DBpersonales/Sprint1/Supabase previas conservadas.
- Recorrido real Web5553→API3053→PostgreSQL cierre: alta/login, búsqueda, reporte+10, historial→perfil, voto ajeno definitivo, denuncia sin ocultación, historia/comparación/horarios y logout/rutas protegidas. Todo sintético; no negocio real.
- Recepción SMTP de Diego16/10 reutilizable como evidencia histórica identificada: servicio/adaptador/configuración/contrato de correo sin cambios desde ese par. No envío nuevo ni credenciales SMTP solicitadas. Cambio/reset e invalidación sí repetidos con SQL/HTTP y widgets reales.
- Aceptación global R01/S3 pendiente de revisión ajena/merge del par y smoke del develop resultante. Rael aprobó dirección ausente explícita(HU3.3) y «cercanos»como catálogo disponible sinGPS/radio(HU3.5/3.6);ya no son decisiones abiertas. Respuestas uniformes HU1.1/2.1 ratificadas;no revelar cuentas. HU4.1no exigecontador restante.
- Audit conserva10paquetes:1crítico/5altos/4moderados, sin fix. Android/Chrome normal/manual200%/lector no ejecutados ahora; aceptación de este encargo limitada a Web. HU7/8 y Favoritos no implementados.

Los cortes siguientes son históricos; sus opt-in omitidas y estados locales ya no describen este corte. Plan de nube ejecutable en CONFIGURACION_LOCAL/PLAN_TECNICO, todavía sin ejecución remota.

## Vigente: cierre Web para revisión — 19/10/2026

Rama `integration/cierre-web-r01-s03-20261019` en ambos repositorios, conservando develop y candidatos B`eeff38b`/F`18cec26` más F3/C2. Publicación/par exacto acreditados por los PR, no por esta cabecera; no implica merge, aceptación R01/S3 ni despliegue. [Evidencia accesible/procedencia](CIERRE_WEB_R01_S03.md).

- Backend173/173,0fallidas/omitidas;95JS sintácticamente válidos;diff-check0. Demo35casos, incluido rechazo de init antes de leer configuración. Check/seed comprobados en demo existente: CLI ya no depende de QA ni crea bases. Aprovisionamiento inicial administrativo manual documentado, no repetido.
- Frontend analyze0problemas,562aprobadas/2opt-in omitidas;Web31,2s con API3043. Salida relativa falló escribiendo shaders; salida absoluta nueva completó sin cambiar código/dependencias.
- IAB final:login,búsqueda/selección,plegado,reporte,historial→perfil,ciclo perfil/historial,mapa,saldo10,logout/rutas protegidas. SQL cuenta sintética2:0/0/0→1reporte/1premio/10puntos. Dos reportes/premios previos conservados:totales2→3,20→30. Sin correo real.
- npm audit:10paquetes(1crítico/5altos/4moderados),sin fix/instalación ni aprobación para Internet. Migraciones históricas/protecciones de bases intactas.

QA desde cero,2opt-in,SMTP real,Android/Chrome normal,aceptación/revisión humana,integración y nube siguen pendientes separados de publicación. Cortes inferiores históricos preservados.

## Corte anterior: catálogo demostrativo local — 19/10/2026, 17:39 America/Lima

Backend candidato `fix/pruebas-reproducibles-20261018` / `eeff38b86c53d22180655ee5aa6fa501a2a5b061`, frontend `fix/mapa-reportes-ux-20261018` / `18cec26d0f2da755b9e436f04b715f431f54563d`, **más cambios sin commit**. C0 coincide exactamente con F3 del cierre anterior; no basta reproducir HEAD. Evidencia, snapshots C0/C1/C2 y diffs incrementales en [paquete local](../../../../tmp/catalogo-ux-20261019). Originales/borradores/experimento preservados.

- Nueva base `crowdradar_demo_local`, inexistente al inspeccionar pg_database. Guardas localhost/nombre exacto/procedencia; init rehúsa adoptar una existente. Migraciones001–007 históricas intactas,8 entradas de historial existentes por compatibilidad; no8 migraciones nuevas. API3043/Web5543 separados de QA3033/5533; SMTP deshabilitado,JWT efímero y.env sin editar.
- Seed transaccional de5 lugares con IDs negativos estables y fuentes verificadas: [catálogo canónico](CATALOGO_DEMO_LOCAL.md). Solo inserta ausentes; ID/nombre/datos incompatibles revierten el lote. Sin UPDATE/DELETE ni cuentas/reportes/premios precargados.
- **172/172 pruebas Node**,0 fallidas/omitidas, frente a138 del corte anterior;34 nuevas de catálogo/configuración/guardas con dobles. SQL real en la demo: repetición y2 ejecuciones concurrentes sin duplicados; conflicto rechazado y catálogo idéntico. Después de sembrar:5 lugares/0 usuarios/0 reportes/0 premios. La verificación SQL se conserva separada de los dobles.
- Recorrido IAB real con API/PostgreSQL demo: alta/login sintéticos, búsqueda Kennedy, categoría+saturación AND con vacío, quitar nivel recupera1 resultado; selección/lista, reporte confirmado y cooldown. SELECT antes:1 usuario/0 reportes/0 premios/0 puntos; después:1/1/1/10. Rechazo inmediato no añadió premio. Esta observación es **sintética**, no monitoreo real de Miraflores.
- Frontend actual: análisis sin problemas;555 aprobadas/2 opt-in omitidas/0 fallidas; Web44,5s. I1/I2 conservados; ficha/mapa/perfil más claros. Teclado Enter/Escape observado en IAB;360/390/1440 y texto2× cubiertos por widgets, tamaños1× también observados en IAB. No nueva validación Android/Chrome normal/lector/manual2×.

No aceptación/integración/publicación de Release01/Sprint3. QA R01 desde cero, opt-in, SMTP autorizado, criterios y revisión humana pendientes; avisos de dependencias del corte anterior sin corregir/instalar. Hallazgo de navegación previo: Historial usa currentIndex3 y CrBottomNav ignora tocar Perfil; volver atrás permite abrirlo. Registrar/corregir en otro paquete, no afirmar navegación íntegra aprobada. HU7/8 y Favoritos fuera. Las secciones inferiores son evidencia histórica, no estado vigente.

## Auditoría anterior — 19/10/2026

Rama `fix/pruebas-reproducibles-20261018`, HEAD `eeff38b86c53d22180655ee5aa6fa501a2a5b061` más los 4 archivos sin commit inventariados al iniciar. Par frontend `18cec26d0f2da755b9e436f04b715f431f54563d` más diff de mapa. SHA256 de archivos/estado probado en [manifiesto local](../../../../tmp/auditoria-20261019/verificacion.json). Esta auditoría solo edita documentación; no aprueba esos cambios ni publica nada.

- `npm test`: **138/138**,0 fallidas/omitidas,12,17s; HTTP loopback y dobles. `node --check`:90 JS correctos. `git diff --check`:0, solo aviso LF/CRLF en un test.
- Repetición focalizada con JWT/SMTP_HOST/CORS sintéticos ajenos: **14/14** en database-lifecycle/consolidation. Aislamiento de tests conservado, no conexión DB ni SMTP de esas suites.
- PostgreSQL **18.1**, servicio18activo. `npm run test:db:sprint3`: **7/7 fresh y7/7 legacy**;007 idempotente/concurrente, autorización, participación única, conteos/confiabilidad, historial y preservación de usuarios previos. Únicamente crowdradar_consolidacion_fresh_20261017 y crowdradar_consolidacion_legacy_20261017. Añade fixtures sintéticos nuevos; no borra bases.
- Runner R01 completo NO repetido: rechaza bases existentes. El6/6inferior es histórico. Reproducir después en instancia QA limpia o con destinos nuevos estrictamente autorizados/guardados, no eliminando lo conservado.
- API real3033: raíz200, alta201,login200,perfil200,PUT200 y reconsulta persistida,clave incorrecta401,lugares sinJWT401,nombre+categoríaAND200/1,detalle200. Token de reset inexistente400 RESET_TOKEN_INVALID. **Sin SMTP:forgot503 RECOVERY_UNAVAILABLE; no se envió correo real**. Reset/cambio SQL íntegros y2 opt-in no repetidos hoy.
- IAB real + SQL: reporte MODERADO aceptado y total10→20; intento dentro de 3 min rechazado. SELECT confirma2 reportes propios enQAParque,2 filas report_karma_awards y20 puntos. Perfil/historial/estado propio coherentes. Los9 lugares activos QA comparten(-12,-77), causa comprobada del grupo de marcadores; no es catálogo real.
- Nueva brecha frontend ante401: mapa/perfil conservan sesión inválida y solo ofrecen Reintentar; Validar sí limpia y vuelve a login. Se reprodujo tras reiniciar QA, cuya clave es aleatoria por arranque; no es fallo de DB ni revocación nueva. El rechazo de reporte tampoco informa explícitamente que no premió, brecha HU 4.2C3. No corregidos aquí.
- Audit actualizado: **10 paquetes** (1 crítico/5 altos/4 moderados); omit=dev **6**(1 crítico/1 alto/4 moderados), ambos exit1. Misma clasificación/rutas de la tabla inferior; no exploitable demostrado ni aprobación para Internet. Sin fix/instalación/locks modificados.

Origin actualizado sin mover ramas: develop `ffe9b19865c4952d5cb87a34f38fa71331197155`; candidato29 commits delante,0 detrás. Incluye aportes ya publicados en otras ramas; no significa29publicaciones nuevas. Árbol deliberadamente sucio, no limpiado. Originales/main/upstream preservados. **Release 01/Sprint 3 pendientes de aceptación e integración**; [matriz canónica](../../../../docs/MATRIZ_ACEPTACION_TRAZABILIDAD.md), dictamen por 24 HU y próximo paquete. Las capturas/resultados fechados inferiores siguen siendo históricos.

## Revisión local de reproducibilidad — 18/10/2026

Rama `fix/pruebas-reproducibles-20261018`, padre `eeff38b86c53d22180655ee5aa6fa501a2a5b061`. Solo cambian pruebas/documentación; no servicio, contrato, migraciones, dependencias ni datos del equipo.

- Al repetir la suite sin `.env` se identificaron cinco fallos dependientes de variables privadas: dos de validación del entorno y tres de firma JWT (`secretOrPrivateKey must have a value`). Se aislaron configuración sintética, transporte SMTP y CORS en las suites correspondientes, restaurando el entorno después.
- Repetición final en terminal local permitida: **138/138**, sin `.env` ni variables privadas añadidas. Son dobles/HTTP local, no nueva ejecución completa de los runners SQL.
- La ejecución restringida inicial produjo `fetch failed`/`EACCES`; un sondeo independiente confirmó el bloqueo de localhost. No se atribuye ese resultado a 57 defectos del producto.
- Recorrido Web sobre API3033 y base `crowdradar_consolidacion_fresh_20261017`: alta/login de cuenta sintética y reporte. SELECT de solo lectura verificó un reporte MODERADO propio en QA Parque y karma 10. No se tocaron bases personales, Sprint1 o Supabase ni se envió SMTP.
- `npm audit --omit=dev --json`: **6 paquetes**, 1 crítico/1 alto/4 moderados, sin instalar ni aplicar fix. Persisten las limitaciones de exposición/serverless detalladas más abajo. Pruebas aprobadas no equivalen a aprobación para Internet.

El par de revisión utiliza frontend `fix/mapa-reportes-ux-20261018`. Ambas ramas son locales sobre los candidatos aislados; los directorios originales y develop/main permanecen intactos. Publicarlas e integrarlas requiere autorización separada.

## Corte anterior local — R01 + Sprint 3, 18/10/2026

Rama `feature/local-s03-validacion-analitica-20261017`, dependiente de R01 local. Par funcional comprobado: backend `5f933eac9a0095fb802f5d95a65ea563d15df9b0` / frontend `a5e33ac9078cc882474a6d22961f9502f61c6ac0`. Los commits documentales posteriores no cambian ese código. NO publicado, integrado en develop ni aceptado por el equipo.

- R01 reutiliza aportes de Diego/Nick/Manu y corrige readiness, compatibilidad de migraciones, filtros combinados, premio atómico y errores/DTO. Identidades/autoría conservadas. Los árboles originales y experimento siguen fuera del candidato.
- HU5.1–5.4: voto definitivo y denuncia únicos por persona/reporte; usuario activo autenticado; sin autovoto/autodenuncia; pesos fijados al votar, conteos/estado público y consulta propia autorizada. Denunciar no oculta/elimina y no implementa HU7.
- HU6.1–6.3: bloques horarios Lima, períodos inclusivos de hasta 31 días, último voto/persona, mínimo 3 y empate insuficiente. Comparación de conteos, no promedios/aforos. Horarios con al menos 3 días suficientes y algún bloque tranquilo; proporciones ordenadas con empates. Reglas provisionales aprobadas por Rael, pendientes de validación grupal.
- Node 22.20.0 / npm 10.9.3: `npm test` **138/138**, 0 fallidas/omitidas; sintaxis **90 JS** correcta; diff check correcto. Incluye HTTP y dobles, no SMTP real.
- PostgreSQL 18: R01 **6/6 bloques** (desde cero y legacy); S3 **7/7 bloques en fresh y 7/7 en legacy** reales, repetidos tras corregir SQL. 007 aditiva/idempotente/concurrente; autorización, 201/409 simultáneos, peso congelado, denuncia sin eliminación, entradas/JSON/32 KB, 72 bloques históricos, comparación con datos/ausencia y JWT expirado/versión obsoleta y preservación de usuarios QA anteriores. No confundir bloques con cantidad de aserciones.
- Bases exclusivas: crowdradar_consolidacion_fresh_20261017 y crowdradar_consolidacion_legacy_20261017; conservadas. Solo nuevas cuentas/datos sintéticos example.invalid, nunca visitas reales. No base personal, Sprint1 ni Supabase.
- Configuración local probada: API y migrador seleccionan URLs/roles distintos; pool configurable y TLS con verificación. No se probaron roles, certificados o pooler remotos.
- Web: ver estado frontend/capturas; validación, denuncia, estado propio, historial, comparación, horarios y API detenida con error/reintento seguro; smoke final tras reinicio. QA escucha solo en127.0.0.1:3033 (socket verificado), no en interfaces de red. Sin correo real; SMTP QA deshabilitado.

### Dependencias y exposición pendiente

Consulta npm audit del 18/10, sin fix/instalación: **10** paquetes señalados en todo el árbol (1 crítico, 5 altos, 4 moderados); **6** en producción (1 crítico, 1 alto, 4 moderados). No son 10 vulnerabilidades nuevas causadas por el incremento ni pruebas de explotabilidad.

| Aviso / ruta | Evaluación en esta versión | Acción pendiente |
| --- | --- | --- |
| proxy-addr crítico vía Express, GHSA-jqcg-44mw-7w3h | No se configura trust proxy; recuperación usa socket IP. La precondición del aviso no se demostró activa, pero proxy/cloud puede cambiarla. | Actualización compatible aislada y pruebas de identidad/IP antes de exposición. |
| fast-uri alto vía Ajv | Esquemas compilados son locales/estáticos; no se localizó resolución de URLs o fetch externos guiados por URI del cliente. No se declara inmunidad. | Revisar actualización transitoria compatible y tests de validación. |
| qs moderado vía Express | Parser simple predeterminado; no express.urlencoded. Entradas complejas se rechazan en las rutas nuevas. | Repetir regresiones al actualizar Express/qs y fijar política de parser. |
| moment, uuid → Sequelize moderados | No importación directa de moment ni UUID v3/v5/v6 con buffers del cliente localizada; se mantiene Sequelize. | Revisar alcanzabilidad transitiva y versión compatible, no aceptar downgrade sugerido automático. |
| 4 altos adicionales de desarrollo | Fuera de la instalación omit=dev, no por ello ignorables en herramientas. | Tratar en paquete de dependencias autorizado. |

Detalles exactos JSON/logs en build/qa, ignorados por Git. No se ejecutó audit fix --force ni cambiaron locks. Esto no es un escaneo exhaustivo de seguridad. Sin rate limit global nuevo para todas las rutas, sin prueba de carga ni durabilidad SMTP; son límites previos a nube, no resueltos por este incremento.

Las secciones inferiores conservan cortes históricos; si dicen “pendiente”, se refieren a su versión/fecha.

## Corte local de consolidación Release 01 — 17/10/2026

Rama `feature/local-r01-consolidacion-20261017`, no publicada; base Bffe9b19/Fdfdb753. Se reutilizaron los diez PR de Nick y las tres ramas independientes de Manu, preservando commits/autores. No se tocaron los árboles originales con borradores/experimento. No implica aceptación humana de17 HU.

- Correcciones: readiness de detalle solo SELECT;005 concilia ambas004 de reportes sin reescribirlas;006 agrega karma/ledger. Registro, premio único +10 y total comparten transacción; cooldown3 minutos por usuario/lugar; sesión revalidada bajo lock.
- Nombre/categoría/nivel se combinan; respuestas públicas/DTO explícitos. Perfil convierte BIGINT a número seguro y oculta fallos internos.
- Node22.20.0:130/130 comprobaciones aprobadas (HTTP loopback y dobles). C1 reprodujo4 fallos antes/6 aprobadas después en sus tests de migración, y73/73 en el paquete previo.
- PostgreSQL18 real:6/6 bloques scripts/verify-consolidation-db.js, bases crowdradar_consolidacion_fresh_20261017 y crowdradar_consolidacion_legacy_20261017. Creación/actualización/idempotencia/concurrencia/preservación,201/409 simultáneos,premio único,rollback y sesión,aislamiento/filtros. No se borraron bases. El runner se niega a adoptar destinos existentes; repetir en clon/instancia QA limpia según configuración.
- No se repitió SMTP real; recuperación normal503 sin secretos SMTP. Dependencias/locks intactos; audit10 avisos heredados pendientes de corrección compatible.

Políticas aprobadas por Rael:10 puntos por reporte válido una sola vez;cooldown3 minutos;3 personas/30min para saturación yempate insuficiente. Código local probado no equivale a integración compartida/aceptación. Las secciones siguientes conservan fechas/resultados históricos; no usarlas como instrucciones vigentes.


## HU 3.4 — búsqueda por nombre, 10/10/2026

Rama `feature/hu-3-4-busqueda-lugares`, posterior a HU 3.3, para frontend #5. Filtra lugares activos por nombre completo/parcial, sin distinguir mayúsculas; conserva todas las coincidencias y devuelve lista vacía cuando no hay ninguna. Límite de 160 caracteres, recorte, consultas literales y errores públicos.

El PR depende de detalles y se compara inicialmente contra su rama para no duplicar el incremento HU 3.3. Integrar primero la pareja de detalles y retarget a develop antes de integrar búsqueda. No hay migración ni dependencias nuevas. Pruebas, par de commits y pendientes en los PR; la publicación no implica aceptación o cierre de la HU.

## HU 3.3 — consulta de detalles, 10/10/2026

Incremento en `feature/hu-3-3-detalles-lugar`, desde develop `46267e7`, para backend #7. Consulta autenticada por ID activo, DTO público con dirección opcional, errores 400/401/404/503 y migración aditiva `004-places-direccion`. El mapa y las migraciones previas se conservan; no incluye búsqueda por nombre.

Frontend compañero en la rama homónima: marcador → Ver detalles, carga/error/reintento, nombre/dirección/categoría/referencia y descarte tras cambio de sesión. Las direcciones de los fixtures son ilustrativas, no verificadas; una dirección real ausente no se inventa. Pruebas y par de commits se registran en los PR. Revisión humana, aceptación del catálogo y Android quedan pendientes; no se declara integrado ni terminado.

Las secciones siguientes conservan la evidencia histórica de otras tareas.

## HU 3.5 — filtro por categoría, revisión local 11/10/2026

Rama `feature/hu-3-5-filtro-categoria`, base `develop` backend `46267e7c273d889a85710e33f32ff7a839f52ec9`. API autenticada `GET /api/places?categoria=...` por igualdad literal y catálogo `GET /api/places/categories` de categorías únicas activas ordenadas. Sin categoría/solo espacios se vuelve a la lista completa; sin coincidencias se devuelve 200 `[]`. Validación de parámetro único, hasta 80 caracteres Unicode, sin extras/arreglos/repetidos. DTO de lugares, esquema y dependencias no cambian.

- `npm test`: **68/68 aprobadas**, 0 fallidas/omitidas; nueve casos nuevos cubren autorización, catálogo/vacío, cambios/quitar filtro, caso sensible, DTO, validaciones, límite Unicode, SQL literal y errores públicos. Primer intento sin `.env` falló en la prueba de arranque preexistente por variables requeridas; se repitió correctamente con configuración ficticia de pruebas, sin conexión DB de esa suite.
- `npm run test:db:places`: **7 bloques PASS** en PostgreSQL local `crowdradar_hu31_test`. Conserva migración/centinela/restricciones/fixture de HU 3.1 y añade repositorio ORM real, catálogo único, filtro exacto/activo/orden/inyección, HTTP real con cambio/quitar/vacío y 400/401. Solo la consulta de sesión usa un doble porque `users` es una tabla centinela; no se afirma haber probado aquí autenticación contra PostgreSQL.
- Fixtures nuevos de HU 3.5 exclusivamente dentro de una transacción revertida; comparación posterior confirma filas de `places` y `users` conservadas. Sin acceso a la base de entrega/Supabase, sin borrados ni migraciones nuevas.

Recorrido con frontend compañero completado en IAB: build Web final de 99,0 s, login con autenticación/PostgreSQL reales en el entorno local, Parque → 1 marcador, Cultura → 1 marcador, quitar filtro → 3 marcadores y selección de lugar conservada. Detalle y captura en ESTADO_ACTUAL frontend; IAB no acredita Chrome normal.

Pendientes: revisión humana e integración autorizada; Android omitido por decisión del usuario. La evidencia anterior registra el estado previo a publicación, cuando no se hicieron commit/push/PR ni cambios en Issues/Project. Para la publicación posterior consultar Git y los PR. Las HU 3.2/3.3/3.4 están en ramas separadas: esta rama no las copia ni las sustituye; coordinar mapa, rutas y queries al integrar saturación, búsqueda, filtro y detalle, conservando cada incremento y repitiendo regresiones.

## HU 3.6 — filtro de saturación, 11/10/2026

Rama `feature/hu-3-6-filtro-saturacion`, padre HU 3.2 backend `0605b51fb5aa6933de9b587e9ad9c73f5e46c2d1`; frontend compañero parte de HU 3.2 `9c831decf868b856248db96dad8e8db8464207b8`. [Issue canónico frontend #7](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/issues/7). Registro previo a publicación: el PR dependiente apunta a `feature/hu-3-2-consulta-saturacion`; consultar sus SHA/par publicados. No hay merge ni cambios en Issues/Project/main/develop ni en los árboles originales con trabajo ajeno.

`GET /api/places?nivel=TRANQUILO|MODERADO|SATURADO`: autenticación antes de entrada/consulta, valores únicos canónicos y 400 público para entradas inválidas, no-store también en errores. Todos conserva el flujo y DTO existentes. El filtro hace una lectura batch parametrizada de lugares activos/últimos votos por persona, con reloj/snapshot común e IDs BIGSERIAL como texto; reutiliza exactamente `evaluateSaturation` y `saturationPolicy` de HU 3.2. Insuficiencia/empate quedan fuera; sin coincidencias, 200 vacío. No añade distancia/radio, registro de reportes ni reglas de confianza.

- Node 24.20.0: batería completa final `node --test --test-reporter=spec` (equivalente a `npm test`), 92/92 aprobadas, 0 fallidas/omitidas. Incluye 14 pruebas nuevas de filtros/HTTP/seguridad/SQL y regresión HU 3.2/auth. Configuración externa de prueba, sin `.env` ni correo.
- PostgreSQL 18 real, `npm run test:db:saturation-filter` (runner ejecutado directamente): cinco bloques aprobados en `crowdradar_auth_test` local ya preparada; esquema verificado sin migrar/DDL, SQL batch/reloj/último por persona/fecha-ID, tres niveles/empate/pocos/sin/vencidos/futuros/inactivos, HTTP/JWT real con estado/versión PostgreSQL, cambio de votos/filtro/Todos y rollback. Comparaciones de vacío restringidas a fixtures: no se afirma vacío global si hay otros lugares coincidentes.
- El runner comparó filas completas de users/places/saturation_reports e historial antes/después y conservó todo. No DELETE/DROP ni fixtures confirmados; secuencias pueden avanzar. Migraciones y `package-lock.json` sin cambios; no hay dependencias nuevas ni acceso a Sprint 1/Supabase.
- Integración Web IAB: Flutter Web final contra esta API en loopback:3006 y PostgreSQL real aislado, tres personas/cuatro lugares QA transaccionales. Login → cada nivel devuelve un marcador correspondiente → consulta individual HU 3.2 muestra el mismo nivel con tres personas → cambiar filtro retira selección anterior → actualizar conserva filtro → quitar recupera cuatro lugares incluido uno sin reportes → logout/login nuevo vuelve a Todos. Los reportes son ficticios, nunca aforo real ni datos confirmados. Solo se inyectó la transacción en modelos/repositorios reales; no respuestas HTTP prefabricadas. Carga/errores/vacío y races también se cubren automatizadamente, no se atribuyen al recorrido manual positivo.
- El proceso de pruebas y PostgreSQL se detuvieron antes del cierre interactivo; los datos transaccionales se revierten al cerrarse la conexión, no se atribuye a ese helper una comparación final que no ejecutó. La comprobación posterior de solo lectura en la base aislada no encontró usuarios/lugares/reportes QA Web y conservó las cuatro migraciones previas. No hay migración HU 3.6.
- Frontend compañero: análisis limpio, 350 pruebas aprobadas/0 fallidas/2 opt-in omitidas, build Web aprobado. Se corrigió un overflow reproducido en 360×360/texto2× antes de repetir suite/build; revisión independiente de lectura sin bloqueos. Evidencia en su ESTADO_ACTUAL.

Pendientes de integración: primero HU 3.2 y coordinación de su política provisional/almacenamiento HU 4.1; después el par HU 3.6 y reconciliar MapPage con los otros PR de lugares. «Cercanos» no tiene radio definido ni geolocalización en la base: requiere precisión del equipo si se espera un filtro de distancia. Android se pospone por decisión del usuario; no se declara Done ni revisión humana/merge por publicar PR.

## HU 3.2 — consulta local, 11/10/2026

Rama `feature/hu-3-2-consulta-saturacion`, base `develop` backend `46267e7c273d889a85710e33f32ff7a839f52ec9`. Registro de validación local previo a publicación: entonces sin staging/commit/push/PR ni modificación de Issues/Project/main/develop. Consultar Git/PR para la publicación posterior. No se declara integración o revisión humana completada.

GET protegido `/api/places/:id/saturation` permite consultar lugares activos con DTO explícito y no-store. Política provisional aprobada por el usuario, pendiente de acuerdo del equipo: al menos tres personas distintas en 30 minutos, último reporte por persona, nivel más votado, empate o insuficiencia sin nivel. Ventana inclusiva, sin futuros; misma fecha se desempata con mayor BIGSERIAL. `updatedAt` es el último voto contabilizado y no un tiempo de actualización automática. Sin reportes recientes devuelve 200 e información insuficiente; no mide aforo, calcula confianza ni inventa reportes.

Dependencia compartida: se copia **sin cambios** solo `src/database/migrateReports.js` de HU 4.1, commit `d49578cfdff7ef5bdc77c97c14207642715f41b1`, blob `da04019f28d6fbc4858cc53458ed09da2d9dd661`. Antes de integrar, coordinar almacenamiento con su autor y la política con el equipo. No se incorpora su POST/formulario de reportes. El comando explícito aplica `004-saturation-reports`; el arranque exige el esquema sin DDL. Su nombre no colisiona con la clave independiente `004-places-direccion`; no se reescribe ni renumera ninguna migración previa.

- Node 24.20.0: `npm test`, 78/78 aprobadas, 0 fallidas/omitidas. Incluye regresión y 19 comprobaciones nuevas de política/HTTP/migración. Primer intento sin `.env` ni variables se detuvo por configuración faltante en un test de arranque preexistente; repetido con configuración externa válida pasó, sin añadir `.env` al repo.
- PostgreSQL 18 real: `npm run test:db:saturation`, cinco bloques aprobados exclusivamente en `crowdradar_auth_test`: migración aditiva/idempotente con historial/filas conservadas; 0/1/2 insuficientes y tres personas; último por persona/tres niveles/empate/fecha-ID/vencidos/futuros/inactivos; HTTP real con todos niveles/insuficiencia/empate, DTO/no-store, 400/401/404 y middleware JWT con estado/versión persistidos; rollback total y preservación final.
- Ningún fixture de usuarios/lugares/reportes se confirmó, no se ejecutó DELETE/DROP ni se tocó Sprint 1/Supabase. Las secuencias PostgreSQL pueden avanzar por pruebas pese al rollback. Migraciones 001–003 y `package-lock.json` sin cambios; no hay paquetes nuevos.
- Sintaxis comprobada en 59 archivos JavaScript y `git diff --check` sin errores. El archivo compartido de migración coincide con el blob de origen; no se cambia el trabajo local HU 3.5 ni las ramas previas.
- Integración local por el agente principal: aplicó explícitamente `migrateReports` a `crowdradar_dev`, comparó usuarios/lugares/reportes e historial previos sin cambios y arrancó este backend en 3003 mediante `startServer` (sin SMTP). Login real y consulta de los tres lugares demo devuelven `reportCount: 0`, `level: null`, `reason: "INSUFFICIENT_REPORTS"`, sin cargar niveles falsos. La cuenta QA de ese recorrido se creó durante la comprobación separada HU 3.5; no procede del runner transaccional de saturación.
- Android omitido por decisión del usuario: no SDK/emulador/teléfono ni evidencia de funcionamiento Android. Recorrido frontend/integración Web se registra en el componente correspondiente; estas pruebas no lo sustituyen.

Pendientes: acuerdo/revisión humana de la regla provisional, coordinación de la dependencia HU 4.1 e integración del par. La publicación requiere autorización del usuario y no sustituye esas revisiones. El registro y validación/confianza de reportes pertenecen a otras HU; sin reportes válidos reales no habrá estimación suficiente.

## Correo SMTP (Brevo) para HU 2.1–2.2, 10/10/2026

Rama `feature/hu-2-1-correo-smtp`, padre C `9ee244eb7c94983cb951bfe06e723565c2e66b72`; frontend compañero `fix/web-referrer-mapa` desde C `652ea26`. Decisión del responsable del Sprint 2: primero Gmail; la cuenta del proyecto no permitió contraseñas de aplicación y se usa Brevo por SMTP, sin cambiar código (adaptador SMTP genérico). Se añade `nodemailer@10.0.10` (sin dependencias propias, sin avisos de `npm audit`; versión publicada el 14/09/2026, elegida por antigüedad frente a 10.0.16 de tres días). `SMTP_*` habilita el adaptador solo en `startServer`; sin ellas el 503 uniforme no cambia. Configuración incompleta/URL no confiable detiene el arranque con mensaje público; fallos de entrega registran solo el código. Contrato HTTP sin cambios.

- `npm test`: 58 aprobadas, 0 fallidas, también con el `.env` local con SMTP (7 nuevas: configuración, `.env.example` leído por dotenv, contenido/escape del correo, aviso sin enlace, log sin datos, arranque sin red). `node --check` de 52 JS y `git diff --check` correctos.
- Hallazgo corregido: `.env.example` (heredado de C) dejaba `PASSWORD_RESET_URL` sin comillas y dotenv la cortaba en `#`; con correo habilitado el arranque se detenía. Ahora va entre comillas y una prueba lo vigila.
- Hallazgo de entorno: `smtp-relay.brevo.com` presentó desde Perú un certificado solo válido para `*.sendinblue.com` (`ESOCKET`). Con `smtp-relay.sendinblue.com` (misma IP) TLS y autenticación verificadas sin desactivar comprobaciones.
- Recepción real 10/10: solicitud desde Flutter Web → 1 token emitido para la cuenta del responsable → correo «CrowdRadar: restablece tu contraseña» recibido en su bandeja de Gmail (remitente reescrito por Brevo a `brevosend.com`).
- `test:db:auth`, `test:db:recovery` y `test:db:places` aprobados en PostgreSQL 18 aislado de esta PC (Node 24.19.0). La comprobación de base limpia de auth solo corre al crear su base; ya existía en este rerun.
- `npm audit` total: 10 avisos preexistentes (1 crítico `proxy-addr`, 5 altos, 4 moderados), ninguno de `nodemailer`; sin corrección en este alcance.
- Recorrido Chrome 10/10 con el correo real: enlace → formulario → nueva contraseña → login con aviso «Contraseña restablecida» → mapa; el mismo enlace reabierto muestra «El enlace no es válido o ha expirado» sin formulario.
- Aviso «CrowdRadar: tu contraseña fue cambiada» recibido tras el restablecimiento.
- Correcciones de la revisión de Rael (10/10): con host Brevo/Sendinblue, `MAIL_FROM` ausente o vacío detiene el arranque con `CONFIG_INVALID` (otros proveedores conservan el remitente por defecto); README y CONFIGURACION_LOCAL reflejan que HU 3.1 y A/B/C ya están en `develop` y que el correo (#31) y el mapa (#14) siguen en revisión. `npm test` 59/59, `test:db:recovery` 6/6, `git diff --check` correcto.
- **Pendiente:** recorrido Android; revisión e integración de la cadena. HU 2.1–2.2 no se declaran terminadas hasta entonces.

## Hito C — HU 2.1–2.2, avance verificable, 08/10/2026

Rama `feature/hu-2-1-2-recuperacion`, padre B backend `97e607ed22b48561bed30a4e821099f76360210d`; frontend compañero parte de B `1e62c754682f3abe2b166b178d44b7e6e7d1fad0`. HU 3.1/PR #26 y #9 continúan abiertos en borrador; las bases no están integradas. No se abrió otro PR ni se modificaron main/develop, Issues o Project.

Solicitud uniforme → enlace validado antes del formulario → restablecimiento de un solo uso → login nuevo. Token aleatorio de 32 bytes, solo SHA-256 en PostgreSQL, 15 minutos de vigencia; consumo condicionado a expiración/uso después de esperar el lock del usuario. Hash, consumo e incremento de versión de sesión se confirman juntos. Nueva solicitud y cambio autenticado invalidan enlaces anteriores. Límites persistentes por IP/correo, URL confiable y errores públicos sin secretos. El criterio uniforme sustituye por autorización el criterio de enumeración heredado del Issue #3, que no se editó. Ver contrato para códigos/umbrales y límites de temporización.

**Correo real pendiente por decisión del usuario:** no hay proveedor, remitente ni adaptador configurados. El servidor normal devuelve 503 `RECOVERY_UNAVAILABLE` antes del lookup/generación; no afirma envío exitoso. El transporte en memoria existe exclusivamente en pruebas. HU 2.1 y Sprint 2 no están terminados; publicación tampoco equivale a revisión/integración.

- `npm test`: 51 comprobaciones aprobadas, 0 fallidas/omitidas (50 casos y la carga del helper de pruebas). Sintaxis de 49 JS y `git diff --check` correctos. Sin dependencias ni lockfiles modificados.
- `npm run test:db:auth`: regresión aprobada en `crowdradar_auth_test`; migración aditiva, concurrencia 200/401, JWT anterior rechazado y rollback. El primer ensayo B de base vacía está registrado abajo; este rerun conserva la base ya existente.
- `npm run test:db:recovery`: seis bloques aprobados en PostgreSQL 18 aislado. 003 aditiva/idempotente conserva usuarios; validación no consume; dos resets simultáneos dan 200/400; JWT viejo401/login nuevo200; renovación/cambio invalidan enlaces; validaciones y fallo posterior al UPDATE revierten hash/versión/token; expiración durante espera de lock se rechaza. Límites email3/solicitudIP10/resetIP30 persisten entre instancias; correo ambiguo no selecciona otra cuenta. No se borraron bases ni tablas.
- `npm run test:db:places`: cuatro comprobaciones de regresión aprobadas, exclusivamente `crowdradar_hu31_test`.
- `003-password-recovery` aplicada explícitamente a `crowdradar_dev`: comparación JSON de todos los campos/filas confirma sus cinco usuarios intactos. Segunda ejecución y `npm run db:migrate` sin cambios. Servidor real iniciado en3000; GET `/`200. Solicitud con correo existente/inexistente: mismo503/cuerpo y ningún token creado; validación inválida400. Sin conexión a entrega Sprint1/Supabase ni DDL al arrancar.
- Integración frontend opt-in C: 1/1, widgets VM + HTTP real en127.0.0.1:3031 + `crowdradar_auth_test`; correo/enlace/aviso solo en RAM. Comprueba solicitud, enlace GoRouter, espera de validación antes de campos, reset/cierre, JWT viejo401, contraseña vieja rechazada/nueva válida/perfil y enlace usado inválido sin formulario. Puerto3031 cerrado al terminar. Regresión opt-in B: 1/1 contra3000/`crowdradar_dev`; cuentas QA aleatorias sin credenciales publicadas.
- Frontend final: análisis limpio, 226 aprobadas/2 omitidas opt-in/0 fallidas; build Web63,8s y APK debug33,9s correctos. No acredita Chrome/Android manual ni recepción de correo.

Para repetir QA, ejecutar secuencialmente los runners DB y luego los comandos opt-in en ESTADO_ACTUAL frontend; no correrlos en paralelo durante comparaciones de preservación. Retención de tokens/límites, entrega durable/reintentos, observación sin secretos y pruebas bajo carga quedan pendientes antes de producción. El piso temporal común mitiga diferencias, no certifica tiempos indistinguibles. Se respetó la detención de seguridad del control de Chrome: recorrido manual final Chrome/IAB/Android y enlaces nativos pendientes.

## Hito B — HU 2.3, 08/10/2026

Rama dependiente `feature/hu-2-3-cambio-password`, padre HU 3.1 `c2aa7c0a098e2b4a26557edf1170e3cb1582696b` (PR #26 pendiente). Frontend compañero parte del hito A `0361ae13017def4d9c135a78b3b95ab1f07bf635`. Sin integración en develop/main.

Cambio autenticado con contraseña actual/nueva/confirmación, bcrypt 8 caracteres Unicode/72 bytes UTF-8, rechazo de reutilización. La actualización transaccional bloquea el usuario y aumenta `sessionVersion`; JWT anteriores (también legacy sin claim) se rechazan. El cierre local HU 2.4 sigue sin revocar por sí mismo.

Migración explícita `002-users-session-version`: esquema users baseline en DB nueva, columna aditiva en la existente, historial/idempotencia. Ya no hay User.sync ni DDL al arrancar; falta de migración impide iniciar con instrucción pública. Ver configuración y contrato.

- `npm test`: 36 aprobadas, 0 fallidas. Primer intento restringido bloqueó loopback; la ejecución real detectó un nombre local que sombreaba el validador (TDZ), corregido y reejecutado. Regresión PostgreSQL lugares: cuatro comprobaciones aprobadas; sintaxis de 40 JS y diff correctos.
- `npm run test:db:auth`: PostgreSQL 18 real, exclusivamente `crowdradar_auth_test`; base limpia, actualización/preservación e idempotencia, CHECK negativo, arranque sin DDL, dos cambios concurrentes (200/401), hash/version persistidos, JWT anterior rechazado, nuevo login y rollback tras fallo posterior al UPDATE.
- Aplicación a `crowdradar_dev`: sus 4 usuarios previos conservaron todos los datos (comparación JSON excluyendo únicamente la nueva columna). Runner repetido sin cambios; servidor reiniciado en 3000. Ninguna conexión a Sprint 1 ni Supabase.

Integración opt-in `test/local_api_smoke_test.dart` frontend: 1/1 con widgets VM y HTTP real contra este servidor/crowdradar_dev. Registro/login/perfil → formulario → actual incorrecta → éxito → cierre/aviso → ruta protegida bloqueada; JWT viejo 401 y login nuevo correcto. No es navegador ni Android. La cuenta QA queda identificable y sus credenciales aleatorias solo vivieron en memoria.

Recorrido manual Chrome/Android pendiente; los registros siguientes son históricos y no describen la política de sesiones nueva.

## Registro histórico — cierre local HU 3.1 / Web, 07/10/2026

Fotografía de la validación local del 07/10/2026, anterior a su publicación: ambos repositorios estaban en `feature/hu-3-1-mapa-lugares`, sin staging/commit/publicación. Bases conservadas en esa revisión: backend `a6da9a72e736bcb18568533a4ec7bf7aa4daa3f3`, frontend `f214886d7a40aabfc3b10b0af1a266128cc421fe`. No se tocaron main, upstream, Issues ni Project durante esa validación. Para conocer la publicación/integración posterior, comprobar Git y los PR relacionados; los resultados siguientes conservan su fecha y alcance.

## Verificación final de este cierre

- PostgreSQL 18 activo. `.env` ignorado apunta a `crowdradar_dev`, localhost:5432; no se imprimieron credenciales. Sin conexión a Supabase ni a `crowdradar_sprint1`.
- **Migración explícita**: `npm run db:migrate` → `001-create-places ya aplicada; sin cambios.` El arranque solo autentica y conserva `User.sync()`; nunca ejecuta la migración de `places`. Fixtures restringidos a las dos bases locales; migración portable con barreras para entrega/sistema/Supabase.
- `npm test`: **24 aprobadas, 0 fallidas, 0 omitidas**, código 0. `npm run test:db:places`: 4 comprobaciones aprobadas (idempotencia/preservación, cuatro rechazos SQL con rollback, fixture repetible, exclusión de inactivos). `node --check`: **35 JS** correctos. `git diff --check`: código 0; solo avisos de normalización LF/CRLF.
- Backend real reiniciado tras la caída controlada, puerto 3000; `GET /` → 200 `{"message":"CrowdRadar API"}`. Migración y fixture demostrativo repetidos sin duplicación.
- Cuenta desechable **Rael Chang** registrada desde Flutter Web, correo QA único y contraseña aleatoria solo en memoria de la prueba. SQL confirmó `current_database() = crowdradar_dev`, nombre/apellido, distrito, teléfono de 9 dígitos y bcrypt (sin imprimir hash). Los 3 lugares activos son demostrativos.
- Web real: registro, duplicado, validaciones, login, contraseña incorrecta, mapa/selección, cierre/guardas y backend apagado comprobados en navegador integrado. `flutter run -d chrome` lanzó Chrome normal, pero el recorrido interactivo de ese Chrome no pudo completarse con el control disponible: **no equiparar la prueba IAB a una prueba manual en Chrome normal**. Detalle/capturas en ESTADO_ACTUAL del frontend.
- Frontend final: análisis sin problemas, **69/69 pruebas**, build Web correcto (`58,7 s`, código 0), sin nuevas dependencias. Android anterior del día se conserva como evidencia histórica; no se repitió tras las últimas mejoras de login/registro.

Configuración DB por variables/URL, TLS verificado y CORS explícito se cubren con dobles y CORS local; no se validó despliegue remoto. El fixture opcional de usuario no tiene contraseña predeterminada y no se ejecutó con una credencial demo persistida: la cuenta manual se creó por la interfaz. Solo el registro añade una validación pequeña del límite bcrypt de 72 bytes; recuperación/cambio de contraseña no se implementaron.

Pendientes: revisión/publicación autorizada de HU 3.1, recorrido Chrome de otro integrante, clonación limpia del incremento (todavía no publicado), migración `users`, E2E automático integral y fuente canónica. No se declaran HU 2.1–2.3, HU 3.2 ni HU 3.3 terminadas. Los registros siguientes son históricos del estado de cada ejecución, no instrucciones vigentes; README/CONFIGURACION controlan la ejecución actual.

## Inventario final para revisión (sin staging)

28 archivos: 9 modificados y 19 nuevos. Incluye trabajo local anterior conservado. Salida de `git status --porcelain=v1 --untracked-files=all` desde la raíz backend:

```text
 M .env.example
 M README.md
 M app.js
 M docs/CONFIGURACION_LOCAL.md
 M docs/ESTADO_ACTUAL.md
 M docs/PLAN_TECNICO_SW2.md
 M package.json
 M src/config/database.js
 M src/services/AuthService.js
?? scripts/migrate.js
?? scripts/seed-demo-user.js
?? scripts/seed-places-demo.js
?? scripts/verify-places-db.js
?? src/config/environment.js
?? src/controllers/PlaceController.js
?? src/database/databaseSafety.js
?? src/database/migratePlaces.js
?? src/database/seedDemoUser.js
?? src/database/seedPlacesDemo.js
?? src/models/Place.js
?? src/repositories/PlaceRepository.js
?? src/routes/place.routes.js
?? src/services/PlaceService.js
?? test/database-lifecycle.test.js
?? test/demo-user.test.js
?? test/environment.test.js
?? test/password-boundary.test.js
?? test/places.test.js
```

Revisión: `.env` no rastreado e ignorado, node_modules ignorado, sin asignaciones locales de contraseña/JWT detectadas en textos ni candidatos generados o mayores de 5 MB. `package-lock.json` y `entrega/` sin diferencias. Solo se añadieron comandos en package.json, no dependencias. `HEAD = develop = origin/develop`, diferencia `0 0` en referencias locales; los cambios están en archivos. `origin/main` conserva `1130a900d1e02c390c3acf5a8c3964077a44a34d`. La rama local main preexistente apunta a `828a6aaadb2ec52ea57855c3aeffe8b4f27f6e72`/upstream/main, no a la entrega: se informó, no se corrigió ni tocó fuera de alcance. Origin sigue siendo Rael, upstream Walturx; no hubo operaciones remotas de escritura.

## Registro inicial HU 3.1 — 07/10/2026

Rama `feature/hu-3-1-mapa-lugares`, base `develop` / `a6da9a72e736bcb18568533a4ec7bf7aa4daa3f3`. Al comenzar, ambos repositorios estaban limpios y sincronizados después de `git fetch --no-tags origin`; frontend desde el merge HU 2.4 `f214886d7a40aabfc3b10b0af1a266128cc421fe`. No se crearon commits ni se publicaron cambios.

- `GET /api/places` usa el middleware JWT existente y la estructura controlador → servicio → repositorio → modelo. Lista solo activos, en orden de ID, con coordenadas finitas y dentro de rango. El error devuelve 503 sin detalles de DB.
- Se sustituyó la sincronización global por migración transaccional de `places` y el `User.sync()` histórico, sin `force` ni `alter`. Historial `crowdradar_migrations`, bloqueo transaccional para concurrencia y rechazo de tabla preexistente sin historial. Guardas explícitas impiden migrar fuera de las dos bases locales admitidas.
- Primero se probó en `crowdradar_hu31_test`: migración repetida sin cambios, historial único, estructura y contenido de `users` centinela conservados, cuatro rechazos SQL de rango/NaN/infinito (código PostgreSQL `23514`), fixture repetido sin duplicados y exclusión de inactivos. No se borraron tablas ni bases.
- Después se aplicó a `crowdradar_dev`. Una comparación SHA-256 de filas y columnas antes/después confirmó `users` intacta (2 usuarios). Se cargaron explícitamente tres lugares con `demostrativo=true`. No se conectó a `crowdradar_sprint1` ni a Supabase.
- `npm test`: **12 pruebas, 12 aprobadas, 0 fallidas, 0 omitidas**. `node --check`: **27 archivos JS**, sin errores. `npm run test:db:places`, `db:migrate` repetido y `db:seed:demo` repetido: código 0. `git diff --check`: sin errores.
- Servidor real en puerto 3000: `GET /` 200; `/api/places` sin token 401; con JWT local 200 y los tres lugares. Login real desde Android y consulta del mapa funcionaron.

Android 16/API 36 compiló e instaló el frontend: login, mapa OpenStreetMap, tres marcadores, identificación breve, backend apagado con error comprensible y reintento correcto tras reiniciar. Evidencias locales en `CrowdRadar-FrontEnd/docs/evidencias/hu_3_1/2026_10_07` dentro de la carpeta general. La advertencia XML del SDK no impidió compilar.

Limitaciones: catálogo real pendiente; fixtures ilustrativos, sin saturación ni tiempo real. La migración cubre solo `places`, no resuelve la deuda de `users`. No hay despliegue, edición de lugares ni rollback destructivo. La base de prueba se conserva. Dependencias y `package-lock.json` sin cambios; `package.json` añade únicamente comandos. HU 3.2 y HU 3.3 no se implementaron ni se marcaron terminadas; Issues/Project no se modificaron.

## Registro histórico — 22/09/2026

Esta línea base se trabajó en `develop`. Los commits de entrega permanecen intactos en `main` y en el tag `sprint1-entrega-2026-09-22`. Los SDK se instalaron fuera de los repositorios. El `.env` local no se publica.

## Entorno

Windows 11 25H2 (build 26200.9457); Git 2.51.0.windows.1; Node 22.20.0; npm 10.9.3; PostgreSQL 18; Java 21.0.7; Flutter 3.41.9 estable; Dart 3.11.5; Android SDK Platform/Build-Tools 36.0.0; platform-tools/ADB 37.0.1; emulador 37.1.11.0, Android 16 API 36. Flutter 3.41.9 reproduce el hash de `.metadata` del frontend.

`flutter doctor -v` aprobó Flutter, Windows, Chrome, Visual Studio, dispositivo Android y red. Muestra una advertencia en Android por seis licencias **opcionales** (Google TV, XR, ARM DBT, SDK Preview, Glass y MIPS), no requeridas por la compilación realizada. Las licencias de Platform, Build-Tools, NDK y CMake usadas por el proyecto sí fueron aceptadas. El emulador inició y el APK se instaló.

## Validaciones y resultado real

| Área | Comprobación | Resultado |
| --- | --- | --- |
| Backend | `npm ci` | Correcto; 151 paquetes desde `package-lock.json`; lockfile sin cambios. |
| Backend | Clonación local limpia de `develop` | Sin `node_modules` ni `.env` al inicio; `npm ci` instaló 151 paquetes, `npm test` pasó 4/4 y el servidor arrancó con variables de entorno externas en el puerto 3001; `GET /` devolvió 200. La clonación temporal se eliminó tras la prueba. |
| Backend | `npm test` | 4 aprobadas, 0 fallidas. |
| Backend | `node --check` en 16 archivos JS | Sin errores sintácticos. |
| Backend | `npm audit` | 5 vulnerabilidades: 3 moderadas, 2 altas; paquetes señalados: `brace-expansion`, `fast-uri`, `qs`, `sequelize` y `uuid`. No se ejecutó `npm audit fix --force` ni se cambiaron dependencias. |
| PostgreSQL | `crowdradar_dev` | Base separada creada; `sequelize.sync()` creó `public.users`. `crowdradar_sprint1` conservó su registro previo (conteo: 1). No se tocó Supabase. |
| HTTP real | `GET /`; registro; login; perfil; actualización; perfil posterior | 200; 201; 200; 200; 200; 200 contra `crowdradar_dev`. Credenciales incorrectas: 401; actualización inválida: 400. |
| Frontend | `flutter pub get` | Correcto, `pubspec.lock` sin cambios. Hay 15 paquetes más nuevos incompatibles con las restricciones actuales; no se actualizaron. |
| Frontend | `flutter analyze` | Sin problemas. |
| Frontend | `flutter test` | 1 prueba aprobada. |
| Frontend | `flutter build apk --debug` | Correcto; APK debug de 162 915 859 bytes, generado en `build/app/outputs/flutter-apk/app-debug.apk` (ignorado por Git). |
| Android | Instalación y apertura en emulador | Correcto en Android 16 API 36, `emulator-5554`. |

Desde la interfaz Android se registró `androidbaseline20260922@example.com`, se inició sesión, se consultó el perfil y se actualizaron apellido, teléfono y distrito. Una consulta SQL posterior en `crowdradar_dev.public.users` confirmó `Rael | BaselineSW2 | 900000004 | Miraflores`. Son datos de prueba, no cuentas de producción. Capturas: [registro correcto](evidencias/android-register-result.png), [login correcto](evidencias/android-login-success.png), [perfil inicial](evidencias/android-profile.png), [perfil actualizado](evidencias/android-profile-updated.png).

Casos negativos verificados desde Android: [campos vacíos](evidencias/android-invalid-fields.png) muestran validaciones; [contraseña incorrecta](evidencias/android-wrong-login-result.png) muestra «Correo o contraseña incorrectos.»; con el backend apagado, [login](evidencias/android-backend-off.png) muestra un `ClientException with SocketException: Connection refused (OS Error: Connection refused, errno = 111)` hacia `10.0.2.2`. La app no se cierra, pero el mensaje de red es técnico y debe mejorar. Se reinició el backend y `GET /` volvió a responder 200.

## Hallazgos pendientes

- El esquema depende de `sequelize.sync()` en el arranque; no existen migraciones versionadas para cambios futuros.
- Las cinco alertas de `npm audit` requieren revisión selectiva y pruebas de regresión; una recomendación automática propone un cambio mayor incompatible de Sequelize, por eso no se aplicó.
- El token del frontend permanece en memoria; tras reiniciar la app se requiere login. No hay flujo de recuperación de sesión/expiración validado.
- El error por backend apagado se muestra como excepción técnica; el flujo principal no queda bloqueado.
- La compilación emite advertencias de AGP/SDK XML y APIs Gradle obsoletas; no impidieron el APK. En este equipo, el primer intento falló con `java.io.IOException: Unable to establish loopback connection` por la carpeta temporal de Windows. Se resolvió para la sesión de compilación usando una ruta TEMP/TMP corta, sin modificar el proyecto.
- No se realizó prueba en teléfono físico, APK release ni despliegue remoto.
