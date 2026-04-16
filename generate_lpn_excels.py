from pathlib import Path
import json
import pandas as pd

ROOT = Path(r'D:\Thomas\Proyectos\LPN-web')
OUT = ROOT / 'google-sheet-import'
DATA = ROOT / 'data'
TEMPLATE = ROOT / 'formulario-lab.xlsx'
OUT.mkdir(parents=True, exist_ok=True)

react_det = pd.read_json(DATA / 'reactivos-detalle.json')
eq_det = pd.read_json(DATA / 'equipos-detalle.json')
materiales = json.loads((DATA / 'materiales.json').read_text(encoding='utf-8'))

# Catalogos
react_catalog = react_det.copy()
react_catalog.columns = ['Nombre', 'Cantidad', 'Detalle', 'Estado', 'Fecha de caducidad', 'Proyecto', 'Ubicación']
react_catalog.to_excel(OUT / 'LPN_catalogo_reactivos.xlsx', index=False)

if 'Marca' not in eq_det.columns:
    eq_det['Marca'] = ''
if 'Cantidad' not in eq_det.columns:
    eq_det['Cantidad'] = ''
eq_catalog = eq_det[['Equipo', 'Marca', 'Cantidad']].copy()
eq_catalog.to_excel(OUT / 'LPN_catalogo_equipos.xlsx', index=False)

mat_rows = []
for item in materiales:
    if isinstance(item, dict):
        mat_rows.append({
            'Insumo': item.get('nombre', ''),
            'Cantidad': item.get('cantidad', ''),
            'Detalle': item.get('detalle', '')
        })
mat_catalog = pd.DataFrame(mat_rows, columns=['Insumo', 'Cantidad', 'Detalle'])
mat_catalog.to_excel(OUT / 'LPN_catalogo_insumos.xlsx', index=False)

# Base general EXACTA al flujo actual de formulario-lab.xlsx
sheet_columns = {
    'Resumen general': ['Nombre', 'Correo institucional', 'Fecha (envío)', 'Tipo de acción', 'Observaciones', 'Descripción', 'Estado'],
    'Solicitud de Reactivos': ['Nombre', 'Fecha de solicitud de reactivo', 'Reactivo', 'Cantidad', 'Laboratorio destino', 'Tipo de actividad', 'Observaciones', 'Correo'],
    'Solicitud de Insumos': ['Nombre', 'Fecha de solicitud de insumos', 'Estado', 'Insumo', 'Fecha de devolución', 'Observaciones', 'Correo', 'Unnamed: 7'],
    'Solicitud de Equipos': ['Nombre', 'Fecha', 'Equipo', 'Fecha inicial', 'Fecha final', 'Observaciones', 'Correo'],
    'Solicitud de Almacenamiento': ['Nombre', 'Fecha', 'Descripción', 'Fecha inicial', 'Fecha final', 'Observaciones', 'Correo'],
    'Uso de Reactivo': ['Nombre', 'Fecha uso del reactivo', 'Reactivo', 'Cantidad', 'Tipo de actividad', 'Observaciones', 'Correo'],
    'Uso de Insumos': ['Nombre', 'Fecha de uso de insumos', 'Estado', 'Insumo', 'Nombre de la actividad', 'Observaciones', 'Correo'],
    'Uso de equipo': ['Nombre', 'Fecha', 'Equipo', 'Nombre de la actividad', 'Observaciones', 'Correo'],
    'Profesores': ['Nombre', 'Fecha', 'Asignatura', 'Fecha inicial', 'Fecha final', 'Hora inicial', 'Hora final', 'Cédula', 'Observaciones', 'Correo'],
    'Horas de Pasantía': ['Nombre', 'Fecha de pasantia', 'Horas', 'Observaciones', 'Correo'],
    'Uso de Laboratorio': ['Nombre', 'Fecha', 'Actividad realizada', 'Tipo', 'Observaciones', 'Correo', 'Unnamed: 6', 'Unnamed: 7'],
}

with pd.ExcelWriter(OUT / 'LPN_base_general_google_sheets.xlsx', engine='openpyxl') as writer:
    for sheet_name, cols in sheet_columns.items():
        pd.DataFrame(columns=cols).to_excel(writer, sheet_name=sheet_name[:31], index=False)

# Archivo combinado opcional con catalogos en el mismo workbook
with pd.ExcelWriter(OUT / 'LPN_base_general_y_catalogos.xlsx', engine='openpyxl') as writer:
    for sheet_name, cols in sheet_columns.items():
        pd.DataFrame(columns=cols).to_excel(writer, sheet_name=sheet_name[:31], index=False)
    eq_catalog.to_excel(writer, sheet_name='Equipos', index=False)
    react_catalog.to_excel(writer, sheet_name='Reactivos', index=False)
    mat_catalog.to_excel(writer, sheet_name='Insumos', index=False)

(Path(OUT) / 'README_IMPORTACION.txt').write_text(
    '\n'.join([
        'CARPETA DE IMPORTACION LPN',
        '',
        'IMPORTANTE:',
        'La base de guardado ahora fue ajustada para seguir la estructura de formulario-lab.xlsx.',
        '',
        'ARCHIVOS:',
        '1) LPN_base_general_google_sheets.xlsx',
        '   Base principal VACIA con la misma estructura de hojas y columnas que formulario-lab.xlsx.',
        '',
        '2) LPN_base_general_y_catalogos.xlsx',
        '   Igual que la anterior, pero ademas incluye hojas Equipos, Reactivos e Insumos con catalogos cargados.',
        '',
        '3) Catalogos individuales:',
        '   - LPN_catalogo_equipos.xlsx',
        '   - LPN_catalogo_reactivos.xlsx',
        '   - LPN_catalogo_insumos.xlsx',
        '',
        'RECOMENDACION:',
        'Sube LPN_base_general_google_sheets.xlsx como base de registros.',
        'Y si quieres manejar catalogos por separado, sube tambien los 3 catalogos individuales.',
        'Si prefieres todo en una sola hoja, usa LPN_base_general_y_catalogos.xlsx.',
        '',
        'DESPUES COMPARTEME:',
        '- ID del sheet base',
        '- ID del/los sheets de catalogos (o confirma que usaste el combinado)',
        '- URL del Web App de Apps Script',
        '- ID de carpeta de Google Drive para adjuntos',
        '- correo admin',
    ]),
    encoding='utf-8'
)

print('REGENERATED', OUT)
