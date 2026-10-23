import os
import sys
from pathlib import Path

# Ensure ml-service root and app package are in sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Import the FastAPI application
try:
    import importlib.util
    main_path = BASE_DIR / "app" / "main.py"
    if main_path.exists():
        spec = importlib.util.spec_from_file_location("stylesense_ml_main", main_path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules["stylesense_ml_main"] = mod
        spec.loader.exec_module(mod)
        fastapi_app = mod.app
    else:
        from main import app as fastapi_app
except Exception:
    try:
        from main import app as fastapi_app
    except Exception:
        from app.main import app as fastapi_app

try:
    import gradio as gr
    GRADIO_AVAILABLE = True
except ImportError:
    gr = None
    GRADIO_AVAILABLE = False

if GRADIO_AVAILABLE and gr is not None:
    with gr.Blocks(title="StyleSense ML Service") as status_ui:
        gr.Markdown(
            """
            # 👗 StyleSense ML & Hybrid Recommendation Service
            **Status:** 🟢 Online & Healthy (Gradio + FastAPI + PyTorch ResNet-50)

            Welcome to the deployed Hugging Face Space for **StyleSense** ML microservice:
            - `GET /health` — Check model checkpoint status & validation metrics
            - `POST /analyze` — Sub-second garment classification, cutout extraction, & color clustering
            - `POST /analyze-batch` — Batch image analysis for wardrobe uploads
            - `POST /moderate` — AI Content Moderation Gate (Skin-ratio & profanity checks)
            - `POST /recommend` — Hybrid Content-Based & Collaborative outfit recommendations

            *Interactive OpenAPI Docs are available at [`/docs`](/docs).*
            """
        )
        with gr.Row():
            gr.Textbox(
                label="Service Status",
                value="FastAPI microservice endpoints are live and accepting requests.",
                interactive=False,
            )

    app = gr.mount_gradio_app(fastapi_app, status_ui, path="/ui")
else:
    app = fastapi_app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)

