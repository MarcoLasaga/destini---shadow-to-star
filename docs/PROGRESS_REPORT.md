# StyleSense progress report

## Current implementation

The web (`master`) and mobile (`mobile-dev`) worktrees share the same Supabase
`wardrobe_items` table and `wardrobe-images` Storage bucket.

- Web wardrobe creation, listing, updating, favourites, wear tracking and image
  upload are handled by the Express API.
- The API now forwards the signed-in user JWT to Supabase. This fixes the RLS
  failure that previously prevented web inserts and reads.
- Mobile has a functional **Add Clothes** screen: camera/library selection,
  image normalization, Storage upload, and insert into the shared wardrobe.
- Both clients request image analysis after an image is selected and use the
  response only as editable form suggestions.
- `ml-service/` is a local PyTorch ResNet-50 baseline that returns category,
  color, style and confidence. It is operational infrastructure, not yet a
  thesis-accuracy fashion model.

## Required one-time Supabase update

In the Supabase SQL Editor, run:

`supabase/migrations/20260730193346_repair_wardrobe_rls_and_storage.sql`

This replaces existing RLS and Storage policies without deleting wardrobe rows
or images. Restart the API afterward. The migration requires authenticated
requests to own `wardrobe_items.user_id` and Storage objects under
`<user-uuid>/...`.

## Local setup

### 1. Check out both worktrees

```powershell
git clone https://github.com/MarcoLasaga/destini---shadow-to-star.git
cd destini---shadow-to-star
git worktree add ..\stylesense-mobile mobile-dev
```

### 2. Configure local-only environment files

```powershell
Copy-Item server\.env.example server\.env
Copy-Item ..\stylesense-mobile\.env.example ..\stylesense-mobile\.env
```

Fill in the placeholder Supabase URL and publishable key locally. Do not commit
either `.env` file. For a physical phone, set `EXPO_PUBLIC_API_URL` to the
computer's LAN IP, not `localhost`.

### 3. Install and run

```powershell
# Web/API worktree
npm ci
npm run server:dev
# separate terminal
npm run dev

# Optional ML service, in a third terminal
cd ml-service
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Mobile worktree
cd ..\stylesense-mobile
npm ci
npm start
```

The API reads `CNN_ANALYSIS_URL=http://localhost:8000/analyze`. Verify the ML
service first at `http://localhost:8000/health`. Docker is not required for the
current portal and service workflow; install the Python dependencies from
`ml-service/requirements.txt` when running image analysis locally.

## Validation completed

- `npm run build` in the web/API worktree
- `npx tsc -p server/tsconfig.json`
- `npx tsc --noEmit` in the mobile worktree
- Python source compilation for `ml-service`

## Remaining work

1. Fine-tune or replace the ImageNet ResNet baseline with a labeled fashion
   dataset/checkpoint; its current category and style confidence is limited.
2. Implement real K-means clustering, content-based filtering, collaborative
   filtering, and recommendation history. Current recommendation UI is mostly
   presentation/mock data.
3. Add automated API, RLS, mobile and ML accuracy tests before deployment.

## Security note

No private key, JWT secret, or local environment file is tracked. Use a
publishable Supabase key only in clients; never expose a service-role key.
