# Finanzas Empower Assistant

Asistente digital para que Maggie suba un CSV de pólizas y reciba avisos automáticos.

## Qué hace

- Lee el CSV de pólizas.
- Conserva solo pólizas con estatus exacto `En Vigor`.
- Calcula fechas de cobro con `Fecha de pago` si existe; si no, usa `Fecha de emisión`.
- Reporte mensual: pólizas `SEMESTRAL` y `ANUAL` que cobran el mes siguiente.
- Reporte semanal: pólizas que cobran esa semana y que no son cargo automático.
- Cargo automático: `CARGO AUTOMATICO A TARJ CRED` y `TDD`.
- Cumpleaños diario: detecta cumpleaños del día.

## Arquitectura

- `outputs/`: app visual para subir CSV y revisar reportes.
- `netlify/functions/`: funciones de backend y jobs programados.
- `supabase/schema.sql`: tablas necesarias en Supabase.
- Resend manda emails.
- WhatsApp queda preparado para conectar Twilio/WhatsApp Business en la siguiente fase.

El CSV incluido en el repositorio es una muestra sanitizada. Los CSV reales deben subirse desde la app desplegada y guardarse en Supabase, no en GitHub.

## Variables de entorno

Configurar en Netlify:

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
MAIL_FROM=Finanzas Empower <avisos@finanzasempower.com>
MAGGIE_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
MAGGIE_WHATSAPP_TO=whatsapp:+52...
```

Las variables de Twilio son opcionales hasta activar WhatsApp real.

## Jobs

- `weekly-report`: lunes a las 8:00 AM de Ciudad de México.
- `monthly-report`: diario a las 8:00 AM de Ciudad de México, pero solo envía cuando falten 7 días para iniciar el mes siguiente.
- `birthday-report`: diario a las 9:00 AM de Ciudad de México.
