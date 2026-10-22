# Coordinación del equipo — CrowdRadar SW2

## Revisión vigente19/10 — consolidación Web R01/S3

Rama integration/cierre-web-r01-s03-20261019 en ambos repositorios, cuando esté publicada. [Entrada](INICIO_EQUIPO.md),[demo portátil](CATALOGO_DEMO_LOCAL.md),[evidencia/procedencia](CIERRE_WEB_R01_S03.md). Publicar una consolidación no fusiona develop ni cierra PR/HU; conservar revisión humana y par de commits. PR #27/#10 y los de Nick siguen intactos. Las notas08/10 inferiores describen su fecha, no vuelven ausentes funciones que hoy existen en el candidato.

Guía compartida de ambos repositorios, preparada el 07/10/2026 para siete integrantes activos. Es el acuerdo operativo propuesto para revisión del equipo. Preparar este archivo no crea Issues, asignaciones, protecciones ni automatizaciones remotas.

Para incorporarse sin historial de chats, empezar por [INICIO_EQUIPO.md](INICIO_EQUIPO.md). Esta guía mantiene el acuerdo operativo; el estado técnico y las tareas diarias conservan sus fuentes canónicas.

El 08/10 se autorizó publicar las guías y preparar los PR de la base del equipo. El par `integration/base-equipo` reúne HU 3.1/A/B/C ya publicados más documentación de inicio; sus PR en borrador a `develop` son una revisión consolidada del conjunto, no PR individuales de A/B/C ni un merge autorizado. Conservar los PR HU 3.1 anteriores sin ampliar sus ramas. Hasta que exista revisión humana, comprobación del par y aprobación de merge, esta instantánea sirve para incorporarse/revisar, no para sustituir la base diaria `develop`.

## Fuentes y documentos

Prioridad: código/Git/pruebas → Issues/Project → ESTADO_ACTUAL → PLAN_TECNICO → contexto maestro → chats. Un chat o una IA no sustituye una prueba. La instrucción actual del equipo controla cambios de alcance; se conserva la historia previa.

| Información | Fuente canónica | Cuándo se actualiza |
| --- | --- | --- |
| Reglas de cada repo | AGENTS.md | Cambio de regla estable acordado |
| Ejecución/configuración | README y CONFIGURACION_LOCAL | Cambia un paso, variable o requisito |
| Arquitectura del componente | docs/ARQUITECTURA.md de cada repo | Cambia una frontera o responsabilidad |
| API compartida | docs/CONTRATO_API.md en backend | Cambia ruta, JSON, validación o autenticación |
| Prioridades futuras | PLAN_TECNICO_SW2 | Se acuerda una prioridad; no implica compromiso |
| Estado técnico | ESTADO_ACTUAL de cada repo | Cambia un funcionamiento o bloqueo probado |
| Trabajo diario y criterios | Issue + Project | Avance, bloqueo, revisión o decisión |
| Cambio exacto y autor | Commits + PR | Cada incremento revisable |
| Evidencia de entrega | Registro/capturas fechados | Añadir evidencia; no reescribir entregas anteriores |

No duplicar el backlog completo en Markdown ni escribir un diario de cada instrucción dada a una IA. Basta poder recorrer **HU → PR → commits → pruebas/evidencia → resultado integrado**.

## Siete personas, una base compartida

Cada integrante clona ambos repositorios, trabaja en su PC y configura su PostgreSQL y secretos. Puede ponerlos en una carpeta padre CrowdRadar-SW2 y abrir esa carpeta con su IA. No compartir `.env`, contraseñas ni una base de desarrollo como sustituto de migraciones/fixtures. No hace falta copiar la carpeta de Rael por ZIP.

Las ramas `develop` son la base de trabajo, independientemente de quién escribió el último cambio o administra GitHub. Un avance solo local no se descarga; un avance publicado en una rama se puede revisar, pero todavía no pertenece a `develop` hasta integrar su PR.

### Dónde está «lo último de todos»

| Rama | Qué contiene | Uso |
| --- | --- | --- |
| `main` | Última entrega estable aprobada | Presentación/release; no trabajo diario |
| `develop` | Aportes revisados e integrados de todo el equipo | Base compartida para una tarea nueva |
| `feature/...`, `fix/...`, `docs/...` | Trabajo de una tarea, posiblemente pendiente | Desarrollo/revisión; no sustituye la base común |

Ejemplo: A implementa los pasos 1–3 y su PR se integra en `develop`. B actualiza desde ese `develop`, implementa el paso 4 y se integra su PR. C clona/actualiza `develop` y recibe los pasos 1–4, aunque Rael no haya hecho el paso 4. Si el PR de B sigue abierto, C recibe 1–3 en `develop`; puede consultar la rama de B para revisarla, sin confundirla con trabajo integrado.

