import os
import sys
import asyncio
import threading
from pathlib import Path

# 1. CRITICAL FOR ZEROGPU: `import spaces` MUST run before importing `torch` or `app.main`
try:
    import spaces  # type: ignore[import-not-found]
except ImportError:
    spaces = None

try:
    import gradio as gr  # type: ignore[import-not-found]
except ImportError:
    gr = None  # type: ignore[assignment]

# 2. Ensure both `/app` and `/app/app` are on sys.path so `kmeans_color` and `app.main` resolve
ROOT_DIR = Path(__file__).resolve().parent
APP_DIR = ROOT_DIR / "app"
for _p in (str(ROOT_DIR), str(APP_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import app.main as main_module
fastapi_app = main_module.app

# 3. Define a literal @spaces.GPU function wired to a Gradio event handler so ZeroGPU's startup scan passes
if spaces is not None:
    @spaces.GPU
    def gpu_status_check(ping: str = "status") -> str:
        model_ok = getattr(main_module, "MODEL", None) is not None
        rembg_ok = getattr(main_module, "REMBG_SESSION", None) is not None
        return f"StyleSense ZeroGPU Active | ResNet-50: {model_ok} | rembg u2netp: {rembg_ok} | Ping: {ping}"
else:
    def gpu_status_check(ping: str = "status") -> str:
        model_ok = getattr(main_module, "MODEL", None) is not None
        rembg_ok = getattr(main_module, "REMBG_SESSION", None) is not None
        return f"StyleSense CPU Active | ResNet-50: {model_ok} | rembg u2netp: {rembg_ok} | Ping: {ping}"

# 4. Build Gradio Blocks UI with `gpu_status_check` bound to `.click()` (required by ZeroGPU scanner)
demo = None
if gr is not None:
    with gr.Blocks(title="StyleSense ML Service") as demo:
        gr.Markdown(
            "# 👗 StyleSense FastAPI ML & Hybrid Recommendation Service\n"
            "**Active FastAPI Endpoints Mounted at Root:**\n"
            "- `GET /health` — Health & model status check\n"
            "- `POST /analyze` — Fast `u2netp` background cutout + ResNet-50 classification + CIELAB K-Means++ (`K=2`)\n"
            "- `POST /analyze-batch` — Batch garment analysis\n"
            "- `POST /moderate` — Garment safety moderation\n"
            "- `POST /recommend` — Weighted Hybrid Outfit Recommender (`0.55 * S_cb + 0.45 * S_cf`)"
        )
        with gr.Row():
            inp = gr.Textbox(value="health-check", label="Ping Input")
            out = gr.Textbox(label="ZeroGPU & Model Status")
        btn = gr.Button("Verify ZeroGPU & Model Status")
        btn.click(fn=gpu_status_check, inputs=inp, outputs=out)


def _start_ml_warmup_in_background() -> None:
    """Runs main_module's lifespan warmup once in a daemon thread so ResNet-50 & u2netp stay pre-warmed."""
    async def _runner():
        if hasattr(main_module, "lifespan"):
            async with main_module.lifespan(fastapi_app):
                while True:
                    await asyncio.sleep(3600)

    def _thread_target():
        try:
            asyncio.run(_runner())
        except Exception as exc:
            print(f"[WARMUP WARNING] {exc}")

    threading.Thread(target=_thread_target, daemon=True).start()


if __name__ == "__main__":
    if gr is None or demo is None:
        # Local development fallback when Gradio is not installed
        import uvicorn
        port = int(os.environ.get("PORT", 8000))
        print(f"[STARTUP] Gradio not installed locally. Starting pure FastAPI on http://0.0.0.0:{port}")
        uvicorn.run(fastapi_app, host="0.0.0.0", port=port)
    else:
        # 5. Launch via Gradio's native `demo.launch(prevent_thread_lock=True)` so ZeroGPU hooks run
        #    and we NEVER call `uvicorn.run()` a second time on port 7860!
        port = int(os.environ.get("GRADIO_SERVER_PORT", os.environ.get("PORT", 7860)))
        gradio_result = demo.launch(
            server_name="0.0.0.0",
            server_port=port,
            prevent_thread_lock=True,
            show_error=True,
        )

        # 6. Prepend our FastAPI routes (/health, /analyze, /analyze-batch, /moderate, /recommend)
        #    onto Gradio's live FastAPI server (`demo.app`) so root REST calls work seamlessly!
        live_fastapi_app = getattr(demo, "app", None)
        if live_fastapi_app is None and isinstance(gradio_result, tuple):
            live_fastapi_app = gradio_result[0]

        if live_fastapi_app is not None:
            skip_paths = {"/", "/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}
            custom_routes = [
                r for r in fastapi_app.router.routes
                if getattr(r, "path", None) not in skip_paths
            ]
            live_fastapi_app.router.routes = custom_routes + list(live_fastapi_app.router.routes)
            print(f"[STARTUP] Mounted {len(custom_routes)} StyleSense FastAPI routes onto Gradio server!")

        # 7. Pre-warm u2netp and ResNet-50 in background thread, then keep server alive
        _start_ml_warmup_in_background()
        demo.block_thread()
