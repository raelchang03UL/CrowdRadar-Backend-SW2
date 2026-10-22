# Cierre Web R01/S3 — evidencia para revisión

## Corrección solicitada por N1c19 — 21/10/2026

Sobre backend `317caaf7eca2835835fd06673456fa4388530dc7`, el runner `scripts/serve-consolidation-qa.js` mantiene explícitamente vacías las seis variables SMTP/recuperación. Los imports posteriores y `dotenv.config()` no pueden restaurarlas desde `.env`. No cambia el adaptador SMTP de producción, las guardas de base ni el entorno privado.

Regresión reproducible: `node --test test/qa-smtp-isolation.test.js`. Ejecuta runner, configuración y arranque reales en un subproceso con `.env` sintético completo, solo host y solo remitente; sustituye únicamente DB, escucha HTTP y transporte SMTP. Antes del arreglo: **0/3**, un transporte construido en el caso completo y `CONFIG_INVALID` en ambos parciales. Después: **3/3**, cero transportes/correos, dos cargas reales de dotenv por caso, seis valores vacíos y arranque alcanzado. El entorno de la prueba se aísla y restaura; no se conecta a PostgreSQL ni se envía correo real.

Validación funcional final: `npm test` **180/180**, cero fallos/omitidas; `node --check` del runner y del test, y `git diff --check`, correctos. El intento restringido previo falló por fetch/EACCES; el resultado aprobado corresponde a la ejecución local autorizada. No se repitió QA SQL, no cambiaron esquema/reglas y no se instalaron dependencias. [Frontend compañero y par exacto publicado](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/pull/21); los SHA finales y resultados se registran en las conversaciones de revisión de ambos PR, sin referencia circular en el documento.

