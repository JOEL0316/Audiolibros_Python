# Desplegar en Render (frontend + backend)

Render permite tener **dos servicios** del mismo repositorio: API Python y web estática.

## Paso 1 — Subir a GitHub

```bash
git push origin main
```

## Paso 2 — Crear Blueprint en Render

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**
2. Conecta el repo `Audiolibros_Python`
3. Render leerá `render.yaml` y creará:
   - **audiolibro-tts** — API FastAPI (Python)
   - **audiolibro-app** — PWA estática

## Paso 3 — Variables de entorno

### Servicio `audiolibro-tts` (API)

| Variable | Valor |
|----------|--------|
| `CORS_ORIGINS` | `*` o `https://audiolibro-app.onrender.com` |
| `TTS_VOICE` | `es-ES-ElviraNeural` |

Copia la URL del API, ej: `https://audiolibro-tts.onrender.com`

### Servicio `audiolibro-app` (web)

| Variable | Valor |
|----------|--------|
| `VITE_API_URL` | `https://audiolibro-tts.onrender.com` |

**Importante:** tras cambiar `VITE_API_URL`, haz **Manual Deploy → Clear build cache**.

## Paso 4 — Probar

1. Abre la URL de `audiolibro-app`
2. Sube un PDF → Reproducir
3. En móvil: instala la PWA (banner o menú del navegador)
4. Con pantalla bloqueada: controles en el reproductor del sistema

## Notas

- El plan **free** de Render apaga el API tras inactividad (~50 s de arranque en la primera petición).
- **iOS**: instala con Safari → Compartir → Añadir a inicio. El audio en segundo plano funciona mejor en PWA instalada.
- **Android**: Chrome → Instalar aplicación. Media Session muestra controles en bloqueo.

## Despliegue manual (sin Blueprint)

### API

- Tipo: **Web Service**
- Root: `server`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Plan: **starter** (Render ya no ofrece `free` para Web Service)

### Web

- Tipo: **Static Site**
- Build: `npm ci --prefix client && npm run build --prefix client`
- Publish: `client/dist`
- Env: `VITE_API_URL=https://tu-api.onrender.com`
