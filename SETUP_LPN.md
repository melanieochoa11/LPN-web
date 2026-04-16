# SETUP LPN - Laboratorio de Productos Naturales

## Estado actual
- Frontend clonado desde LQ1 y adaptado a **LPN - Laboratorio de Productos Naturales**.
- Catálogos locales generados desde `C:\Users\User\Desktop\reactivos-equipos.xlsx` en la carpeta `data/`.
- Materiales dejados como placeholder para completar después.
- `js/api.js` funciona sin backend publicado: carga catálogos locales y guarda envíos temporalmente en `localStorage` del navegador si no existe Web App.

## Archivos de datos creados
- `data/reactivos.json`
- `data/reactivos-detalle.json`
- `data/equipos.json`
- `data/equipos-detalle.json`
- `data/materiales.json`

## Backend recomendado en Google
Crear una hoja de cálculo nueva para LPN con estas pestañas:

1. `Resumen general`
2. `Solicitud de Equipos`
3. `Uso de equipo`
4. `Solicitud de Insumos`
5. `Uso de Insumos`
6. `Solicitud de Reactivos`
7. `Uso de Reactivo`
8. `Solicitud de Almacenamiento` (opcional)
9. `Uso de Laboratorio`
10. `Horas de Pasantía` (opcional)
11. `Profesores` (opcional)
12. `Equipos`
13. `Reactivos`
14. `Insumos`

## Poblar catálogos
- Pestaña `Equipos`: usar datos de `data/equipos-detalle.json`
- Pestaña `Reactivos`: usar datos de `data/reactivos-detalle.json`
- Pestaña `Insumos`: usar datos de `data/materiales.json`

## Apps Script
1. Crear un proyecto de Apps Script nuevo vinculado a la hoja nueva.
2. Reemplazar el contenido del proyecto por `appsScript.js`.
3. Cambiar en `appsScript.js`:
   - `ADMIN_EMAIL`
   - `DRIVE_FOLDER_ID`
   - `SS_GENERAL_ID`
   - `SS_EQUIPOS_ID`
   - `SS_REACTIVOS_ID`
   - `SS_INSUMOS_ID`
4. Implementar como Web App (`/exec`).
5. Guardar la URL publicada.
6. En el navegador, ejecutar en consola:
   ```js
   localStorage.setItem('webAppUrl', 'PEGAR_AQUI_URL_DEL_WEB_APP')
   ```
   o modificar `WEB_APP_URL_DEFAULT` en `js/api.js`.

## Nota sobre materiales
Actualmente `data/materiales.json` contiene placeholders para que la sección exista:
- Vidrio de reloj
- Vaso de precipitación 250 mL
- Probeta 100 mL

Luego puedes reemplazarlos por el catálogo real del LPN.
