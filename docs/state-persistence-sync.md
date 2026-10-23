# Estado, persistencia y sincronizacion

El estado de aplicacion se centraliza en `ExpenseStoreProvider`. Las pantallas
interactivas usan `useExpenseStore` para leer datos, ejecutar comandos y conocer
el estado de sync.

## Provider global

`ExpenseStoreProvider` vive en el `RootLayout`, por lo que dashboard, money,
settings y detail comparten una unica instancia del store.

El hook expone:

- `store`: datos normalizados de la app.
- Comandos de gastos: add, delete, clear, toggle paid, skip, move occurrence y
  move series.
- Comandos financieros: salario, objetivo de ahorro, aportacion real, ingresos
  y overrides mensuales.
- Comandos de preferencias: tema e idioma.
- Estado de sync: `syncStatus`, `syncMessage`, `isHydrated`.

`useExpenseStore` falla explicitamente si se llama fuera del provider. Eso evita
pantallas con stores paralelos o rehidrataciones accidentales.

## Comandos

Los comandos se dividen por responsabilidad:

- `expense-commands`: crea templates, categorias y overrides; paga, salta,
  mueve o borra gastos.
- `finance-commands`: modifica salario mensual, objetivos, aportaciones reales
  e ingresos.
- `preference-commands`: actualiza tema e idioma en el store.

Los comandos reciben un `ExpenseStore` y devuelven otro. Esta forma mantiene la
logica testeable y evita mutaciones ocultas dentro de componentes.

## Persistencia local

La persistencia local usa `localStorage` con la clave
`expense-log-store-v1`. Al cargar:

1. Se lee localStorage.
2. Se normaliza el JSON.
3. Se aplican preferencias runtime desde cookies/DOM cuando corresponde.
4. Se guarda de nuevo el store normalizado.
5. Se hidrata React.

Al guardar:

1. Se asigna owner si hay usuario.
2. Se incrementa la revision local.
3. Se escribe localStorage.
4. Se emite `expense-store-updated`.
5. Se marca el dispositivo con cambios sin subir (`expense-log-sync-v1`).
6. Se encola guardado cloud si hay Supabase, usuario e hidratacion completa.

`expense-log-sync-v1` guarda `{ownerId, dirty, updatedAt}` fuera del store
(`src/data/persistence/sync-meta-store.ts`). `ownerId` es la cuenta a la que
pertenecen los datos locales: la del usuario actual o, sin sesion (por ejemplo
sin red), la ultima sincronizada. `dirty` vuelve a `false` solo cuando la tabla
confirma una version que incluye la ultima edicion local (un guardado en modo
"sin nube" no cuenta).

Si localStorage falla, la app intenta seguir viva y emite igualmente el evento
de actualizacion.

## Sync cloud

La sync cloud usa Supabase `app_stores` con un JSONB completo del store por
usuario. Al hidratar con sesion:

1. Se carga el store local inicial.
2. Se pide el usuario con `supabase.auth.getUser()`. Un fallo de red
   (`AuthRetryableFetchError`) no se trata como cierre de sesion, tampoco la
   sesion inicial vacia que auth-js emite sin red (`INITIAL_SESSION` sin
   sesion se comprueba con `getUser`).
3. Se carga el store cloud desde `app_stores`.
4. Gana la nube, salvo que haya cambios locales sin subir de esa misma cuenta o
   ediciones hechas mientras cargaba: entonces se fusionan local y cloud.
5. Se asigna `userId` real a entidades sincronizables.
6. Se guarda local y se hidrata React con el resultado.
7. Si hubo fusion (o la cuenta no tenia store cloud), se sube el resultado.

Los datos de otra cuenta (`ownerId` distinto) no se fusionan ni se suben nunca:
al entrar con otra cuenta gana su nube y, si no tiene, se empieza vacio. Los
cambios sin cuenta (uso sin sesion, o sin red antes de resolverla) se fusionan
con la primera cuenta que entra.

Solo la tabla inexistente (`PGRST205`, `42P01`) cuenta como "sin nube". Un
fallo temporal de PostgREST o de permisos es un error a reintentar. Las
peticiones a `app_stores` se cortan a los 20 s.

Si la tabla `app_stores` no existe o no esta disponible, la app degrada a modo
local sin romper la experiencia.

## Merge local/cloud

La mezcla actual usa ids:

- Entidades cloud como base.
- Entidades locales como entrada con prioridad final, salvo que la de la nube
  tenga un `updatedAt` mas reciente (plantillas, categorias, ingresos,
  registros).
- Tombstones combinados para filtrar elementos borrados.
- Mapas mensuales de salario y ahorro: cloud + local, con local al final.
- Sueldos borrados: `deleted.monthlySalary` guarda la hora del borrado
  (`*@<hora>` para todos los meses o `<mes>@<hora>`, ver
  `salaryClearedTombstone`). Al fusionar desaparece cualquier sueldo editado
  hasta esa hora, tambien copias antiguas de otro dispositivo; uno editado
  despues se conserva.
- Preferencias: local, luego cloud, luego defaults.

La politica de hidratacion (`resolveHydratedStore`) protege los cambios hechos
mientras llegaba el cloud store y los que quedaron sin subir en una sesion
anterior: en ambos casos se fusiona el store local mas reciente con la nube.

## Compatibilidad hacia delante

Un build antiguo puede convivir con datos escritos por uno nuevo: otro
dispositivo sin actualizar, una PWA con la version anterior en cache o un
rollback de Vercel. Para que no borre lo que no conoce:

