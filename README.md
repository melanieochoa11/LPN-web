# LPN - Laboratorio de Productos Naturales – Rediseño Web

Este repositorio contiene una propuesta de refactorización del sitio web del **Laboratorio de Química 1 de Docencia** (LPN) para separar la lógica por secciones, optimizar el rendimiento y mejorar la usabilidad.  La integración con Google Sheets y Google Apps Script se mantiene, pero se añade soporte para envíos múltiples y adjuntos.

## Estructura de archivos

- **index.html** – Página de inicio con acceso a las secciones *Registro de uso*, *Equipos*, *Material de laboratorio* y *Reactivos*.  Incluye un encabezado con logos y un diseño ligero tipo *glassmorphism*.
- **registro-uso.html** / **registro-uso.js** – Formulario de registro de uso dividido en tres pasos: selección del tipo (Práctica/Cátedra, Pasantías, Tesis/Proyectos), datos específicos y datos generales.  Usa Flatpickr para seleccionar horas y fechas.
- **equipos.html** / **equipos.js** – Gestión de solicitudes y uso de equipos.  Permite buscar un equipo, seleccionar una acción (Solicitud o Registro), añadir varios equipos a un carrito y finalizar con un único envío.
- **material.html** / **material.js** – Flujo similar al de equipos pero para materiales de laboratorio.  Incluye cantidad y rango de fechas para solicitudes y registros.
- **reactivos.html** / **reactivos.js** – Registro y solicitud de reactivos.  Permite especificar unidades, marcar reactivos controlados y subir un archivo de solicitud.  El archivo adjunto se envía únicamente al administrador.
- **api.js** – Módulo JavaScript que encapsula las llamadas al Web App de Google Apps Script.  Implementa almacenamiento en caché de las listas (reactivos, insumos y equipos) en *localStorage* con un TTL de 12 horas, wrappers para obtener disponibilidad y un método genérico `sendRequest` para envíos simples o múltiples.
- **css/app.css** – Estilos compartidos del frontend (tokens, botones, tarjetas, inputs, toasts).
- **js/ui-kit.js** – Utilidades UI compartidas (toasts, validación requerida, estados de carga, imágenes con fallback).
- **appsScript.js** – Versión actualizada del script de Google Apps Script.  Incluye funciones para manejar envíos múltiples (`processMultiRequest_`), decodificar adjuntos y enviar correos de confirmación al usuario y al administrador.  También conserva `processSingleRequest_` para retrocompatibilidad con el flujo antiguo.

## Despliegue del Web App

1. **Crear o actualizar la hoja de cálculo**: asegúrate de tener una hoja de cálculo con las siguientes pestañas (pueden llamarse distinto, pero actualiza los nombres en `appsScript.js` en consecuencia):
   - `Resumen general`
   - `Solicitud de Equipos`
   - `Uso de equipo`
   - `Solicitud de Insumos`
   - `Uso de Insumos`
   - `Solicitud de Reactivos`
   - `Uso de Reactivo`
   - `Solicitud de Almacenamiento` (opcional si utilizas almacenamiento)
   - `Horas de Pasantía`, `Profesores`, `Uso de Laboratorio` (sólo si reutilizas el flujo antiguo)

2. **Actualizar IDs de hojas**: en `appsScript.js` aparecen varias llamadas a `openById(...)` para leer listas de datos (equipos, reactivos, insumos).  Sustituye los IDs por los de tus propios documentos:

```js
const ssGeneral      = SpreadsheetApp.openById('14x0fat7x18QlAN9kKYgNYJkAvw0L1OkyEAS0yLukR5Q');
const sheetEquiposData   = SpreadsheetApp.openById('1VYnN1yNZi5UWez8frYHOH8dFC1iicV75wAa0Hcm5LuA').getSheetByName('Equipos');
const sheetReactivosData = SpreadsheetApp.openById('1EKfr1vbmpyUbgKMVbv6_lL4FuIxlPpLOaFhEeZEApSo').getSheetByName('Reactivos');
const sheetInsumosData   = SpreadsheetApp.openById('1xX56wX8DfJhyUXpi9lUBN78cQqhuEnLIPaO8ZdKlrrY').getSheetByName('Insumos');
```

