# Helmet Detection Project

FastAPI + React application for helmet detection with YOLO, live camera monitoring, violation logging, user management, and analytics.

## Project Layout

- `SourceCode/BE`: FastAPI backend, auth, databases, model inference, camera streaming.
- `SourceCode/FE`: React/Vite frontend.
- `dataset`: YOLO dataset layout (`train`, `valid`, `test`).
- `export_onnx.py`: CLI helper for exporting trained YOLO `.pt` weights to ONNX.

Generated artifacts such as `node_modules`, `dist`, `runs`, model weights, local databases, and `.env` files should not be committed.

## Backend Setup

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item SourceCode\BE\.env.example SourceCode\BE\.env
```

Edit `SourceCode/BE/.env` before starting the API:

- Set `SECRET_KEY` to at least 32 random characters.
- Set `FIRST_ADMIN_PASSWORD` to a strong password.
- Set `MODEL_PATH` to an existing `.onnx` or `.pt` model.
- Set `MONGO_URL` and Cloudinary/email values for features that use external services.
- Use `INFERENCE_DEVICE=cpu` for a portable setup. Use `INFERENCE_DEVICE=0` and `INFERENCE_HALF=true` only when CUDA is installed and supported.

Run the API:

```powershell
python SourceCode\run.py
```

Health check:

```powershell
Invoke-RestMethod http://localhost:8000/health
```

## Frontend Setup

```powershell
cd SourceCode\FE
npm install
Copy-Item .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` in `SourceCode/FE/.env` if the backend does not run on `http://localhost:8000`.

## Model Export

Export a trained YOLO model:

```powershell
python export_onnx.py --model runs\detect\helmet_s_200\weights\best.pt --imgsz 416 --dynamic --simplify
```

Update `MODEL_PATH` in `SourceCode/BE/.env` to the exported ONNX file.

## Dataset

`dataset/data.yaml` uses paths relative to the `dataset` directory:

```yaml
train: train/images
val: valid/images
test: test/images
```

When training from the repo root, pass `data=dataset/data.yaml`.

## Useful Checks

```powershell
python -m compileall SourceCode\BE
cd SourceCode\FE
npm run lint
npm run build
```

## Production Notes

- Restrict `CORS_ORIGINS` to trusted frontend URLs.
- Avoid storing long-lived tokens in `localStorage` for production; prefer httpOnly cookies or a short-lived access token flow.
- Keep `.env`, model weights, local databases, and generated outputs outside git.