Git combina cambios e historial, no reemplaza todo el proyecto por la carpeta de la última persona. Los cambios compatibles suelen combinarse automáticamente. Si dos personas cambian de forma incompatible la misma parte, hay un conflicto: los autores acuerdan el resultado, conservan lo necesario de ambos cambios y vuelven a probar antes de integrar. No gana automáticamente el administrador ni el último push.

Para un clon nuevo, elegir explícitamente `develop` en **ambos** repositorios; un clon sin `-b` puede abrir la rama predeterminada `main`:

```powershell
git clone -b develop https://github.com/raelchang03UL/CrowdRadar-Backend-SW2.git CrowdRadar-Backend
git clone -b develop https://github.com/raelchang03UL/CrowdRadar-FrontEnd-SW2.git CrowdRadar-FrontEnd
```

Para actualizar un clon existente, comprobar primero que está limpio y ejecutar en cada repositorio:

```powershell
git fetch origin
git switch develop
git pull --ff-only origin develop
```

No se borran cambios locales para ejecutar esta secuencia. Una rama de tarea que ya existe no se actualiza sola al actualizar `develop`; incorporar después sus cambios con coordinación y autorización, sin force push.

### Frontend y backend deben formar un par probado

Los dos repositorios tienen historias Git independientes; no hay un merge atómico conjunto. «Último frontend» y «último backend» no garantizan por sí solos compatibilidad. Antes de declarar una base lista, registrar en el PR/Issue de integración **SHA backend + SHA frontend + pruebas/recorrido + pendientes**. Si cambia cualquiera, validar de nuevo lo afectado. No copiar una lista paralela de versiones en todos los README.

Para HU 3.1, la publicación y los PR en borrador no autorizan su merge. Mientras sigan sin integrar, clonar `develop` recibe la base anterior. El 08/10 se publicaron incrementos dependientes: pulido visual A (frontend `0361ae1`), HU 2.3 B (backend `97e607e`, frontend `1e62c75`) y recuperación C (backend `9ee244e`, frontend `652ea26`) desde B. El par C está en `feature/hu-2-1-2-recuperacion`, con envío real pendiente. Sus ramas no añaden alcance a los PR HU 3.1. Descargar explícitamente el par de ramas para revisión, sin confundirlo con integración. No abrir sus PR a develop hasta integrar sus bases, ni reescribir historial para ocultar dependencias.

Una tarea tiene un responsable humano y un revisor distinto. Los demás pueden colaborar en pruebas, UI o API con tareas delimitadas. Nadie aprueba automáticamente el código de su propia IA. Los roles rotan: no dejar a una persona permanentemente solo con documentación.

La propuesta inicial A–G del 07/10 incluía implementar formularios y autenticación que ya avanzaron en A/B/C. No reutilizarla para asignar siete implementaciones nuevas de lo mismo. Comprobar los estados/PR actuales y elegir brechas reales; candidatos sin nombres, estimaciones ni compromiso automático:

| Paquete | Trabajo concreto | Dependencia/colisión que coordinar |
| --- | --- | --- |
| Reproducibilidad | Arrancar ambos clones en otra PC y registrar el par probado | Base elegida, PostgreSQL/secretos propios; no instalar SDK en Git |
| QA Web | Recorrido final de registro/login/perfil/mapa/cambio; anotar fallos | No presentar widgets VM como Chrome ni pruebas anteriores como actuales |
| QA Android | Repetir el recorrido final y precisar comportamiento de enlaces | Emulador/dispositivo y API correctos; enlaces nativos aún no verificados |
| Recuperación | Conectar y verificar entrega real sobre el núcleo C existente | Decisión de proveedor/remitente y autorización de configuración/gastos; no rehacer tokens |
| Casos negativos | Comprobar que peticiones alteradas no permiten otro usuario, token inválido/usado ni sesión revocada | Entorno local aislado, contrato vigente, datos controlados; no atacar servicios externos |
| Interfaz | Corregir problemas observables de accesibilidad/flujo tras QA | No rediseñar otra vez A ni editar tema/router/formularios en paralelo |
| CI e integración | Preparar checks reproducibles y revisar PR dependientes | Tarea aprobada separada; CI/protecciones aún no activas, merge requiere autorización |

El reparto exige ajuste: estos paquetes no tienen el mismo tamaño. Antes de asignar, acordar disponibilidad y estimar las historias con el equipo. Story Points estiman historias, no productividad individual; una historia compartida cuenta una sola vez. Para equilibrar personas se revisan tareas, esfuerzo acordado, QA, revisiones y bloqueos, sin fabricar puntos ni multiplicarlos por siete.

