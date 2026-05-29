# Helmet Detection Project

FastAPI + React application for helmet detection with YOLO, live camera monitoring, camera management, violation review, audit logging, user management, and analytics.

## Project Layout

- `SourceCode/BE`: FastAPI backend, auth, SQLModel/SQLite, MongoDB, model inference, camera streaming.
- `SourceCode/FE`: React/Vite frontend.
- `SourceCode/BE/static/demo`: demo video files used by `video_file` cameras.
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
- Set `MODEL_PATH` to an existing `.onnx` or `.pt` model file.
- Configure `MONGO_URL`, Cloudinary, and email settings if you want the full violation upload, email verification, and password reset flows.
- Use `INFERENCE_DEVICE=cpu` for a portable setup. Use `INFERENCE_DEVICE=0` and `INFERENCE_HALF=True` only when CUDA is installed and supported.

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

## Configuration Guide

`SourceCode/BE/.env.example` is the configuration template. `SourceCode/BE/.env` is the local runtime configuration and should not be committed.

- **Database**: `SQLITE_URL` stores SQL data such as users, cameras, and audit logs. `MONGO_URL`, `DATABASE_NAME`, `VIOLATION_COLLECTION`, and `TRAFFIC_STATS_COLLECTION` store violations and traffic statistics.
- **Initial Admin Account**: default admin account values used when the system has no admin yet.
- **Authentication / JWT**: `SECRET_KEY`, `ALGORITHM`, and `ACCESS_TOKEN_EXPIRE_MINUTES` control access tokens.
- **AI Inference**: `MODEL_PATH`, `INFERENCE_DEVICE`, `INFERENCE_HALF`, `IMAGE_INFERENCE_SIZE`, `VIDEO_INFERENCE_SIZE`, and `RTSP_INFERENCE_SIZE` control model execution and input size.
- **Violation Detection / Deduplication**: `VIOLATION_THRESHOLD`, `DEMO_VIOLATION_COOLDOWN_SECONDS`, `VIOLATION_DEDUP_*`, `ENABLE_SPATIAL_VOTING`, and `SPATIAL_VOTE_*` control detection thresholds and duplicate prevention.
- **ByteTrack Tracker**: `TRACK_HIGH_THRESH`, `TRACK_LOW_THRESH`, `NEW_TRACK_THRESH`, `TRACK_BUFFER`, and `MATCH_THRESH` control tracking IDs.
- **Camera / RTSP**: `RTSP_TRANSPORT`, `RTSP_CAPTURE_BUFFER_SIZE`, and fallback `CAM_*` variables.
- **Cloudinary**: used for evidence image uploads.
- **Email**: used for email verification and password reset.
- **Frontend / CORS**: `FRONTEND_URL`, `FRONTEND_VERIFY_PATH`, `FRONTEND_RESET_PASSWORD_PATH`, and `CORS_ORIGINS`.

`CORS_ORIGINS` must be a JSON array because the backend setting type is `list[str]`:

```env
CORS_ORIGINS=["http://localhost:5173"]
```

## Camera Configuration

Cameras should normally be managed through the Camera Management page. `CAM_*` variables in `.env` are fallback sources only when the database has no active camera.

- Webcam: create a camera with `source_type=webcam` and `source_url=0`.
- RTSP phone camera: create a camera with `source_type=rtsp` and an `rtsp://...` source URL. Start with `RTSP_CAPTURE_BUFFER_SIZE=1`; test `RTSP_TRANSPORT=udp` or `tcp` depending on the network.
- Demo video: create a camera with `source_type=video_file` and a file from the demo static area. Violations from this source are saved with `is_demo=true`.

If a phone RTSP camera has high latency, measure OpenCV capture FPS separately before optimizing YOLO. The camera app browser preview may be smoother because the backend reads the stream through OpenCV/FFmpeg and then processes it again.

## Data Semantics

- Real violation data means non-demo records (`is_demo != true`).
- Analytics and reports exclude demo data by default.
- Violation History can still show demo records for testing and demos.
- Audit logs record important actions after the business action succeeds, such as user changes, violation review, alerts, camera switch, and force stop.
- `traffic_stats` is aggregate pipeline data and should not be treated as exactly the same as reviewed or confirmed violation records.

## Access Control

- Unverified users should only access Profile and email verification flows.
- Business features such as Live Monitoring, Violations, Analytics, Alerts, Camera Management, and Audit Logs require the backend `VerifiedUser` dependency or the matching role checker.
- Admin-only pages: User Management, Camera Management, and Audit Logs.
- Guard/staff users can access operational features allowed by their role, but they must still be active and verified.

## Demo Runbook

1. Log in as an admin.
2. Verify the account email if the account is still unverified.
3. Open Camera Management and create or inspect a camera.
4. Test the connection for webcam, RTSP, or demo video.
5. Open Live Monitoring and start the stream.
6. Switch cameras if you need to demonstrate multiple sources.
7. Run a demo video or real camera to generate a violation.
8. Open Violation History and inspect evidence, the demo badge for demo records, and camera metadata in the modal.
9. Confirm or reject a violation.
10. Open Audit Logs and verify review, camera, or user actions.
11. Open Analytics and explain that demo data is excluded from real statistics.

## Model Export

Export a trained YOLO model:

```powershell
python export_onnx.py --model runs\detect\helmet_s_200\weights\best.pt --imgsz 416 --dynamic --simplify
```

Then update `MODEL_PATH` in `SourceCode/BE/.env` to the exported ONNX file.

## Dataset

`dataset/data.yaml` uses paths relative to the `dataset` directory:

```yaml
train: train/images
val: valid/images
test: test/images
```

When training from the repo root, pass `data=dataset/data.yaml`.

## Useful Checks

Backend:

```powershell
python -m compileall SourceCode\BE
```

Frontend:

```powershell
cd SourceCode\FE
npm.cmd run lint
npm.cmd run build
```

## Production Notes

- Restrict `CORS_ORIGINS` to trusted frontend URLs.
- Do not commit `.env`, model weights, local databases, or generated outputs.
- Do not use the default admin password.
- For real production use, consider httpOnly cookies or a short-lived token flow instead of long-lived tokens in `localStorage`.
- `create_all()` is acceptable for local/demo use. For long-running deployments, add a migration strategy such as Alembic or controlled migration scripts.