3. **Configurar variables**: dentro de `appsScript.js` hay dos constantes que debes modificar:

```js
const ADMIN_EMAIL = 'melani.ochoa@ikiam.edu.ec';      // Correo al que se enviarán las notificaciones administrativas
const DRIVE_FOLDER_ID = '1W--folderId';                // ID de la carpeta en Drive donde se guardarán adjuntos
```

4. **Desplegar como Web App**: en el editor de Apps Script:
   - Copia el contenido de `appsScript.js` en tu proyecto de Apps Script.
   - Accede a **Publicar → Implementar como aplicación web...**
   - Ejecuta el script como tú mismo y establece el acceso a “cualquiera, incluso anónimo”.
   - Obtén la URL del Web App y actualiza el valor de `WEB_APP_URL` en `api.js` y en los archivos `.html` si fuese necesario.

5. **Subir el frontend**: coloca los archivos HTML y JS en un servidor estático (GitHub Pages, Netlify, Vercel, etc.).  Asegúrate de que las rutas relativas a `api.js` y a las imágenes sean correctas.  Para las imágenes de equipos, materiales y reactivos crea carpetas `imagenes/equipos`, `imagenes/material` y `imagenes/reactivos` con nombres de archivo en *slug* (minúsculas, sin tildes y espacios cambiados por guiones).  Si falta alguna imagen, se mostrará un marcador de posición.

## Variables y configuración

### Correo del administrador

El correo al que se envían las solicitudes con adjuntos se define en `appsScript.js` mediante la constante `ADMIN_EMAIL`.  Puedes cambiarlo a la cuenta que prefieras.

### Carpeta de Drive para adjuntos

Los archivos subidos (por ejemplo, solicitudes de reactivo) se guardan en una carpeta de Drive cuyo ID se define en `DRIVE_FOLDER_ID`.  Crea una carpeta en tu Drive, copia su ID de la URL y actualiza la constante.  Estos archivos se adjuntan únicamente en el correo al administrador.

### Hoja de cálculo general

La hoja de cálculo identificada por `'14x0fat7x18QlAN9kKYgNYJkAvw0L1OkyEAS0yLukR5Q'` es la que contiene las pestañas con los registros de solicitudes y usos.  Si utilizas una distinta, cambia este ID en `appsScript.js`.

## Consideraciones de rendimiento

- Las listas de reactivos, insumos y equipos se cargan mediante `api.js` y se almacenan en *localStorage* durante 12 horas para evitar consultas repetidas al servidor.
- Las páginas están divididas y cada una carga únicamente la lógica y las librerías que necesita.  Por ejemplo, Flatpickr se importa solo en las páginas que requieren selección de fechas.
- Las imágenes se cargan con el atributo `loading="lazy"` y, en el caso de los catálogos de equipos/materiales/reactivos, se utilizan *slugs* para determinar el nombre del archivo.  Si una imagen no existe, se recurre a un marcador de posición.

## Accesibilidad y usabilidad

Se han usado etiquetas `label` asociadas a sus respectivos controles (`input`, `select`, `textarea`) para mejorar la accesibilidad.  Los botones tienen estados de foco y se pueden activar mediante teclado.  Las validaciones en el cliente muestran mensajes antes de enviar los datos al servidor.

## Compatibilidad con el código existente

El nuevo `appsScript.js` mantiene una función `processSingleRequest_` que replica el comportamiento del script original.  Esto garantiza que las solicitudes antiguas (procedentes de la versión previa del sitio) sigan almacenándose correctamente.  El nuevo flujo (cuando se envían varios ítems a la vez) se detecta mediante el parámetro `items` y se gestiona en `processMultiRequest_`.
