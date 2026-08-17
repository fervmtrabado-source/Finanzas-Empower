# Finanzas Empower Assistant

Asistente digital para que Maggie suba un CSV de pólizas y reciba avisos automáticos.

## Qué hace

- Lee el CSV de pólizas.
- Al abrir la app, carga la última versión guardada en Supabase.
- Maggie solo necesita abrir la app cuando quiera reemplazar o revisar el CSV.
- Conserva solo pólizas con estatus exacto `En Vigor`.
- Calcula fechas de cobro con `Fecha de pago` si existe; si no, usa `Fecha de emisión`.
- Reporte mensual: pólizas `SEMESTRAL` y `ANUAL` que cobran el mes siguiente.
- Reporte semanal: pólizas que cobran esa semana y que no son cargo automático.
- Cargo automático: `CARGO AUTOMATICO A TARJ CRED` y `TDD`.
- Cumpleaños diario: detecta cumpleaños del día.

## Arquitectura

- `outputs/`: app visual para subir CSV y revisar reportes.
- `netlify/functions/`: funciones de backend y endpoints JSON para Make.
- `supabase/schema.sql`: tablas necesarias en Supabase.
- Netlify prepara datos JSON para Make.
- Make manda los correos desde `synka.ia@outlook.com`.

El CSV incluido en el repositorio es una muestra sanitizada. Los CSV reales deben subirse desde la app desplegada y guardarse en Supabase, no en GitHub.

## Variables de entorno

Configurar en Netlify:

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MAKE_SHARED_SECRET=
```

`MAKE_SHARED_SECRET` es opcional técnicamente, pero recomendado. Si existe, Make debe enviarlo en el header `x-make-secret`.

## Endpoints para Make

Make debe leer estos endpoints y usar el JSON para enviar correos:

```txt
https://intelligencefe.netlify.app/.netlify/functions/weekly-data
https://intelligencefe.netlify.app/.netlify/functions/monthly-data
https://intelligencefe.netlify.app/.netlify/functions/birthday-data
```

Primera prueba:

```txt
De: synka.ia@outlook.com
Para: fvargasmena@hotmail.com
```

Para pruebas se puede agregar `?date=YYYY-MM-DD`. Si `MAKE_SHARED_SECRET` está configurado, enviar:

```txt
x-make-secret: valor-del-secreto
```

Cada endpoint devuelve `count`, `subject`, `text` e `items`. Los campos clave en `items` son:

```txt
payment_date
holder
policy_number
plan_name
currency
frequency
payment_method
premium_due
premium_due_label
email
phone
```

`birthday-data` devuelve una lista deduplicada por contratante y agrega `message` para cada persona.

## Escenarios en Make

- Semanal: cada lunes, leer `weekly-data`, filtrar `count > 0`, enviar `subject` y `text`.
- Mensual: diario, leer `monthly-data`, filtrar `should_send_today = true` y `count > 0`, enviar `subject` y `text`.
- Cumpleaños: diario, leer `birthday-data`, filtrar `count > 0`, enviar `subject` y `text`.

Los escenarios corren en Make aunque nadie abra la app. Los endpoints usan la última carga guardada en Supabase.
