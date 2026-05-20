# Audiolibro PDF — Texto a audio (PWA)

Aplicación web progresiva (PWA) para cargar libros en PDF, extraer el texto y escucharlos como audiolibro.

## Stack recomendado (implementado)

| Capa | Tecnología | Motivo |
|------|------------|--------|
| **Frontend** | React 19 + TypeScript + Vite | Rápido, tipado, ecosistema maduro |
| **PWA** | `vite-plugin-pwa` | Instalable en móvil, caché offline de la app |
| **PDF** | `pdfjs-dist` (Mozilla PDF.js) | Extracción de texto en el navegador, sin subir el archivo al servidor |
| **TTS local** | Web Speech API | Funciona sin backend; ideal offline parcial |
| **TTS calidad** | FastAPI + `edge-tts` | Voces neurales gratuitas (Microsoft Edge), mejor para audiolibros |
| **Persistencia** | IndexedDB (`idb`) | Progreso, libros y metadatos en el dispositivo |

### Alternativas que puedes evaluar más adelante

- **Piper / Coqui TTS**: TTS 100 % local en servidor (más pesado, sin depender de red).
- **Whisper**: solo si añades entrada por voz o transcripción de audio.
- **Capacitor**: si más adelante necesitas notificaciones nativas o reproducción en segundo plano estricta en iOS.

## Estructura del proyecto

```
Traductor_texto_a_audio/
├── client/          # PWA React (interfaz, PDF, reproductor)
├── server/          # API opcional (síntesis de voz con edge-tts)
├── .env.example
└── package.json     # Scripts raíz
```

## Requisitos

| Herramienta | Versión mínima | Uso |
|-------------|----------------|-----|
| **Node.js** | 20 LTS | Frontend / PWA (`client/`) |
| **Python** | 3.10+ | Solo si usas TTS en servidor (`server/`) |
| **Navegador** | Reciente | Chrome, Edge o Firefox recomendados |

