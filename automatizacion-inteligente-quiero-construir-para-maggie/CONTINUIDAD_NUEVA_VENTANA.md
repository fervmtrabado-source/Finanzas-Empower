# Finanzas Empower - continuidad para nueva ventana

Este documento resume el estado real del proyecto para que una nueva ventana pueda continuar sin reconstruir contexto.

## Ruta local y despliegue

Carpeta que se sube completa a GitHub:

```txt
/Users/fervmt/Documents/Codex/2026-08-14/pa/automatizacion-inteligente-quiero-construir-para-maggie/automatizacion-inteligente-quiero-construir-para-maggie
```

Sitio actual de Netlify:

```txt
https://carterainteligente.netlify.app
```

Base directory en Netlify:

```txt
automatizacion-inteligente-quiero-construir-para-maggie
```

Publish directory:

```txt
outputs
```

Functions directory:

```txt
netlify/functions
```

## Arquitectura

- `outputs/`: app estatica para subir CSV, revisar datos y ver reportes.
- `netlify/functions/`: endpoints backend usados por la app y por Make.
- `supabase/`: SQL de schema y migraciones.
- Supabase guarda la ultima carga CSV en `csv_uploads` y `policies`.
- Make lee JSON desde Netlify y manda correos con Outlook.

La app no necesita estar abierta para que Make mande avisos. Maggie solo abre la app para revisar o subir un CSV nuevo.

## Variables de entorno en Netlify

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MAKE_SHARED_SECRET=
```

Si `MAKE_SHARED_SECRET` existe, Make debe mandar el header:

```txt
x-make-secret: <valor>
```

## Reglas de negocio

- Solo incluir polizas con estatus exacto `En Vigor`.
- Excluir `En Vigor sin Pago de Primas` porque no es exacto.
- Conservar planes/frecuencias de prima unica en cartera: `PRIMA UNICA`, `PRIMA ÚNICA`, `PU`.
- Excluir prima unica solo de reportes de cobro; cumpleaños sí debe considerarla.
- Fecha de cobro: usar fecha de pago si existe; si no existe, usar fecha de emision.
- Mensual: incluir `SEMESTRAL` y `ANUAL` del mes siguiente completo, sin importar metodo de pago.
- Semanal: cada lunes, incluir cobros de esa semana y excluir cargo automatico.
- Cargo automatico: `CARGO AUTOMATICO A TARJ CRED` y `TDD`.
- Cumpleaños: diario, deduplicado por contratante.

## Endpoints Make

Produccion:

```txt
https://carterainteligente.netlify.app/.netlify/functions/weekly-data
https://carterainteligente.netlify.app/.netlify/functions/monthly-data
https://carterainteligente.netlify.app/.netlify/functions/monthly-pending-data
https://carterainteligente.netlify.app/.netlify/functions/birthday-data
```

Para pruebas se puede forzar fecha con:

```txt
?date=YYYY-MM-DD
```

Ejemplos usados en demo:

```txt
weekly-data?date=2026-08-17
monthly-data?date=2026-08-25
monthly-pending-data?date=2026-09-04
birthday-data?date=2026-08-17
```

Ojo: si despues de la demo se restaura produccion, quitar todos los `?date=...`.

## Escenarios Make

Correo remitente de prueba:

```txt
synka.ia@outlook.com
```

Correo receptor de prueba:

```txt
fvargasmena@hotmail.com
```

Escenarios conocidos:

```txt
5970165 - Finanzas Empower Weekly Payment Reminders
5970339 - Finanzas Empower Monthly Payment Reminders
5982119 - Finanzas Empower Monthly Contact Follow Up
5970685 - Finanzas Empower Birthday Reminders
```

Configuracion esperada:

- Semanal: GET `weekly-data`, filtro `count > 0`, Outlook con `subject` y `html`, Body Content Type `HTML`, lunes 8:00 AM America/Mexico_City.
- Mensual: GET `monthly-data`, filtro `should_send_today = true` y `count > 0`, Outlook con `subject` y `html`, Body Content Type `HTML`.
- Pendientes viernes: GET `monthly-pending-data`, filtro `should_send_today = true` y `count > 0`, Outlook con `subject` y `html`, Body Content Type `HTML`.
- Cumpleaños: GET `birthday-data`, filtro `count > 0`, Outlook con `subject` y `html`, Body Content Type `HTML`, diario 9:00 AM.

## Contactados del mensual

Los botones del reporte mensual llaman:

```txt
/.netlify/functions/mark-monthly-contacted
```

Eso guarda registros en Supabase:

```txt
public.monthly_contact_tasks
```

Para revisar los contactados en Supabase:

```sql
select
  period,
  payment_date,
  holder,
  policy_number,
  plan_name,
  contacted_at
from public.monthly_contact_tasks
order by contacted_at desc;
```

Para revisar solo septiembre 2026:

```sql
select
  payment_date,
  holder,
  policy_number,
  plan_name,
  contacted_at
from public.monthly_contact_tasks
where period = '2026-09'
order by payment_date asc, holder asc;
```

## Estado de trabajo pendiente

- El mensual ya se corrigio para enviar HTML.
- El pendiente de viernes ya se corrigio para enviar HTML.
- El semanal ahora ya entrega `html` desde codigo, pero en Make hay que revisar que Outlook use el campo `html` y Body Content Type `HTML`.
- Cumpleaños funciona, pero la ultima prueba con `date=2026-08-17` devolvio `count = 0`; hay que encontrar una fecha con cumpleaños en la data actual si se quiere demo.
- Al terminar demos, restaurar los 4 escenarios Make a URLs sin `?date=...`.

## Cambios recientes importantes

- Se agrego formato HTML al endpoint `weekly-data`.
- El mail mensual tiene botones `Marcar como contactado`.
- El recordatorio de viernes lee `monthly_contact_tasks` y solo manda pendientes no marcados.
- La tarjeta de cumpleaños visual se abre desde `birthday-card` con nombre por query string.
- Se corrigieron los defaults internos para que los links usen `https://carterainteligente.netlify.app` y no el sitio viejo `intelligencefe`.
- Se separo cartera activa de reportes de cobro: Prima Unica queda en cartera y cumpleaños, pero no en mensual/semanal.
- Se ocultaron los criterios de lectura visibles en la pestaña Archivo para dejar la app mas limpia.

## Siguiente paso recomendado

1. Subir esta carpeta completa a GitHub.
2. Esperar deploy de Netlify.
3. En Make, abrir el escenario semanal y mapear el correo a `html` con Body Content Type `HTML`.
4. Ejecutar prueba del semanal.
5. Restaurar Make a URLs reales sin fechas forzadas cuando Maggie termine de revisar la demo.
