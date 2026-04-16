from pathlib import Path
import json

root = Path(r'D:\Thomas\Proyectos\LPN-web')

replacements = {
    'Laboratorio de Química 1 de Docencia': 'LPN - Laboratorio de Productos Naturales',
    'Laboratorio Química 1 de Docencia': 'LPN - Laboratorio de Productos Naturales',
    'LQ1D': 'LPN',
    'LQ1': 'LPN',
    "resource_name: 'LQ1D / Laboratorio de Quimica 1'": "resource_name: 'LPN / Laboratorio de Productos Naturales'",
    "[LQ1D]": "[LPN]",
    'Saludos,<br>Laboratorio de Química 1 de Docencia': 'Saludos,<br>LPN - Laboratorio de Productos Naturales',
    'Saludos,<br>Laboratorio de Qu\u00e9mica 1 de Docencia': 'Saludos,<br>LPN - Laboratorio de Productos Naturales',
}

for path in root.rglob('*'):
    if path.suffix.lower() not in {'.html', '.js', '.md', '.json', '.css'}:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        text = path.read_text(encoding='latin-1')
    original = text
    for a, b in replacements.items():
        text = text.replace(a, b)
    if path.name == 'index.html':
        text = text.replace('Bienvenido/a al LPN', 'Bienvenido/a al LPN - Laboratorio de Productos Naturales')
    if text != original:
        path.write_text(text, encoding='utf-8')

# Update the JSON news with lab mention if present
news = root / 'news.json'
if news.exists():
    try:
        data = json.loads(news.read_text(encoding='utf-8'))
        changed = False
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    for key in ('title', 'content'):
                        if key in item and isinstance(item[key], str):
                            old = item[key]
                            item[key] = old.replace('LQ1D', 'LPN').replace('Laboratorio de Química 1 de Docencia', 'LPN - Laboratorio de Productos Naturales').replace('Laboratorio Química 1 de Docencia', 'LPN - Laboratorio de Productos Naturales')
                            changed = changed or (item[key] != old)
        if changed:
            news.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    except Exception:
        pass

print('UPDATED_TEXTS')
