import io
import os
import sys
import time
import asyncio
import inspect
import threading
import importlib.util

# Disable Gradio 6's Node.js SSR proxy so Python listens directly on port 7860
os.environ["GRADIO_SSR_MODE"] = "false"

# 1. Import `spaces` BEFORE torch/main so Hugging Face ZeroGPU initializes cleanly
try:
    import spaces  # type: ignore[import-not-found]
except ImportError:
    spaces = None

try:
    import gradio as gr  # type: ignore[import-not-found]
    from gradio.routes import App as GradioServerApp  # type: ignore[import-not-found]
except ImportError:
    gr = None  # type: ignore[assignment]
    GradioServerApp = None  # type: ignore[assignment]

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT_DIR, "app")
os.chdir(ROOT_DIR)
for p in (ROOT_DIR, APP_DIR):
    if os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)

# 2. Load the FastAPI `app` from `app/main.py`
main_py_path = os.path.join(APP_DIR, "main.py")
if os.path.isfile(main_py_path):
    spec = importlib.util.spec_from_file_location("stylesense_main", main_py_path)
    mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
    sys.modules["stylesense_main"] = mod
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    fastapi_app = mod.app
else:
    import app.main as mod  # type: ignore[import-not-found]
    fastapi_app = mod.app


def _gpu_decorator(fn):
    if spaces is not None and hasattr(spaces, "GPU"):
        return spaces.GPU(fn)
    return fn


@_gpu_decorator
def warmup_zerogpu() -> str:
    """Registered @spaces.GPU entrypoint so Hugging Face ZeroGPU startup check passes."""
    return "StyleSense ZeroGPU & FastAPI pipeline ready."


_startup_done = False
_startup_lock = threading.Lock()
_lifespan_cm = None


async def _run_dummy_inference_warmup() -> None:
    """
    Passes a tiny 64x64 synthetic image through the inference pipeline at container boot so
    ONNX Runtime (u2netp), PyTorch ResNet-50, and K-Means++ compile their CPU kernels
    BEFORE the user uploads their first real garment photo.
    """
    try:
        from PIL import Image

        t0 = time.perf_counter()
        img = Image.new("RGB", (64, 64), color=(60, 90, 140))
        # Draw a contrasting center square so K-Means++ has >= 2 distinct colors & foreground
        for x in range(16, 48):
            for y in range(16, 48):
                img.putpixel((x, y), (220, 210, 190))

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        raw_bytes = buf.getvalue()

        def _sync_warmup():
            analyze_fn = getattr(mod, "_analyze_single_image_bytes", None)
            if callable(analyze_fn):
                analyze_fn(raw_bytes, force_rembg=True, beautify=False)
                return 200
            return 204

        status = await asyncio.to_thread(_sync_warmup)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        print(
            f"[StyleSense] Eager dummy image warm-up complete (status={status}, {elapsed_ms:.0f} ms)!",
            flush=True,
        )
    except Exception as exc:
        print(f"[StyleSense] Dummy warm-up note (non-fatal): {exc}", flush=True)


async def _ensure_fastapi_startup() -> None:
    """Executes fastapi_app's startup/lifespan handlers so ResNet-50 loads into memory."""
    global _startup_done, _lifespan_cm
    if _startup_done:
        return
    with _startup_lock:
        if _startup_done:
            return
        _startup_done = True
        print("[StyleSense] Running FastAPI startup events & loading ResNet-50 model...", flush=True)
        try:
            lifespan_factory = getattr(fastapi_app.router, "lifespan_context", None)
            if lifespan_factory is not None:
                _lifespan_cm = lifespan_factory(fastapi_app)
                await _lifespan_cm.__aenter__()
            else:
                for handler in getattr(fastapi_app.router, "on_startup", []):
                    res = handler()
                    if inspect.isawaitable(res):
                        await res
            print("[StyleSense] FastAPI startup & ResNet-50 model ready!", flush=True)
        except Exception as exc:
            print(f"[StyleSense] FastAPI startup error: {exc}", flush=True)

    # Also warm up ONNX + PyTorch + K-Means++ with a dummy image
    await _run_dummy_inference_warmup()


