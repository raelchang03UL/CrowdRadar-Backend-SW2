# Coordinación del equipo — CrowdRadar SW2

Guía compartida de ambos repositorios, preparada el 07/10/2026 para siete integrantes activos. Es el acuerdo operativo propuesto para revisión del equipo. Preparar este archivo no crea Issues, asignaciones, protecciones ni automatizaciones remotas.

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

Para este incremento HU 3.1, la publicación de las ramas y la apertura de PR en borrador no autorizan su merge. Mientras sigan sin integrar, los compañeros que clonen `develop` reciben la base anterior; para revisar HU 3.1 deben descargar las ramas indicadas en los dos PR. La guía visual es una propuesta, no un rediseño ya implementado.

Una tarea tiene un responsable humano y un revisor distinto. Los demás pueden colaborar en pruebas, UI o API con tareas delimitadas. Nadie aprueba automáticamente el código de su propia IA. Los roles rotan: no dejar a una persona permanentemente solo con documentación.

Propuesta para distribuir trabajo, todavía sin nombres ni compromiso:

| Paquete | Trabajo concreto | Dependencia/colisión que coordinar |
| --- | --- | --- |
| A | Backend solicitar/restablecer HU 2.1–2.2 | Contrato, esquema, envío y sesiones |
| B | Frontend solicitar/restablecer HU 2.1–2.2 | Contrato de A; puede usar dobles mientras se integra |
| C | Backend cambiar contraseña HU 2.3 | Espera el esquema/política de A; no editar auth a la vez |
| D | Frontend cambiar contraseña HU 2.3 | Contrato de C; coordina router/perfil con B |
| E | Pruebas de integración y casos negativos | Participa desde el contrato; verifica el par final |
| F | Pulido visual sobrio de autenticación/perfil | Tokens compartidos; no editar los formularios de B/D a la vez |
| G | Reproducibilidad/CI y revisión de integración | Migra/testea en base aislada; no cambia el modelo a la vez que A |

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
