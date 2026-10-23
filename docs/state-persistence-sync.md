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
- Copias: `importStore`, `restoreSnapshot` y `takeSnapshot` (ver "Copias,
  exportar e importar").
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
- `backup-commands`: combina o sustituye el store con uno importado o con una
  copia.

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
- Entidades locales como entrada con prioridad final.
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

## Copias, exportar e importar

Ajustes tiene la seccion "Copias y datos" (`features/settings/components/rows/BackupRows.tsx`).

### Exportar

- **JSON** (`src/data/persistence/backup-file.ts`): el store completo dentro de
  un sobre `{kind: "expense-log-backup", version: 1, exportedAt, store}`. El
  archivo se llama `expense-log-AAAA-MM-DD.json`.
- **CSV** (`src/data/persistence/store-csv.ts`): un solo archivo UTF-8 con BOM
  (para que Excel lea las tildes), coma como separador e importes con punto y
  dos decimales (`2200.00`). La columna `type` distingue:
  - `expense`: una fila por gasto (frecuencia, intervalo, mes anual, rrule,
    inicio, fin, dia de cobro, aviso, descripcion).
  - `occurrence`: el historico hasta el final del mes actual (los meses
    cerrados tambien de gastos borrados) y, de despues, solo los cobros con
    cambios (por ejemplo, pagados por adelantado).
  - Las cabeceras y los valores de frecuencia y estado no se traducen; la
    categoria sale como se ve en la app y se reconoce en los dos idiomas al
    importar (`resolveCategoryName`). El texto que empieza por `= + - @` lleva
    un apostrofo delante para que una hoja de calculo no lo ejecute como
    formula; se quita al importar.

### Importar

1. Se lee el archivo (maximo 5 MB). Si empieza por `{` o acaba en `.json`, se
   trata como JSON (con sobre o el store a secas) y pasa por
   `normalizeImportedExpenseStore`, que ademas descarta las entidades a las que
   les falta lo imprescindible (id, nombre, importe, fechas validas). Si no,
   como CSV: acepta `;` y coma decimal (Excel en espanol) y un CSV hecho a mano
   con solo `name` y `amount`. Las filas ilegibles se cuentan y se saltan.
2. Se ensena una vista previa: lo que trae el archivo y cuantos gastos, pagos
   e ingresos quedarian al combinar o al sustituir.
3. Antes de aplicar se guarda una copia "Antes de importar".
4. Se aplica con `importStoreInStore` (`src/stores/app/backup-commands.ts`) y
   `persistImmediately`:
   - **Combinar**: `mergeExpenseStores(actual, importado)`, como con la nube.
     Por id gana la version mas reciente, los borrados siguen borrados y las
     preferencias del dispositivo se mantienen.
   - **Sustituir** (`replaceStoreContents`): deja solo lo importado y lo hace
     de forma que aguante una fusion posterior con la nube u otro dispositivo
     (si la subida falla o hay otro dispositivo sin sincronizar). Todo lo
     importado se marca como editado ahora; lo que solo estaba en los datos
     actuales recibe tombstone si su id es aleatorio (gastos, categorias,
     ingresos, aportaciones, historico de gastos que desaparecen) o queda en
     estado neutro si es determinista (cobros `ovr:*` en estado pendiente,
     cierres de mes reabiertos, sueldos con tombstone por mes), porque un
     tombstone de un id determinista impediria volver a usarlo. Un id que el
     archivo trae se quita de los tombstones. Limite conocido: los objetivos de
     ahorro no tienen tombstone, asi que un mes que solo estaba en los datos
     actuales puede volver en esa fusion.
   - El CSV solo trae gastos, cobros e historico: sustituir no toca Plan,
     ingresos ni preferencias. Los meses cerrados vuelven como historico
     (`occurrenceRecords`) y los abiertos como overrides de su gasto.

### Copias automaticas

- Viven en IndexedDB (`expense-log-backups`, `src/data/persistence/snapshot-store.ts`),
  nunca en localStorage: varias copias llenarian su cupo y entonces fallaria
  guardar el propio store. Sin IndexedDB no hay copias y la app sigue igual.
- `useStoreSnapshots` (en el provider) guarda una diaria 4 s despues de
  hidratar y al volver a la app: una por dia natural y solo si los datos han
  cambiado desde la ultima copia (huella FNV-1a sin preferencias). Un store
  vacio no se copia.
- Tambien se guarda una antes de importar, restaurar o limpiar gastos o
  ingresos, y otra cuando el usuario pulsa "Guardar copia ahora".
- Se quedan las 7 diarias y las 5 de otro tipo mas recientes
  (`snapshot-policy.ts`).
- Restaurar es sustituir con alcance completo, despues de guardar una copia
  "Antes de restaurar"; la copia pasa por `normalizeExpenseStore`, asi que una
  guardada por una version anterior sigue cargando.

### Almacenamiento persistente

La fila "Almacenamiento persistente" ensena `navigator.storage.persisted()` y el
espacio usado, y ofrece "Proteger" (`navigator.storage.persist()`) si el
navegador lo permite y aun no lo ha concedido. `PwaRegister` lo sigue pidiendo
en silencio al registrar el service worker.

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
