# Estado, persistencia y sincronizacion

El estado de aplicacion se centraliza en `ExpenseStoreProvider`. Las pantallas
interactivas usan `useExpenseStore` para leer datos, ejecutar comandos y conocer
el estado de sync.

## Provider global

`ExpenseStoreProvider` vive en el `RootLayout`, por lo que dashboard, money,
settings y detail comparten una unica instancia del store.

El hook expone:

- `store`: datos normalizados de la app.
- Comandos de gastos: add (con los cobros de meses anteriores pagados o
  saltados si el gasto empezo antes de este mes), delete, clear, toggle paid,
  skip, restore, pagar varios a la vez (`markOccurrencesPaid`), move occurrence
  y move series.
- Comandos financieros: salario, objetivo de ahorro, aportacion real, ingresos,
  overrides mensuales y cerrar o reabrir un mes.
- Cuentas: crear, editar (nombre y papel), subir o bajar, borrar
  (`addBalanceAccount`, `updateBalanceAccount`, `moveBalanceAccount`,
  `deleteBalanceAccount`) y anotar o borrar el saldo de una cuenta un dia
  (`recordAccountBalance`, `deleteAccountBalance`).
- Comandos de preferencias: tema, idioma y ajustes de avisos
  (`updateReminderPreferences`), y el aviso propio de un gasto
  (`setTemplateReminder`, la campana de la fila).
