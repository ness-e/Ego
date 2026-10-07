import zipfile, re, sys
from pathlib import Path
base=Path(r'C:\Users\Eros\VantaDB Proyect\Ego\investigacion-de-diseño')
for f in ['Ego_PRD_Blueprint_v1.docx','Arquitectura y Diseño para Ego.docx']:
    p=base/f
    try:
        with zipfile.ZipFile(p) as z:
            xml=z.read('word/document.xml').decode('utf8')
            text=re.sub(r'<[^>]+>',' ',xml)
            text=re.sub(r'\s+',' ',text)
            print('\n###',f,'\n',text[:8000])
    except Exception as e: print(e)