- En stores con `schemaVersion >= 3`, la normalizacion conserva las claves
  desconocidas de la raiz, `finance`, `deleted` y `preferences`.
- El merge las combina sin interpretarlas. Los registros se fusionan por entrada
  con el `updatedAt` mas reciente, las listas de ids por union y en el resto de
  casos gana el valor local.
- Las claves retiradas (`bankMovements`, `bankMerchantAliases`, `accounts`,
  `allocation`, `incomeSources`, `purposes`) se siguen descartando, igual que
  todo lo desconocido de stores anteriores a la v3.

Reglas para campos nuevos:

- Han de ser aditivos y opcionales, sin subir `schemaVersion`.
- No se escriben hasta que el build con passthrough lleve al menos una semana
  desplegado y abierto en todos los dispositivos.
- Revertir un despliegue que añade campos solo es seguro hacia un build que ya
  tenga passthrough.
- Excepcion: tombstones como `deleted.monthlySalary` se escriben ya. Si un build
  antiguo los descarta, se vuelve al comportamiento anterior (el dato borrado
  puede reaparecer al fusionar), nunca a perder datos.
- Excepcion: `finance.monthClosures` (meses cerrados para pasar al siguiente)
  tambien. Si un build antiguo lo descarta, el mes activo vuelve a ser el
  natural. Se fusiona por mes con el `updatedAt` mas reciente; reabrir guarda
  `reopenedAt` en vez de borrar la entrada.
- Campos de contrato de las plantillas (`notes`, `cancellationUrl`,
  `commitmentEndDate`, `paymentMethod`, `paymentMethodDetail`) y `updatedAt` de
  las categorias: viven dentro de entidades que todos los builds guardan tal
  cual (las plantillas y categorias nunca se reconstruyen campo a campo), asi
  que un build anterior los conserva al guardar y al fusionar. La
  normalizacion (`sanitizeExpenseDetails`, `normalizeCategories`) descarta solo
  lo ilegible: un enlace que no es http(s), una fecha imposible, un metodo de
  pago desconocido; una categoria sin id. Un store sin estos campos carga
  igual.

## Categorias

Las categorias son entidades del store (`id`, `name`, `icon`, `tone`,
`updatedAt`). Las preset se crean al usarlas por primera vez; las propias, con
`createCategoryInStore`. `findOrCreateCategory` reconoce cualquier categoria
guardada por su nombre (sin tildes ni mayusculas) antes de recurrir a la preset
equivalente. Renombrar o cambiar el color actualiza `updatedAt`; borrar
(`deleteCategoryInStore`) pasa las plantillas, overrides y registros que la
usan a otra categoria y deja su id como tombstone en `deleted.categories`.

## Preferencias de dispositivo

No se sincronizan y viven fuera del store:

- `expense-view-month` (sessionStorage) y `plan-close-dismissed:YYYY-MM`.
- `expense-onboarding-v1` (`src/data/persistence/onboarding-store.ts`):
  `{startedAt, dismissedAt}` de la guia de primeros pasos. La guia se ve con el
  store vacio (salvo mientras carga la nube) y, si el primer gasto se añadio
  con ella a la vista, hasta ocultarla.

## Cola de guardado

Los cambios normales se guardan localmente y se encolan para cloud
(`src/stores/app/cloud-save-queue.ts`, debounce de 350 ms). Operaciones mas
sensibles, como borrar gastos o limpiar gastos, usan persistencia inmediata
para reducir ventanas de inconsistencia.

La cola:

- Sube siempre la ultima version y nunca dos a la vez, para que una respuesta
  lenta no pise otra mas nueva.
- Si falla, no repite la misma copia: la nube puede haber cambiado. Marca la
  nube como no lista y vuelve a sincronizar (cargar, fusionar con los cambios
  pendientes y subir) a los 2, 5, 15, 30 y 60 s, y de inmediato al recuperar la
  red (`online`) o volver a la app.
- `persistImmediately` (borrar o vaciar) espera a que su version llegue a la
  nube o falle, aunque haya otro guardado en curso.
- Al ocultar o cerrar la app (`visibilitychange:hidden`, `pagehide`) sube ya lo
  que esperaba al debounce.
- Descarta lo encolado sin sesion o mientras la nube recarga: los cambios siguen
  marcados como pendientes y la siguiente sincronizacion los fusiona.

El estado de sync comunica preparando cloud, guardando, guardado, pendiente de
subir, local o error. "Pendiente" solo se muestra para fallos temporales (sin
red, cortes, servidor reiniciando) con cambios sin subir; el resto se muestra
como error. Los mensajes se traducen con `src/shared/i18n`.

## Reglas actuales y limites

- El modelo cloud sigue siendo JSONB por usuario, no tablas normalizadas por
  entidad.
- Los tombstones evitan reaparicion de deletes, pero no son un sistema completo
  de resolucion por revision de cada campo.
- En ediciones concurrentes del mismo elemento, gana el item que entra al final
  en el merge por id.
- Los deletes deben seguir registrando tombstones en nuevos comandos.
- La migracion v3 descarta cuentas y datos bancarios legacy despues de
  materializar conciliaciones pagadas.
- Un override pagado persistido tiene prioridad sobre el pago sintetizado desde
  un movimiento bancario legacy de la misma ocurrencia.
- La v3 no mantiene importador bancario, movimientos, alias ni cuentas; no deben
  reintroducirse en el store o los comandos sin una decision de producto nueva.