- Copias: `importStore`, `restoreSnapshot` y `takeSnapshot` (ver "Copias,
  exportar e importar").
- Estado de sync: `syncStatus`, `syncMessage`, `isHydrated`.

`useExpenseStore` falla explicitamente si se llama fuera del provider. Eso evita
pantallas con stores paralelos o rehidrataciones accidentales.

## Comandos

Los comandos se dividen por responsabilidad:

- `expense-commands`: crea templates, categorias y overrides; paga, salta,
  restaura, mueve o borra gastos. Las operaciones en bloque
  (`markOccurrencesPaidInStore`, `skipOccurrencesInStore`) pliegan
  `upsertOccurrenceOverride` y se guardan con un solo persist.
- `finance-commands`: modifica salario mensual (con ambito "solo este mes" o
  "desde este mes"), pagas extra, la respuesta a "¿Has cobrado?", objetivos,
  aportaciones reales, ingresos, el ciclo del presupuesto y los saldos de la
  cuenta `primary` (`recordBalanceInStore`, `deleteBalanceCheckinInStore`).
- `account-commands`: cuentas (crear, renombrar, cambiar de papel, reordenar y
  borrar con tombstone, junto con sus saldos) y el saldo de cada cuenta por dia.
  Los de la `primary` pasan por `finance-commands` y se guardan en
  `balanceCheckins`.
- `series-commands`: cambiar el importe de la serie desde ahora, programar o
  quitar un precio, finalizar, pausar, reanudar y quitar una pausa. Ninguno
  reescribe un cobro pagado ni un mes cerrado. Pagar con otro importe
  (`payOccurrenceInStore`, en `expense-commands`) apunta lo pagado sin tocar
  lo previsto y, si el cobro ya estaba pagado, conserva su fecha de pago.
- `preference-commands`: actualiza tema, idioma y ajustes de avisos en el
  store.
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
3. Se carga el store cloud desde `app_stores`, con su `revision`.
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
fallo temporal de PostgREST, de permisos o la falta del RPC del CAS
(`PGRST202`) no. Las peticiones a `app_stores` se cortan a los 20 s.

Si la tabla `app_stores` no existe o no esta disponible, la app degrada a modo
local sin romper la experiencia.

## Multi-dispositivo (compare-and-swap)

La migracion `20261023120000_app_store_revision_cas.sql` añade
`app_stores.revision` y un trigger `BEFORE UPDATE` que la incrementa en cada
escritura, tambien en el upsert ciego de los clientes anteriores. Los guardados
pasan por el RPC `save_app_store(p_store, p_expected_revision)`:

- Guarda solo si la fila sigue en la revision que leyo el cliente (`null`:
  "aun no hay fila") y devuelve la nueva. Si otro dispositivo guardo antes,
  devuelve `conflict` con la revision actual en vez de pisarlo.
- Ante un conflicto (`saveResolvingConflicts`, `cloud-save-queue.ts`) se
  vuelve a cargar la nube, se fusiona con lo que muestra la app (no con la
  copia que fallo), se guarda local, se hidrata y se reintenta sobre la nueva
  revision, hasta 3 veces. Lo encolado mientras tanto se sustituye por la
  fusion, que ya lo incluye. Si la nube sigue cambiando, el fallo cuenta como
  temporal y se reintenta con la resincronizacion normal.
- Sin la migracion aplicada (`PGRST202`), `saveCloudStore` cae al upsert de
  siempre, lo registra una vez y no vuelve a probar el RPC en 10 minutos. La
  carga usa `select("*")` para no pedir una columna que aun no existe. Mergear
  el cliente antes que la migracion es seguro.
- La revocacion de la escritura directa en `app_stores` (contract) queda para
  un PR posterior; entonces el RPC pasara a `security definer`.

Al volver a la app (`visibilitychange` visible u `online`), con la nube lista y
sin guardado en curso, se trae la nube como mucho cada 30 s
(`CLOUD_PULL_THROTTLE_MS`). Si la revision no cambio, no se hace nada. Si
cambio y no hay cambios locales sin subir, gana la nube; si los hay, se fusiona
y se sube con CAS. Ajustes muestra "Sincronizado · con cambios de otro
dispositivo" cuando llegan datos de fuera.

Tras cualquier fusion (`mergeStoresForSync`) se recolocan los overrides
huerfanos (`reconcileOrphanOverrides`): el rekey de un cambio de dia solo corre
en el dispositivo que edita, asi que un pago hecho en otro con la fecha antigua
queda en una clave que la plantilla ya no genera. Se repite el rekey de los
meses abiertos contra las plantillas actuales; si la nube ya traia huerfanos,
la version corregida tambien se sube.

## Varias pestañas

Cada escritura local lee antes lo que haya en localStorage: si otra pestaña
guardo despues de la ultima escritura de esta (`readExpenseStoreFromOtherTab`),
se fusiona antes de escribir, para que dos pestañas no se pisen. Al recibir el
evento `storage` del store (o al volver a la pestaña), lo de la otra se
incorpora a lo que se muestra sin volver a escribirlo; la revision local sube
para que un guardado en curso de esta pestaña no de por subido un estado sin
esos cambios. Las preferencias vienen de la escritura mas reciente. Los datos
de otra cuenta escritos por otra pestaña no se mezclan: esta vuelve a
sincronizar.

## Merge local/cloud

La mezcla actual usa ids:

- Entidades cloud como base.
- Entidades locales como entrada con prioridad final, salvo que la de la nube
  tenga un `updatedAt` mas reciente (plantillas, categorias, ingresos,
  registros). Una version con `updatedAt` gana a otra sin el: una categoria
  renombrada no vuelve a su nombre antiguo por una copia que nunca tuvo fecha.
- Tombstones combinados para filtrar elementos borrados.
- Mapas mensuales de salario y ahorro: cloud + local, con local al final.
- Sueldos borrados: `deleted.monthlySalary` guarda la hora del borrado
  (`*@<hora>` para todos los meses o `<mes>@<hora>`, ver
  `salaryClearedTombstone`). Al fusionar desaparece cualquier sueldo editado
  hasta esa hora, tambien copias antiguas de otro dispositivo; uno editado
  despues se conserva.
- Preferencias: local, luego cloud, luego defaults. Son de cada dispositivo:
  las cookies de tema e idioma mandan sobre el store al cargar. Excepcion:
  `preferences.reminders` (ajustes de avisos, que lee el cron) gana la version
  con el `updatedAt` mas reciente, de cualquier dispositivo.
- Aviso de un gasto: `template.reminder` viaja con la plantilla (merge por
  `updatedAt`). Sin el, el gasto sigue el aviso por defecto de
  `preferences.reminders`.
- Categorias: llevan `updatedAt` desde F0c-2 y se fusionan por entidad como
  plantillas, ingresos o registros. Las antiguas no lo tienen: pierden frente
  a una copia con fecha (un cambio de nombre no se deshace) y, entre dos sin
  fecha, gana la local. Los builds anteriores conservan el campo porque no
  reescriben las entidades.
- `finance.budgetCycle` (mes natural o desde el dia de cobro): gana el de
  `updatedAt` mas reciente; si solo uno de los dos stores lo tiene, se
  conserva.
- `finance.balanceCheckins` (saldo por fecha de la cuenta `primary`): por dia,
  la version con el `updatedAt` mas reciente. Borrar guarda `deletedAt` en vez
  de quitar la entrada, asi que un borrado gana a una copia vieja y volver a
  anotar ese dia gana al borrado.
- `finance.accountCheckins` (saldo de las demas cuentas, por
  `${accountId}:${YYYY-MM-DD}`): igual que `balanceCheckins`, por cuenta y dia.
- `finance.balanceAccounts` (cuentas por id): la version con el `updatedAt` mas
  reciente, salvo que una de las dos este borrada (`deletedAt`): el borrado gana
  siempre (`mergeAccountRecord`), como los tombstones de `deleted`. Renombrar en
  otro dispositivo una cuenta ya borrada no la devuelve. Borrar una cuenta
  tambien marca `deletedAt` en cada uno de sus saldos.
- Pagas extra (`finance.salaryExtraPays`) y respuestas a "¿Has cobrado?"
  (`finance.salaryReceipts`): por mes, la version con el `updatedAt` mas
  reciente. Deshacer un cobro marca `undone` con una version nueva en vez de
  borrar la entrada.
- Cambios de precio (`amountChanges`), pausas (`pauses`) y datos de contrato
  (`notes`, `cancellationUrl`, `commitmentEndDate`, `paymentMethod`,
  `paymentMethodDetail`) viven dentro de la plantilla y viajan con ella: gana
  la plantilla editada mas tarde.

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
- Excepcion: `preferences.reminders` (ajustes de avisos) tambien, solo cuando
  el usuario los cambia. Un build con passthrough lo conserva como clave
  desconocida; uno anterior lo descarta y los avisos vuelven a los valores
  por defecto (solo los gastos con aviso propio, a las 8), sin perder datos.
  La normalizacion corrige valores imposibles (hora, antelacion, zona) y
  conserva las claves que añada un build mas nuevo dentro del objeto.
- Campos de contrato de las plantillas (`notes`, `cancellationUrl`,
  `commitmentEndDate`, `paymentMethod`, `paymentMethodDetail`) y `updatedAt` de
  las categorias: viven dentro de entidades que todos los builds guardan tal
  cual (las plantillas y categorias nunca se reconstruyen campo a campo), asi
  que un build anterior los conserva al guardar y al fusionar. La
  normalizacion (`sanitizeExpenseDetails`, `normalizeCategories`) descarta solo
  lo ilegible: un enlace que no es http(s), una fecha imposible, un metodo de
  pago desconocido; una categoria sin id. Un store sin estos campos carga
  igual.
- El cierre con restos (F1a-3) no añade campos: cada resto se resuelve con
  overrides (pagado, saltado o movido al primer dia del mes siguiente: el 1
  o, con el ciclo anclado al cobro, el dia de cobro), el ahorro con
  `monthlySavingsContributions` y el paso de mes con `monthClosures`. Los
  cobros anteriores de un gasto nuevo (M18) tambien son overrides; los pagos se
  fechan el dia de su cargo.
- Excepcion: `finance.budgetCycle` tambien. Si un build antiguo lo descarta,
  Gastos y Plan vuelven al mes natural, que es el valor por defecto. Un build
  con passthrough lo conserva; al fusionar dos copias gana la local, porque no
  conoce su `updatedAt`.
- `finance.balanceCheckins` se escribe en cuanto se anota un saldo. Los builds
  con passthrough (desde PR 0) lo conservan y lo fusionan por fecha con el
  `updatedAt` mas reciente, igual que este build. Solo un build anterior a PR 0
  lo descartaria: antes de anotar saldos hay que abrir la app actualizada en
  todos los dispositivos.
- Cuentas (`finance.balanceAccounts` y `finance.accountCheckins`): se escriben
  ya, solo cuando tienen algo (`withNonEmpty`). Los builds con passthrough las
  conservan como claves desconocidas de `finance` y las fusionan entrada a
  entrada por `updatedAt`. Por eso los saldos van en un registro plano por
  `${accountId}:${fecha}` y no anidados por cuenta: anidados, esos builds
  fusionarian cada cuenta entera (el registro interior no tiene `updatedAt`)
  quedandose con la copia local y perderian saldos anotados en otro
  dispositivo. Los builds anteriores a las cuentas siguen leyendo y anotando
  "Saldo de la cuenta" en `balanceCheckins`, que es la cuenta `primary`: lo que
  anoten aparece en la cuenta de recibos migrada. Solo un build anterior a PR 0
  (sin passthrough) descartaria las claves nuevas. La clave
  no se llama `accounts` porque esa es una clave retirada (las cuentas
  bancarias legacy) que todos los builds descartan. Limite conocido: un build
  con passthrough fusiona `balanceAccounts` sin la regla de "el borrado gana",
  y una `primary` borrada no vuelve a mostrar los saldos que un build anterior
  anote despues en `balanceCheckins`.
- Los stores anteriores a estos campos cargan igual: sin `budgetCycle` el mes
  es natural, sin `balanceCheckins` no hay cuenta migrada y sin
  `balanceAccounts` ni `accountCheckins` no hay mas cuentas. Un valor ilegible
  se descarta en la normalizacion sin tocar el resto: una cuenta sin papel
  conocido o sin `updatedAt`, un id con caracteres fuera de `[A-Za-z0-9_-]`,
  de mas de 80 o que coincide con una propiedad de cualquier objeto
  (`__proto__`, `constructor`...), un saldo sin importe finito (tambien tras
  redondear a centimos) o con una clave sin fecha valida, o un saldo de la
  `primary` dentro de `accountCheckins`.
- Excepcion: los campos de F3 de dinero tambien se escriben ya, porque cada uno
  degrada a un comportamiento anterior y no a perder datos:
  - `templates[].amountChanges` y `templates[].pauses`: los builds con
    passthrough conservan la plantilla tal cual, pero no los aplican; hasta
    actualizar, una suscripcion en pausa vuelve a pedir sus cobros y un precio
    programado no se aplica. La normalizacion descarta entradas ilegibles y una
    pausa con un fin imposible (mejor volver a ver los cobros que esconderlos).
  - `monthlySalary[mes].onlyThisMonth`: un build anterior lo descarta al
    normalizar y el sueldo de "solo este mes" se arrastra a los siguientes
    (el comportamiento de antes de M16).
  - `finance.salaryExtraPays` y `finance.salaryReceipts`: claves nuevas de
    `finance`, que los builds con passthrough conservan y fusionan por mes; un
    build anterior no cuenta la paga extra ni lo cobrado.

## Categorias

Las categorias son entidades del store (`id`, `name`, `icon`, `tone`,
`updatedAt`). Las preset se crean al usarlas por primera vez; las propias, con
`createCategoryInStore`. `findOrCreateCategory` reconoce cualquier categoria
guardada por su nombre (sin tildes ni mayusculas) antes de recurrir a la preset
equivalente. Renombrar o cambiar el color actualiza `updatedAt`; borrar
(`deleteCategoryInStore`) pasa las plantillas, overrides y registros que la
usan a otra categoria y deja su id como tombstone en `deleted.categories`.

Al fusionar gana la copia con el `updatedAt` mas reciente; una con fecha gana
a otra sin ella y, entre dos sin fecha, gana la local. La copia JSON lleva las
categorias tal cual. El CSV exporta el nombre visible y el color
(`category_tone`); al importar, `resolveCategoryName` reconoce primero las
categorias del dispositivo, despues las preset (en los dos idiomas, sin
tildes) y sus alias, y un nombre que no es ninguna de ellas vuelve como
categoria propia con su color. Los alias solo cuentan en filas sin
`category_tone` (hojas hechas a mano): una propia exportada que se llama como
un alias ("Streaming", "Hogar") vuelve como propia y no como la preset.

## Preferencias de dispositivo

No se sincronizan y viven fuera del store:

- El mes que se mira vive en `sessionStorage['expense-view-month']`, por
  pestaña y compartido entre Gastos y Plan: al cambiar de mes en una pestaña,
  la otra lo sigue. Sin valor se ve el mes activo.
- El "Ahora no" a pasar o cerrar el mes se guarda por dispositivo y por mes en
  `localStorage['plan-close-dismissed:YYYY-MM']`.
- El "Aun no" a "¿Has cobrado?" se guarda por dispositivo y por mes, con el
  dia, en `localStorage['salary-prompt-dismissed:YYYY-MM']`: vuelve a preguntar
  al dia siguiente.
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
- Sube con CAS: un conflicto se fusiona y se reintenta dentro del mismo
  guardado (ver "Multi-dispositivo").
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
    inicio, fin, pausas, cambios de precio, dia de cobro, aviso, descripcion y
    los datos de contrato: `notes`, `cancellation_url`, `commitment_end_date`,
    `payment_method`, `payment_method_detail`). `reminder_days` lleva los dias
    de antelacion del aviso propio, `off` si el aviso propio esta apagado o
    nada si el gasto sigue el aviso por defecto de Ajustes. Las pausas van como
    `inicio/fin` (`inicio/` si sigue abierta) y los cambios de precio como
    `fecha=importe`, separados por espacios.
  - `occurrence`: el historico hasta el final del mes actual (los meses
    cerrados tambien de gastos borrados) y, de despues, solo los cobros con
    cambios (por ejemplo, pagados por adelantado).
  - Las cabeceras y los valores de frecuencia y estado no se traducen; la
    categoria sale como se ve en la app, con su color en `category_tone`, y se
    reconoce en los dos idiomas al importar (`resolveCategoryName`; las
    propias, por su nombre). El texto que empieza por `= + - @` lleva
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
     importado (tambien las categorias) se marca como editado ahora; lo que solo estaba en los datos
     actuales recibe tombstone si su id es aleatorio (gastos, categorias,
     ingresos, aportaciones, historico de gastos que desaparecen) o queda en
     estado neutro si es determinista (cobros `ovr:*` en estado pendiente,
     cierres de mes reabiertos, respuestas a "¿Has cobrado?" deshechas,
     sueldos con tombstone por mes, pagas extra reescritas con las que el
     archivo tiene vigentes ese mes, saldos con `deletedAt` y el ciclo del
     presupuesto de vuelta al mes natural), porque un tombstone de un id
     determinista impediria volver a usarlo. Las cuentas que solo estaban en los
     datos actuales se borran con `deletedAt`, y sus saldos tambien; si el
     archivo trae saldos de la `primary` sin sus metadatos (es de un build
     anterior a las cuentas), la `primary` vuelve a sus valores por defecto en
     lugar de borrarse. Lo que el archivo trae con un id
     que ya tiene tombstone (borrado aqui o en el archivo) entra con un id
     nuevo, junto con lo que depende de el (la categoria de sus gastos, sus
     cobros `ovr:*` y su historico `record:*`), y el tombstone se queda: una
     copia que aun lo tenga suelta la version antigua sin borrar la restaurada
     ni duplicarla (`rekeyTombstonedIds`). Igual con una cuenta del archivo
     borrada aqui (`rekeyTombstonedAccounts`): entra con un id nuevo y sus
     saldos con ella; si es la `primary`, sus saldos pasan de
     `balanceCheckins` a `accountCheckins`. Tema e idioma se quedan; los avisos,
     que son de la cuenta y los lee el cron, vienen del archivo marcados como
     editados ahora (si el archivo no los trae, se quedan los actuales). Limite
     conocido: los objetivos de ahorro no tienen tombstone, asi que un mes que
     solo estaba en los datos actuales puede volver en esa fusion.
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
- Salir borrando los datos del dispositivo y borrar la cuenta vacian tambien
  las copias (`clearDeviceData` en `src/data/persistence/device-data.ts`):
  llevan el store entero y quien use despues el navegador podria restaurarlas.

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
- En ediciones concurrentes del mismo elemento gana el `updatedAt` mas
  reciente; sin el, la copia local. El CAS garantiza que ninguna escritura
  pisa a otra sin fusionarla, no que se conserve cada campo de las dos.
- Los deletes deben seguir registrando tombstones en nuevos comandos.
- La migracion v3 descarta cuentas y datos bancarios legacy despues de
  materializar conciliaciones pagadas.
- Un override pagado persistido tiene prioridad sobre el pago sintetizado desde
  un movimiento bancario legacy de la misma ocurrencia.
- La v3 no mantiene importador bancario, movimientos ni alias; no deben
  reintroducirse en el store o los comandos sin una decision de producto nueva.
  Las cuentas de ahora (`balanceAccounts`) son otra cosa: solo nombre, papel y
  saldos anotados a mano, sin movimientos.
