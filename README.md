# StyleSense web portal

The web project is the StyleSense portal. It is intentionally not a second
consumer wardrobe app. The mobile app owns wardrobe capture and daily outfit
use; this web project owns the public overview, authentication, admin
operations, and research/evaluation workspace.

## Start the portal

From this directory:

```powershell
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173/`.

The portal landing page does not require the Express API or Docker to render.

## Optional local services

Start the Express API only when working on API-backed operations:

```powershell
npm run server:dev
```

The API listens on `http://localhost:5000` and exposes `/health`.

The image-analysis service is optional infrastructure for image-processing
work. Docker is not part of the current workflow. If it is needed locally,
run it directly from its directory:

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API can use it when `CNN_ANALYSIS_URL=http://localhost:8000/analyze` is
configured. Run the ML commands from `ml-service`, not the repository root.

## Validate

```powershell
npm run build
```

The repository may contain legacy mobile-owned screen files for reference, but
they are no longer registered as web portal routes.
