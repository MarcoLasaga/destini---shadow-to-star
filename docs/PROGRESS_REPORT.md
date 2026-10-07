# StyleSense progress report

## Progress update — 24 August 2026

### Dataset review and CNN readiness workflow

The admin dashboard now provides a controlled review workflow for images
uploaded from the mobile app. Both clients use the same Supabase project,
`wardrobe_items` table, and `wardrobe-images` Storage bucket.

- New dataset review metadata tracks `PENDING`, `APPROVED`, and `REJECTED`
  uploads, reviewer identity, review time, notes, and an optional dataset split.
- The dashboard verifies the authenticated administrator is exactly
  `admin@stylesense.com` and also has the `admin` role in `user_roles`.
- The CNN Dataset Readiness panel shows approved, pending, and rejected counts
  for TOP, BOTTOM, SHOES, OUTERWEAR, and ACCESSORIES.
- The review queue has per-category filters, image previews, submitted clothing
  descriptions, and an expandable rubric. The rubric suggests approval or
  rejection but leaves the final decision to the administrator.
- The rubric checks for an image, descriptive name, and metadata, while asking
  the administrator to verify focus, category correctness, and duplicates.
- Approved images can be exported through `ml-service/export_dataset.py`.
- `ml-service/train.py` now requires 200 images per category by default and
  creates its own stratified validation split. Training should not begin until
  every category reaches the approved target.

### Required Supabase update for this workflow

Run the following migration in the Supabase SQL Editor before opening the
dataset panel:

`supabase/migrations/20260824120000_add_dataset_review_workflow.sql`

Also ensure `admin@stylesense.com` has the `admin` role by running:

`supabase/assign_admin_role.sql`

Restart the API after applying the migration. If the API reports that
`wardrobe_items.dataset_status` does not exist, the migration has not been
applied to the active Supabase project.

### Intended training sequence

1. Upload images from the mobile app.
2. Review them in the web admin dashboard.
3. Approve only correctly labeled, clear, non-duplicate images.
4. Wait until all five categories have at least 200 approved images.
5. Export the approved images into `ml-service/dataset`.
6. Run the CNN training script and review validation macro-F1.

Training is intentionally separate from review. A user upload is not
automatically a valid training example, and a high total image count does not
compensate for a missing category or poor labels.

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
- `npx tsc -b` after the dataset review UI changes
- `npx tsc --noEmit` in the mobile worktree
- Python source compilation for `ml-service`

## Remaining work

1. Apply and verify the dataset-review migration in the production Supabase
   project.
2. Collect and review enough images to reach 200 approved images per category,
   then export and fine-tune or replace the ImageNet ResNet baseline.
3. Add automated API, RLS, mobile and ML accuracy tests before deployment.
4. Implement real K-means clustering, content-based filtering, collaborative
   filtering, and recommendation history. Current recommendation UI is mostly
   presentation/mock data.

## Security note

No private key, JWT secret, or local environment file is tracked. Use a
publishable Supabase key only in clients; never expose a service-role key.
