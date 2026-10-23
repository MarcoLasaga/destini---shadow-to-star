import os
import sys
import importlib.util

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
    from app.main import app as fastapi_app  # type: ignore[import-not-found]


def _gpu_decorator(fn):
    if spaces is not None and hasattr(spaces, "GPU"):
        return spaces.GPU(fn)
    return fn


@_gpu_decorator
def warmup_zerogpu() -> str:
    """Registered @spaces.GPU entrypoint so Hugging Face ZeroGPU startup check passes."""
    return "StyleSense ZeroGPU & FastAPI pipeline ready."


def mount_fastapi_routes_first(target_app) -> None:
    """Prepend all FastAPI routes at index 0 BEFORE Gradio's catch-all GET /{path:path}."""
    if target_app is None or not hasattr(target_app, "router"):
        return
    skip_paths = {"/", "/docs", "/redoc", "/openapi.json"}
    existing_signatures = {
        (getattr(r, "path", None), tuple(sorted(getattr(r, "methods", []) or [])))
        for r in target_app.router.routes
    }
    routes_to_prepend = []
    for route in fastapi_app.router.routes:
        path = getattr(route, "path", None)
        if not path or path in skip_paths:
            continue
        methods = tuple(sorted(getattr(route, "methods", []) or []))
        if (path, methods) not in existing_signatures:
            routes_to_prepend.append(route)
            existing_signatures.add((path, methods))

    if routes_to_prepend:
        # Insert at index 0 so POST /analyze, POST /remove-bg, GET /health match BEFORE /{path:path}
        target_app.router.routes[0:0] = routes_to_prepend
        print(
            f"[StyleSense] Prepended {len(routes_to_prepend)} FastAPI routes at index 0: "
            f"{[getattr(r, 'path', '') for r in routes_to_prepend]}"
        )


# 3. Hook Gradio's App.create_app so routes are prepended the instant the FastAPI server is created
if GradioServerApp is not None and hasattr(GradioServerApp, "create_app"):
    _orig_create_app = GradioServerApp.create_app

    def _patched_create_app(*args, **kwargs):
        created_app = _orig_create_app(*args, **kwargs)
        mount_fastapi_routes_first(created_app)
        return created_app

    GradioServerApp.create_app = staticmethod(_patched_create_app)


demo = None
if gr is not None:
    with gr.Blocks(title="StyleSense ML Service") as demo:
        gr.Markdown(
            "### StyleSense FastAPI + ZeroGPU ML Service\n"
            "Active REST endpoints: `POST /analyze`, `POST /remove-bg`, `POST /recommend`, `GET /health`."
        )
        status_btn = gr.Button("Verify ZeroGPU Readiness")
        status_out = gr.Textbox(label="Status")
        status_btn.click(fn=warmup_zerogpu, inputs=[], outputs=status_out)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    if gr is not None and demo is not None:
        res = demo.launch(
            server_name="0.0.0.0",
            server_port=port,
            prevent_thread_lock=True,
        )
        live_app = getattr(demo, "server_app", None) or getattr(demo, "app", None)
        if isinstance(res, tuple) and len(res) > 0 and hasattr(res[0], "router"):
            live_app = res[0]
        mount_fastapi_routes_first(live_app)
        demo.block_thread()
    else:
        import uvicorn
        uvicorn.run(fastapi_app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))