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
sin red), la ultima sincronizada. `dirty` vuelve a `false` solo cuando la nube
confirma una version que incluye la ultima edicion local.

Si localStorage falla, la app intenta seguir viva y emite igualmente el evento
de actualizacion.

## Sync cloud

La sync cloud usa Supabase `app_stores` con un JSONB completo del store por
usuario. Al hidratar con sesion:

1. Se carga el store local inicial.
2. Se pide el usuario con `supabase.auth.getUser()`. Un fallo de red
   (`AuthRetryableFetchError`) no se trata como cierre de sesion.
3. Se carga el store cloud desde `app_stores`.
4. Gana la nube, salvo que haya cambios locales sin subir de esa misma cuenta o
   ediciones hechas mientras cargaba: entonces se fusionan local y cloud.
5. Se asigna `userId` real a entidades sincronizables.
6. Se guarda local y se hidrata React con el resultado.
7. Si hubo fusion (o la cuenta no tenia store cloud), se sube el resultado.

Los cambios sin subir de otra cuenta no se fusionan nunca: al entrar con otra
cuenta, su nube gana.

Si la tabla `app_stores` no existe o no esta disponible, la app degrada a modo
local sin romper la experiencia.

## Merge local/cloud

La mezcla actual usa ids:

- Entidades cloud como base.
- Entidades locales como entrada con prioridad final.
- Tombstones combinados para filtrar elementos borrados.
- Mapas mensuales de salario y ahorro: cloud + local, con local al final.
- Sueldos borrados: `deleted.monthlySalary` guarda la version borrada
  (`<mes>@<updatedAt>`, ver `monthlySalaryVersionId`). Un sueldo editado despues
  en otro dispositivo tiene otra version y se conserva.
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

## Cola de guardado

Los cambios normales se guardan localmente y se encolan para cloud
(`src/stores/app/cloud-save-queue.ts`, debounce de 350 ms). Operaciones mas
sensibles, como borrar gastos o limpiar gastos, usan persistencia inmediata
para reducir ventanas de inconsistencia.

La cola:

- Sube siempre la ultima version y nunca dos a la vez, para que una respuesta
  lenta no pise otra mas nueva.
- Si falla, reintenta a los 2, 5, 15, 30 y 60 s. Al recuperar la red (`online`)
  o volver a la app, reintenta de inmediato; si la nube no llego a cargar,
  vuelve a sincronizar.
- Al ocultar o cerrar la app (`visibilitychange:hidden`, `pagehide`) sube ya lo
  que esperaba al debounce.
- Descarta lo encolado sin sesion o mientras la nube recarga: los cambios siguen
  marcados como pendientes y la siguiente sincronizacion los fusiona.

El estado de sync comunica preparando cloud, guardando, guardado, pendiente de
subir, local o error. Los mensajes se traducen con `src/shared/i18n`.

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