## Ciclo de una tarea

1. Elegir una HU/tarea aprobada, criterio demostrable, responsable, revisor y dependencias. Mantener alcance pequeño.
2. Con árbol limpio, actualizar `origin/develop` mediante fetch y pull `--ff-only`, y crear rama `feature/hu-X-Y-descripcion`, `fix/...` o `docs/...`.
3. Anunciar qué archivos compartidos se tocarán. Tema, router, autenticación, modelos, migraciones y lockfiles requieren coordinación; una persona modifica cada conjunto compartido a la vez.
4. Acordar contrato API antes de implementar ambos lados. Los cambios aditivos compatibles facilitan integrar backend primero.
5. Implementar, revisar diff, ejecutar pruebas pertinentes y actualizar solo documentos afectados.
6. Con autorización, crear commits pequeños de rutas explícitas, push a la rama de `origin` y PR a `develop`. Enlazar Issue y PR del otro repo.
7. Otro integrante revisa y prueba. Un PR aprobado puede seguir pendiente de integración; la HU padre solo termina cuando todos sus criterios están demostrados con ambos lados.
8. Registrar SHA backend/frontend y evidencia del recorrido final. Después, cada integrante actualiza su `develop` limpio antes de una tarea nueva.

No ejecutar un pull con trabajo local sin revisar. Si hay divergencia/conflicto, los autores acuerdan el resultado esperado; no resolver con `--ours`, `--theirs` o force sin entender qué se pierde. Un cambio de `develop` no actualiza automáticamente una rama ya abierta.

## Seguimiento y definición de terminado

Usar los estados existentes: Product Backlog → Sprint Backlog → In Progress → In Review → Done. Cada transición se basa en trabajo real; un merge no completa por sí solo una HU transversal. Mantener las automatizaciones actuales bajo revisión: cerrar un Issue antes de validar ambos lados puede moverlo a Done incorrectamente.

Actualización breve al terminar la sesión, en el Issue o durante la reunión: «Hecho / evidencia / bloqueo / siguiente paso». Esa es la monitorización del trabajo; no equivale a observabilidad de producción. No hay un servicio de seguimiento automático configurado por esta guía.

Una HU está terminada cuando cumple criterios aprobados, tiene pruebas apropiadas y recorrido de integración, no incluye secretos/generados, actualiza documentación afectada, recibe revisión humana y sus PR necesarios están integrados en `develop`. Guardar pendientes fuera de la HU solo si no impiden sus criterios. Un proveedor de email simulado no demuestra envío real.

## CI y protecciones propuestas

En ambos repositorios, la auditoría local del 07/10/2026 no encontró `.github/workflows`. Las plantillas PR preparadas no ejecutan tests. No se verificaron ni cambiaron reglas remotas de protección en esta tarea.

Próxima tarea propuesta: CI backend con versión Node fijada, instalación desde lockfile, tests y PostgreSQL de prueba; CI frontend con Flutter 3.41.9, dependencias bloqueadas, análisis, tests y build web. Construcción Android si cambia lo relevante. Usar base efímera, valores exclusivamente de prueba y permisos mínimos. Registrar el par de repos/commits en integración; checks separados no demuestran automáticamente compatibilidad cruzada.

Tras su primera ejecución correcta, proponer protección de `main`/`develop`: PR obligatorio, al menos una revisión ajena y checks requeridos existentes; impedir force push/eliminación. El administrador debe aprobar los cambios remotos. No exigir un check que aún no existe ni afirmar que una plantilla aplica protección.

Referencias: [colaboración mediante PR](https://docs.github.com/en/pull-requests/reference/pull-requests), [ramas protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## Prompt de inicio para cualquier IA del equipo

> Trabaja en mi clon local de CrowdRadar. Lee AGENTS.md y CONTRIBUTING.md de ambos repositorios, sus guías de arquitectura/estado y el contrato canónico del backend. Si existe el contexto maestro en la carpeta padre, léelo como contexto, no como verdad absoluta. Mi tarea aprobada es [Issue/URL y alcance]; mi rama es [rama]. Primero confirma HEAD, rama, remotos, cambios ajenos, criterios y archivos compartidos. Implementa solo esta tarea con la arquitectura/guía visual existente; acuerda cualquier cambio de API con el otro componente. Ejecuta pruebas pertinentes y registra resultados reales, pendientes y archivos cambiados. No reveles secretos ni sobrescribas trabajo ajeno. Actualiza solo documentación afectada. No publiques, hagas merge ni modifiques el backlog sin la autorización explícita que te indique. Si encuentras un cambio de contrato, conflicto o dependencia que altere el alcance, presenta la decisión concreta antes de seguir con esa parte.