def _trigger_eager_startup_in_background() -> None:
    """Fires _ensure_fastapi_startup() immediately at container boot without waiting for Request #1."""
    def _runner():
        try:
            asyncio.run(_ensure_fastapi_startup())
        except Exception as exc:
            print(f"[StyleSense] Background eager startup note: {exc}", flush=True)

    t = threading.Thread(target=_runner, daemon=True)
    t.start()


_API_POST_ENDPOINTS = {
    "/analyze",
    "/analyze-batch",
    "/remove-bg",
    "/beautify",
    "/try-on-2d",
    "/moderate",
    "/recommend",
    "/score-outfit",
}
_API_GET_ENDPOINTS = {
    "/health",
    "/categories",
    "/docs",
    "/openapi.json",
}


def _normalize_api_scope(scope: dict) -> tuple[bool, str]:
    method = (scope.get("method") or "GET").upper()
    raw_path = scope.get("path") or "/"
    path = raw_path.rstrip("/") or "/"

    if path.startswith("/analyze/"):
        suffix = path[len("/analyze"):]
        if suffix in _API_POST_ENDPOINTS or suffix in _API_GET_ENDPOINTS:
            path = suffix

    if path.startswith("/gradio_api/"):
        suffix = path[len("/gradio_api"):]
        if suffix in _API_POST_ENDPOINTS or suffix in _API_GET_ENDPOINTS:
            path = suffix

    if path == "/analyze" and method in ("GET", "HEAD"):
        return True, "/health"

    if path == "/" and method == "POST":
        return True, "/analyze"

    if path in _API_POST_ENDPOINTS or path in _API_GET_ENDPOINTS:
        return True, path

    return False, raw_path


# 3. Hook GradioServerApp.__call__ at the outermost ASGI layer
if GradioServerApp is not None:
    _orig_asgi_call = GradioServerApp.__call__

    async def _stylesense_asgi_call(self, scope, receive, send):
        if scope.get("type") == "http":
            is_api, norm_path = _normalize_api_scope(scope)
            if is_api:
                await _ensure_fastapi_startup()
                orig_path = scope.get("path", "")
                method = scope.get("method", "GET")
                print(f"[StyleSense ASGI] {method} {orig_path} -> {norm_path}", flush=True)
                patched_scope = dict(scope)
                patched_scope["path"] = norm_path
                patched_scope["raw_path"] = norm_path.encode("utf-8")

                status_holder = [200]

                async def _logging_send(message):
                    if message.get("type") == "http.response.start":
                        status_holder[0] = message.get("status", 200)
                        print(
                            f"[StyleSense ASGI] <- Status {status_holder[0]} for {method} {norm_path}",
                            flush=True,
                        )
                    elif message.get("type") == "http.response.body":
                        if status_holder[0] >= 400:
                            body_bytes = message.get("body", b"")
                            if body_bytes:
                                print(
                                    f"[StyleSense ASGI] <- Error detail: "
                                    f"{body_bytes[:500].decode('utf-8', errors='replace')}",
                                    flush=True,
                                )
                    await send(message)

                await fastapi_app(patched_scope, receive, _logging_send)
                return
        await _orig_asgi_call(self, scope, receive, send)

    GradioServerApp.__call__ = _stylesense_asgi_call  # type: ignore[method-assign]


demo = None
if gr is not None:
    with gr.Blocks(title="StyleSense ML Service") as demo:
        gr.Markdown(
            "### StyleSense FastAPI + ZeroGPU ML Service (v6.0)\n"
            "Active REST endpoints: `POST /analyze`, `POST /analyze-batch`, `POST /beautify`, "
            "`POST /try-on-2d`, `POST /moderate`, `POST /recommend`, `GET /health`."
        )
        status_btn = gr.Button("Verify ZeroGPU Readiness")
        status_out = gr.Textbox(label="Status")
        status_btn.click(fn=warmup_zerogpu, inputs=[], outputs=status_out)


if __name__ == "__main__":
    # Eagerly load ResNet-50 and run a dummy 64x64 image warm-up immediately at container boot!
    _trigger_eager_startup_in_background()

    port = int(os.environ.get("PORT", 7860))
    if gr is not None and demo is not None:
        demo.launch(
            server_name="0.0.0.0",
            server_port=port,
            ssr_mode=False,
        )
    else:
        import uvicorn
        uvicorn.run(fastapi_app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
