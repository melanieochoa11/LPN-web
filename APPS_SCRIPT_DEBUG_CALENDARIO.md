# Debug de calendario para Apps Script (copiar/pegar)

## 1) Reemplaza la función `createEquipmentCalendarEvent_(data)` por esta

```javascript
function createEquipmentCalendarEvent_(data) {
  try {
    Logger.log('createEquipmentCalendarEvent_ data: ' + JSON.stringify(data));

    if (!CALENDAR_ID) {
      Logger.log('Sin CALENDAR_ID');
      return;
    }

    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) {
      Logger.log('No se encontro el calendario con ID: ' + CALENDAR_ID);
      return;
    }

    const equipo = String(data.equipo || '').trim();
    const nombre = String(data.nombre || '').trim();
    const correo = String(data.correo || '').trim();
    const actividad = String(data.actividad || '').trim();
    const descripcion = String(data.descripcion || '').trim();
    const observaciones = String(data.observaciones || '').trim();
    const horaInicio = String(data.horaInicio || '').trim();
    const horaFin = String(data.horaFin || '').trim();
    const startDate = parseCalendarDate_(data.fechaInicial);
    const endDate = parseCalendarDate_(data.fechaFinal) || startDate;

    Logger.log('equipo=' + equipo);
    Logger.log('fechaInicial raw=' + data.fechaInicial);
    Logger.log('fechaFinal raw=' + data.fechaFinal);
    Logger.log('horaInicio=' + horaInicio);
    Logger.log('horaFin=' + horaFin);
    Logger.log('startDate=' + startDate);
    Logger.log('endDate=' + endDate);

    if (!equipo || !startDate || !endDate) {
      Logger.log('Abortado: faltan datos obligatorios');
      return;
    }

    const title = `Reserva equipo: ${equipo}`;
    const details = [
      nombre ? `Usuario: ${nombre}` : '',
      correo ? `Correo: ${correo}` : '',
      actividad ? `Actividad: ${actividad}` : '',
      descripcion ? `Descripción: ${descripcion}` : '',
      horaInicio ? `Hora inicio: ${horaInicio}` : '',
      horaFin ? `Hora fin: ${horaFin}` : '',
      observaciones ? `Observaciones: ${observaciones}` : ''
    ].filter(Boolean).join('\n');

    if (horaInicio && horaFin && sameDay_(startDate, endDate)) {
      const start = combineDateAndTime_(startDate, horaInicio);
      const end = combineDateAndTime_(endDate, horaFin);

      Logger.log('Evento mismo dia start=' + start + ' end=' + end);

      if (start && end && end > start) {
        const event = calendar.createEvent(title, start, end, {
          description: details,
          guests: correo || undefined,
          sendInvites: false
        });
        try { event.setColor(CalendarApp.EventColor.RED); } catch (_) {}
        Logger.log('Evento creado OK: ' + event.getId());
        return;
      } else {
        Logger.log('Horas invalidas para evento mismo dia');
      }
    }

    const start = combineDateAndTime_(startDate, horaInicio || '07:00') || startDate;
    const endFallbackBase = sameDay_(startDate, endDate) ? startDate : endDate;
    const end = combineDateAndTime_(endFallbackBase, horaFin || '20:00') ||
      new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 20, 0, 0, 0);

    Logger.log('Evento fallback start=' + start + ' end=' + end);

    const event = calendar.createEvent(title, start, end, {
      description: details,
      guests: correo || undefined,
      sendInvites: false
    });
    try { event.setColor(CalendarApp.EventColor.RED); } catch (_) {}
    Logger.log('Evento fallback creado OK: ' + event.getId());

  } catch (err) {
    Logger.log('ERROR createEquipmentCalendarEvent_: ' + err);
    Logger.log('STACK: ' + (err && err.stack ? err.stack : 'sin stack'));
  }
}
```

## 2) Agrega este log al inicio de `doPost(e)`

Debe quedar así:

```javascript
function doPost(e) {
  Logger.log('PARAMS doPost: ' + JSON.stringify(e.parameter || {}));
  const ss = SpreadsheetApp.openById(SS_GENERAL_ID);
  const params = e.parameter || {};
```

## 3) Luego

1. Guardar
2. Deploy > Manage deployments > Edit > Update
3. Hacer una reserva real desde la web
4. Abrir `Executions` en Apps Script
5. Copiar los logs que salgan

## 4) Qué archivo abrir aquí

Abrir este archivo:

`D:\Thomas\Proyectos\LPN-web\APPS_SCRIPT_DEBUG_CALENDARIO.md`

Y copiar desde aquí al Apps Script.