Opcional: [nvm](https://github.com/nvm-sh/nvm) — en la raíz hay `.nvmrc` con `20`.

---

## Instalación y ejecución (guía completa)

### Paso 0 — Clonar o abrir el proyecto

```bash
cd /home/joeldlcr/Documentos/Traductor_texto_a_audio
```

### Paso 1 — Variables de entorno

```bash
cp .env.example client/.env
```

Edita `client/.env` si el backend no está en `http://localhost:8000`:

```env
VITE_API_URL=http://localhost:8000
```

---

### Paso 2 — Frontend (obligatorio)

Elige **una** opción: **pnpm** (más seguro por defecto) o **npm** (estándar, con endurecimiento manual).

#### Opción A — pnpm 10+ (recomendado por seguridad)

pnpm desactiva scripts post-install por defecto; solo se ejecutan si los apruebas explícitamente.

```bash
# Instalar pnpm (una vez en el sistema)
corepack enable
corepack prepare pnpm@latest --activate

cd client
pnpm install --frozen-lockfile   # si existe pnpm-lock.yaml
# Primera vez sin lockfile:
# pnpm install

pnpm run dev
```

Si el build pide aprobar scripts de confianza (p. ej. `esbuild`):

```bash
pnpm approve-builds   # revisa la lista y aprueba solo lo necesario
pnpm run build
```

#### Opción B — npm (con buenas prácticas)

Usa siempre el **lockfile** del repo (`client/package-lock.json`) y preferiblemente **`npm ci`** (instalación determinista, sin sorpresas en versiones).

```bash
cd client

# Endurecimiento opcional (copia y ajusta)
cp ../.npmrc.example .npmrc

npm ci
npm audit
npm run dev
```

> **Sobre `ignore-scripts`:** reduce mucho el riesgo de gusanos en `postinstall`, pero puede romper herramientas que descargan binarios (esbuild/Vite). Si `npm run build` falla tras activarlo, quita `ignore-scripts` en `.npmrc` o usa pnpm y aprueba solo paquetes concretos.

Configuración global opcional en tu máquina (no obligatoria para este proyecto):

```bash
npm config set ignore-scripts true
npm config set fund false
```

Para **producción / CI**, no uses `npm install` suelto:

```bash
cd client
npm ci
npm run build
npm run preview   # prueba local del build
```

---

### Paso 3 — Servidor TTS (opcional, mejor voz)

Solo si quieres **«Voz del servidor»** en ajustes (⚙). Abre **otra terminal**:

```bash
cd server
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Comprueba: http://localhost:8000/health → `{"status":"ok"}`

En la PWA: ⚙ → Motor de voz → **Servidor (mejor calidad)**.

---

### Paso 4 — Ejecutar desde la raíz (atajos)

Con dependencias ya instaladas en `client/`:

```bash
# Terminal 1 — frontend
npm run dev

# Terminal 2 — backend (opcional)
npm run dev:server
```

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Desarrollo en http://localhost:5173 |
| `npm run build` | Genera PWA en `client/dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run dev:server` | API TTS en puerto 8000 |

**Móvil en la misma red WiFi:**

```bash
cd client && npm run dev -- --host
```

Entra desde el teléfono: `http://IP_DE_TU_PC:5173` → Instalar / Añadir a inicio.

---

### Seguridad en dependencias (resumen)

| Práctica | npm | pnpm |
|----------|-----|------|
| Instalación reproducible | `npm ci` + `package-lock.json` | `pnpm install --frozen-lockfile` |
| Bloquear scripts maliciosos | `ignore-scripts=true` en `.npmrc` | Por defecto; `pnpm approve-builds` |
| Auditar | `npm audit` | `pnpm audit` |
| No actualizar a ciegas | No borrar el lockfile | Igual |

Herramientas extra (opcionales): [Socket](https://socket.dev), Xygeni — detectan comportamiento sospechoso que `npm audit` no cubre.

Estado actual del cliente: tras `npm audit` en el lockfile incluido → **0 vulnerabilidades conocidas** (revisa de nuevo tras cada actualización de paquetes).

---

### Desplegar en Render (frontend + backend — recomendado)

Guía completa: [docs/RENDER.md](docs/RENDER.md)

Resumen: conecta el repo en Render → Blueprint (`render.yaml`) → configura `VITE_API_URL` y `CORS_ORIGINS` → redeploy.

### Desplegar en Netlify (solo frontend)

El frontend PWA se despliega en Netlify; el backend Python (TTS) va aparte (Render, Railway, etc.).

**Opción 1 — Desde GitHub (recomendado)**

1. Sube el repo a https://github.com/JOEL0316/Audiolibros_Python
2. En [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → GitHub
3. Elige el repo; Netlify detectará `netlify.toml` automáticamente
4. **Site settings → Environment variables** (opcional):
   - `VITE_API_URL` = URL pública de tu API TTS (si la tienes)
5. **Deploy site**

**Opción 2 — CLI local**

```bash
npm install -g netlify-cli
netlify login
cd /ruta/al/proyecto
netlify init    # enlaza o crea sitio
netlify deploy --prod --build
```

Sin `VITE_API_URL`, la app usa voz del navegador o intenta el fallback al servidor si está configurado.

---

### Instalar como PWA en el móvil

1. Build: `cd client && npm run build` (o `pnpm run build`).
2. Sirve `client/dist` (hosting o `npm run preview -- --host`).
3. Chrome/Android: menú → **Instalar aplicación**.
4. iOS/Safari: Compartir → **Añadir a pantalla de inicio**.

## Flujo de uso

1. Sube un PDF.
2. La app extrae el texto por páginas (en tu dispositivo).
3. Elige modo de voz: navegador (rápido, sin servidor) o servidor (mejor calidad).
4. Reproduce, pausa y salta de página; el progreso se guarda en IndexedDB.

## Limitaciones conocidas

- PDFs escaneados (solo imagen) **no** tienen texto extraíble sin OCR (no incluido en v1).
- Web Speech API varía por navegador y sistema operativo.
- Reproducción en segundo plano en iOS depende de las políticas del navegador/PWA.

## Scripts útiles

```bash
npm run dev          # Solo frontend
npm run dev:server   # Solo API (desde raíz, requiere venv)
npm run build        # Build producción PWA
```

## Licencia

MIT — uso libre para proyectos personales.