Esta corrección no descarta el **Changes requested** de [B#39](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/39): falta la revisión de Nick sobre los nuevos heads antes de cualquier merge. Los resultados inferiores son históricos, no pruebas repetidas del nuevo par.

## Aceptación Web y puerta de integración — 20/10/2026

Par funcional probado: backend `5d467ca66adb7a9dc26d2d0e13b87c957258e69d` y frontend `1ef1b9b7312bd8d57d508c10888427bb2cb1d005`. Documentación posterior sin cambios funcionales. Par publicado exacto en [B#39](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/39) y [F#21](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/pull/21); integración condicionada a revisión ajena vigente.

| Comprobación nueva | Resultado / alcance |
| --- | --- |
| Node / sintaxis / diff |177/177;96JS correctos;diff-check correcto |
| PostgreSQL R01 |6/6bloques fresh+legacy:esquema,compatibilidad,preservación,idempotencia/concurrencia,autorización,filtros,premio atómico/rollback |
| PostgreSQL S3 |7/7fresh+7/7legacy:4personas,voto/denuncia únicos,peso congelado,72bloques Lima/comparación/horarios/vacíos |
| PostgreSQL recuperación |6bloques:inválido/vencido/usado,validación sin consumo,concurrencia,rollback,JWTviejo rechazado,login nuevo,límites persistentes |
| Flutter general |562aprobadas;2opt-in excluidas por defecto y ejecutadas aparte;0fallidas |
| Opt-in cambio / recuperación |1/1cadauna,widgetsVM+HTTP/PostgreSQL real;API3053 yrecoveryIPC3031;correoRAM |
| Analyze / Web |Sin problemas;buildWeb58s/API3053,dependencias existentes |
| Audit |10paquetes:1crítico,5altos,4moderados;incluye producción,sin fix/instalación;no aprobación para Internet |

Se crearon solo `crowdradar_cierre_fresh_20261019` y `crowdradar_cierre_legacy_20261019`, ambas ausentes antes de crear cualquiera. Perfil explícito y procedencia `CrowdRadar/SW2/cierre-20261019/v1`;no adopción/borrado ni migraciones/fixtures en sistema. [Procedimiento](CONFIGURACION_LOCAL.md#qa-de-aceptación-web--20102026). SMTP deshabilitado;contraseñas,tokens y enlaceIPC solo en memoria.

Un primer smoke opt-in falló esperando un título del perfil fuera del viewport. Solo se ajustó la espera a la identidadQA y scroll a la acción, conservando aserciones de errores,cambio,logout,rutas yJWT;repetición1/1. Intento restringido de npmtest falló fetch/EACCES;ejecución local autorizada177/177. No repetir batería por documentación ni ocultar los diagnósticos.

Recorrido real Web5553/API3053:alta/login,búsqueda/selecciónQAParque,reporte+10,historial→perfil y ciclo inverso,voto ajeno definitivo,denuncia persistida sin ocultar,estado actualizado,historia12–14oct(6bloques suficientes),comparación,horario10:00/3días,logout y rutas protegidas. SELECT final de solo lectura en la base identificada confirmó cuenta sintética18:1reporte/1premio/10puntos/1voto/1denuncia. [Capturas frontend](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/blob/integration/cierre-web-r01-s03-20261019/docs/CIERRE_WEB_R01_S03.md). Carreras200/401tardías corresponden a widgets/dobles;datos sintéticos,no negocio real.

Correo: [recepción Diego16/10](../entrega/EVIDENCIAS_SPRINT_2.md), parB`46267e7`/F`dfdb753`. Servicio,adaptador,repositorio/configuración/controlador/rutas de correo sin cambios desde ese backend. Evidencia histórica aplicable,no envío nuevo ni prueba serverless. No se reimplementóSMTP.

Aceptación:7HUcerradas conservan su historial;HU3.1se cierra por el par original integradoB#26/F#9,aprobado porDiego. Otras16HUen revisión:PR39/21necesitan revisión ajena,merge ysmoke develop. Rael aprobó dirección ausente explícitaHU3.3 y«cercanos»como catálogo disponible sinGPS/radioHU3.5/3.6;ya no son bloqueos de producto. HU1.1/2.1uniformes ratificadas;HU4.1no exigecontador restante. #28concluye la revisión con dictamen de no aceptación global;no se marcan desgloses históricos por inferencia.

Contribuciones conservadas:Diego autenticación/SMTP;Nick lugares/consultas/filtros;Manu reporte/karma/historial;Rael HU5–6,conciliación,guardasQA,I1/I2/C2/F11/verificación. Integrar no atribuye código ajeno;StoryPoints no son cuota/autoría. Androidfinal,Chrome normal,manual200%/lector no ejecutados;aceptación de este encargo Web. HU7/8,Favoritos y nube sin implementar. Plan nube separado en ARQUITECTURA/CONFIGURACION_LOCAL/PLAN_TECNICO.

## Cierre publicado anterior — 19/10/2026

19/10/2026, America/Lima. Rama de ambos repositorios: `integration/cierre-web-r01-s03-20261019`. Esta página describe contenido/pruebas; existencia remota y **par exacto final** se acreditan en los cuerpos de sus PR. No implica merge en develop, aceptación de HU/Release/Sprint ni despliegue.

## Procedencia e identidad

- Base develop comprobada: backend `ffe9b19865c4952d5cb87a34f38fa71331197155`,frontend `dfdb75371d9c3a8ecdb7bc79cf8346988659f0ba`; ambas son ancestros. Candidatos iniciales B`eeff38b86c53d22180655ee5aa6fa501a2a5b061`/F`18cec26d0f2da755b9e436f04b715f431f54563d`,29/26commits sobre esas bases, más archivos pendientes F3/C2. Se preservan commits/autores, sin rebase/cherry-picks de reconstrucción.
- Nick:backend PR[33](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/33)/[34](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/34)/[35](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/35)/[36](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/36)/[37](https://github.com/raelchang03UL/CrowdRadar-Backend-SW2/pull/37),frontend[16–20](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/pulls). Detalle→búsqueda y saturación→filtro conservan sus dependencias. Sus heads están en la ascendencia de la consolidación, no se cierran/fusionan esos PR automáticamente.
- Manu:backend `d49578c`,`b109ca8`,`1595d36`;frontend `5791c59`,`218a35d`,`26eb200`,`5f09315` en la ascendencia, conservando ramas independientes y autores. Conciliaciones locales posteriores explicitan esquema/premio/errores; no atribuir todos los commits a Rael.
- Diego:autenticación/SMTP/mapa ya incluidos en develop;B#31/#32/#38 yF#14/#15 son antecedentes integrados, no PR nuevos de este cierre. Adapter SMTP conservado, no sustituido.
- Base-equipo B#27/F#10 también está incorporada como antecedente. No se cambia su estado ni el de Issues/Project; usar Refs, no Closes/Fixes.

## Contenido revisable

HU1–2 autenticación/perfil/recuperación/cambio;HU3detalle,búsqueda,categoría,saturación/filtro;HU4reportes/karma/historial propio;HU5validación/confiabilidad/estado/denuncia;HU6historial/comparación/horarios. Políticas provisionales aprobadas según CONTRATO_API; no nuevas reglas por este cierre.

Pendientes previos guardados:tests reproducibles backend;I1sesión vigente/antigua;I2resultado confirmado/cooldown/incertidumbre sin reenvío;I3/C2mapa,catálogo y perfil. F11 mínimo:solo ignorar índice activo si ya coincide la ruta real. No router nuevo,experimento visual,Favoritos,HU7/8,cloud ni dependencias nuevas.

Demo:cinco lugares reales y observaciones **sintéticas**, sin monitoreo. CLI check/migrate/seed/serve limitada a crowdradar_demo_local+localhost+procedencia; inicialización administrativa manual, no ejecutada de nuevo. Ya no conecta a QA ni crea/adopta bases. Migraciones001–007 y todas las protecciones históricas conservadas. [Procedimiento completo/fuentes](CATALOGO_DEMO_LOCAL.md).

## Validación final

| Tipo | Resultado |
| --- | --- |
| Node22.20/npm10.9,npm test |173/173,0fallidas/omitidas;HTTP loopback/dobles, no runner SQL completo |
| Sintaxis |95JS correctos |
| npm audit sin fix |10paquetes:1crítico,5altos,4moderados; ver interpretación inferior |
| Flutter3.41.9/Dart3.11.5 |analyze0problemas;562aprobadas/2opt-in omitidas/0fallidas;Web31,2s |
| F11 rojo→verde |1aprobada/6fallidas antes;7/7después. Incluye200/401tardíos,logout y rutas |
| Demo PostgreSQL real |check/seed0nuevos/5existentes;guardas sin ampliar;cuenta sintética2:0reportes/0premios/0puntos→1/1/10 |
| Navegador IAB final |alta/login,buscar/seleccionar,plegar/Enter,reporte+10,historial→perfil,ciclo perfil/historial,mapa,logout/rutas |
| diff-check |correcto en ambos repositorios |

SQL de solo lectura confirmó los totales previos2reportes/2premios/20puntos y posteriores3/3/30; los anteriores se conservaron. No se inventaron estadísticas ni se envió correo real. Seed idempotente/concurrente/conflicto se probó en PostgreSQL en el corte C2; pruebas nuevas35 de demo usan dobles, no atribuirles ese SQL.

Build final `main.dart.js` SHA256:`4ae6c604b64025361b874ffe9504ff8438b39c99cf8c119b8ffd622e8ccc4fc8`. Salida relativa falló al escribir shaders; se repitió solo build con ruta absoluta nueva, sin modificar código. Las pruebas finales representan el contenido funcional; cambios documentales posteriores no alteran ese contenido.

Evidencia SQL/resultados ligera en [resumen](evidencias/cierre_web_2026_10_19/resumen.json). Capturas y comparaciones depuradas en el [repositorio frontend](https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2/blob/integration/cierre-web-r01-s03-20261019/docs/CIERRE_WEB_R01_S03.md). No se requieren snapshots tmp ni credenciales de Rael.

### Avisos npm: publicación de revisión no es exposición pública

Proxy-addr aparece crítico(transitivo);fast-uri,brace-expansion,braces,chokidar,nodemon altos;moment,qs,sequelize,uuid moderados. Hay rutas de desarrollo y de producción: no reducirlo a “solo dev”. El aviso del árbol no demuestra explotación de nuestras rutas, ni las pruebas descartan esos avisos. No se aplicó audit fix ni degradaciones mayores sugeridas por metadata. Revisar/actualizar con alcance autorizado antes de Internet; no se desplegó ni se relajaron TLS/CORS/guardas.

## Pendientes de aceptación, separados

Las2opt-in(local_api_smoke/local_recovery_api),QA Release01 desde cero segura,SMTP/recepción real autorizados,Android/Chrome normal/lector/manual200%,criterios/catálogo y revisión humana. Publicación de rama para revisión no los convierte en pruebas aprobadas ni en bloqueo automático de PR. Modelo y UML editable en modelos/consolidacion.puml siguen vigentes; no entidades nuevas.

Siguiente decisión humana:revisar ambos PR y autorizar o rechazar su integración compatible a develop. No merge,Issue cerrado,Project cambiado ni aceptación de R01/S3 por este documento.
