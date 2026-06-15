# AI Helmet Detection and Traffic Monitoring System

A full-stack web application that detects motorcycle helmet usage from images and live camera streams using YOLO. The system provides real-time monitoring, violation evidence management, human review, analytics, camera administration, user access control, security alerts, and audit logging.

## Key Features

- Detects two classes: `With Helmet` and `Without Helmet`.
- Supports image uploads, webcams, RTSP streams, and demo video files.
- Streams annotated video to the browser using MJPEG.
- Tracks objects with ByteTrack to reduce duplicate violations.
- Applies temporal voting, bounding-box deduplication, and demo cooldown rules.
- Stores violation evidence in Cloudinary and violation records in MongoDB.
- Supports violation confirmation, rejection, review notes, and rejection reasons.
- Exports filtered violation history to Excel.
- Exports reviewed records as an AI feedback dataset in ZIP format.
- Provides daily and hourly traffic analytics.
- Excludes demo records from operational analytics.
- Manages cameras, connection tests, activation status, and source switching.
- Provides JWT authentication, refresh-token rotation, email verification, and password reset.
- Supports `admin` and `guard` roles.
- Broadcasts violations, telemetry, and security alerts through WebSocket.
- Records important user, camera, violation, and alert actions in audit logs.

## Technology Stack

### AI and Computer Vision

- Ultralytics YOLO
- PyTorch
- ONNX Runtime GPU
- NVIDIA TensorRT support
- OpenCV
- NumPy
- ByteTrack

### Backend

- Python 3.11
- FastAPI
- Uvicorn
- Pydantic
- SQLModel and SQLAlchemy
- Alembic
- PostgreSQL
- MongoDB with Motor
- Cloudinary
- PyJWT
- Argon2 password hashing
- OpenPyXL

### Frontend

- React 19
- Vite
- React Router
- Axios
- Tailwind CSS
- Recharts
- Lucide React
- React Hot Toast

## Project Structure

```text
helmet_detection_project/
|-- dataset/
|   |-- train/                         # YOLO training images and labels
|   |-- valid/                         # Validation dataset
|   |-- test/                          # Test dataset
|   `-- data.yaml                      # Dataset configuration
|-- Documents/                         # Project reports and documentation
|-- runs/                              # Generated YOLO training results
|-- scripts/
|   |-- export_onnx.py                 # Export PyTorch weights to ONNX
|   `-- backfill_violation_review_fields.py
|-- SourceCode/
|   |-- run.py                         # Backend development entry point
|   |-- BE/
|   |   |-- alembic/                   # PostgreSQL migrations
|   |   |-- app/
|   |   |   |-- api/                   # FastAPI routers
|   |   |   |-- core/                  # Configuration, security, WebSocket
|   |   |   |-- database/              # PostgreSQL and MongoDB connections
|   |   |   |-- dependencies/          # FastAPI dependencies and access control
|   |   |   |-- models/                # SQLModel database models
|   |   |   |-- schemas/               # Request and response schemas
|   |   |   |-- services/              # Business logic and AI pipeline
|   |   |   |-- templates/             # Email templates
|   |   |   |-- utils/                 # Drawing, email, and time utilities
|   |   |   `-- weights/               # Local model weights
|   |   |-- static/demo/                # Demo camera videos
|   |   |-- .env.example
|   |   `-- alembic.ini
|   `-- FE/
|       |-- public/
|       |-- src/
|       |   |-- components/
|       |   |-- context/
|       |   |-- pages/
|       |   `-- services/
|       |-- .env.example
|       `-- package.json
|-- requirements.txt
`-- README.md
```

## Prerequisites

- Python 3.11
- Node.js and npm
- PostgreSQL
- MongoDB Atlas or a local MongoDB server
- A Cloudinary account for evidence images and avatars
- SMTP credentials for email verification and password reset
- A webcam, RTSP camera, or demo video

Optional GPU requirements:

- NVIDIA GPU and compatible driver
- CUDA-compatible PyTorch or ONNX Runtime
- TensorRT runtime and Python bindings when using `.engine` models

## Installation

### 1. Clone the Repository

```powershell
git clone https://github.com/NghiaNguyxn/helmet_detection_project.git
cd helmet_detection_project
```

### 2. Create the Python Environment

PowerShell:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Command Prompt:

```bat
python -m venv venv
venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If the CUDA-specific PyTorch wheels in `requirements.txt` are not found:

```powershell
pip install torch==2.5.1+cu121 torchvision==0.20.1+cu121 `
  --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

### 3. Create the PostgreSQL Database

Create a database and application user with pgAdmin or `psql`:

```sql
CREATE USER helmet_user WITH PASSWORD 'replace-with-a-strong-password';
CREATE DATABASE helmet_db OWNER helmet_user;
GRANT ALL PRIVILEGES ON DATABASE helmet_db TO helmet_user;
```

The corresponding SQLAlchemy URL is:

```env
POSTGRES_URL=postgresql+psycopg2://helmet_user:replace-with-a-strong-password@localhost:5432/helmet_db
```

URL-encode special characters in the database password.

### 4. Configure MongoDB

For MongoDB Atlas:

1. Create a cluster and database user.
2. Allow the backend machine IP in Network Access.
3. Copy the MongoDB connection string.

Example:

```env
MONGO_URL=mongodb+srv://<username>:<password>@<cluster-url>/helmet_db?appName=helmet-detection
DATABASE_NAME=helmet_db
VIOLATION_COLLECTION=violations
TRAFFIC_STATS_COLLECTION=traffic_stats
APP_TIMEZONE=Asia/Ho_Chi_Minh
```

For a local MongoDB server:

```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=helmet_db
VIOLATION_COLLECTION=violations
TRAFFIC_STATS_COLLECTION=traffic_stats
```

MongoDB collections are created when the application stores their first records.

### 5. Configure the Backend

Create the backend environment file:

```powershell
Copy-Item SourceCode\BE\.env.example SourceCode\BE\.env
```

Update `SourceCode/BE/.env`:

```env
# Databases
POSTGRES_URL=postgresql+psycopg2://helmet_user:your-password@localhost:5432/helmet_db
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=helmet_db
VIOLATION_COLLECTION=violations
TRAFFIC_STATS_COLLECTION=traffic_stats

# Initial administrator
FIRST_ADMIN_USERNAME=admin
FIRST_ADMIN_EMAIL=admin@example.com
FIRST_ADMIN_PASSWORD=replace-with-a-strong-password

# Authentication
SECRET_KEY=replace-with-at-least-32-random-characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# AI inference
MODEL_PATH=SourceCode/BE/app/weights/best_s.onnx
INFERENCE_DEVICE=0
INFERENCE_HALF=True
IMAGE_INFERENCE_SIZE=640
VIDEO_INFERENCE_SIZE=640
RTSP_INFERENCE_SIZE=416

# Frontend
FRONTEND_URL=http://localhost:5173
FRONTEND_VERIFY_PATH=/verify-email
FRONTEND_RESET_PASSWORD_PATH=/reset-password
CORS_ORIGINS=["http://localhost:5173"]
```

Generate a secure secret:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Configure Cloudinary:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Configure SMTP email:

```env
MAIL_SERVER=smtp.example.com
MAIL_USERNAME=your-mail-username
MAIL_PASSWORD=your-mail-password
MAIL_PORT=587
MAIL_FROM=no-reply@example.com
```

### 6. Apply PostgreSQL Migrations

Run from the repository root:

```powershell
python -m alembic -c SourceCode\BE\alembic.ini upgrade head
```

Verify the active migration:

```powershell
python -m alembic -c SourceCode\BE\alembic.ini current
```

The initial administrator configured in `.env` is created when the backend starts if no matching account exists.

### 7. Start the Backend

```powershell
python SourceCode\run.py
```

Available endpoints:

- API: `http://127.0.0.1:8000`
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Health check: `http://127.0.0.1:8000/health`

### 8. Install and Start the Frontend

Open a second terminal:

```powershell
cd SourceCode\FE
npm install
Copy-Item .env.example .env
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

Frontend environment:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Model Configuration

The backend supports Ultralytics-compatible model formats such as `.pt`, `.onnx`, and `.engine`.

### CPU Inference

```env
MODEL_PATH=SourceCode/BE/app/weights/best_s.onnx
INFERENCE_DEVICE=cpu
INFERENCE_HALF=False
```

### NVIDIA GPU with ONNX

```env
MODEL_PATH=SourceCode/BE/app/weights/best_s.onnx
INFERENCE_DEVICE=0
INFERENCE_HALF=True
```

### Export to ONNX

```powershell
python scripts\export_onnx.py `
  --model SourceCode\BE\app\weights\best_s.pt `
  --imgsz 640 `
  --simplify
```

### Export to TensorRT

TensorRT is optional and requires an NVIDIA GPU, TensorRT runtime, matching Python bindings, and `trtexec`.

Exporting directly from PyTorch with Ultralytics preserves model metadata:

```powershell
python -c "from ultralytics import YOLO; YOLO('SourceCode/BE/app/weights/best_s.pt').export(format='engine', imgsz=640, half=True, dynamic=False, workspace=4, device=0)"
```

TensorRT configuration:

```env
MODEL_PATH=SourceCode/BE/app/weights/best_s.engine
INFERENCE_DEVICE=0
INFERENCE_HALF=True
IMAGE_INFERENCE_SIZE=640
VIDEO_INFERENCE_SIZE=640
RTSP_INFERENCE_SIZE=640
```

TensorRT engine precision is selected during export. Set `INFERENCE_HALF=False` for FP32 engines.

## Camera Configuration

Cameras are normally configured from the **Camera Management** page.

### Webcam

```text
Source type: webcam
Source URL: 0
```

### RTSP Camera

```text
Source type: rtsp
Source URL: rtsp://user:password@host/stream
```

Recommended starting configuration:

```env
RTSP_TRANSPORT=tcp
RTSP_CAPTURE_BUFFER_SIZE=1
RTSP_INFERENCE_SIZE=416
```

### Demo Video

Place supported video files in:

```text
SourceCode/BE/static/demo
```

Create a camera with:

```text
Source type: video_file
Source URL: <video-filename>
```

Demo videos loop automatically. Their violations are marked with `is_demo=true` and excluded from operational analytics.

## API Documentation

Interactive OpenAPI documentation is generated automatically by FastAPI:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticate and return an access token |
| `POST` | `/auth/refresh` | Rotate the refresh token and issue a new access token |
| `POST` | `/auth/logout` | Revoke the refresh token |
| `POST` | `/auth/register` | Create a user account as an administrator |
| `GET` | `/auth/verify-email` | Verify an email address |
| `POST` | `/auth/resend-verification` | Send a new verification email |
| `POST` | `/auth/forgot-password` | Request a password reset email |
| `POST` | `/auth/reset-password` | Reset a password using a token |

### Users

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users/me` | Get the current profile |
| `PATCH` | `/users/me` | Update the current profile |
| `PATCH` | `/users/me/avatar` | Upload a profile avatar |
| `POST` | `/users/change-password` | Change the current password |
| `GET` | `/users/` | List users as an administrator |
| `PATCH` | `/users/{user_id}/status` | Activate or deactivate a user |
| `DELETE` | `/users/{user_id}` | Delete a non-administrator user |

### Detection and Live Monitoring

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/helmet/predict` | Detect helmet usage in an uploaded image |
| `GET` | `/helmet/video-feed` | Stream annotated MJPEG frames |
| `POST` | `/helmet/stop-video-feed` | Stop a viewer stream |
| `GET` | `/helmet/camera-sources` | List available camera sources |
| `POST` | `/helmet/switch-camera/{source_id}` | Switch the active source |
| `POST` | `/helmet/force-stop-camera` | Stop the shared camera pipeline |
| `WS` | `/helmet/ws` | Receive telemetry, violations, and alerts |

### Cameras

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/cameras/` | List cameras |
| `GET` | `/cameras/demo-videos` | List available demo videos |
| `POST` | `/cameras/` | Create a camera |
| `PATCH` | `/cameras/{camera_id}` | Update a camera |
| `PATCH` | `/cameras/{camera_id}/status` | Change camera activation status |
| `POST` | `/cameras/{camera_id}/test` | Test a camera connection |
| `DELETE` | `/cameras/{camera_id}` | Soft-delete a camera |

### Violations and Reports

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/violations/` | List and filter violation records |
| `PATCH` | `/violations/{violation_id}/confirm` | Confirm a violation |
| `PATCH` | `/violations/{violation_id}/reject` | Reject a violation |
| `DELETE` | `/violations/{violation_id}` | Delete a violation |
| `GET` | `/violations/export` | Export filtered records to Excel |
| `GET` | `/violations/export-feedback-dataset` | Export reviewed AI feedback data |
| `GET` | `/reports/summary` | Get summary analytics |
| `GET` | `/reports/trend` | Get daily or hourly trend data |

### Alerts and Audit Logs

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/alerts/broadcast` | Save and broadcast a security alert |
| `GET` | `/alerts/history` | Get recent alerts |
| `GET` | `/audit-logs/` | Query audit logs as an administrator |

Protected requests use:

```http
Authorization: Bearer <access-token>
```

The refresh token is stored in an HTTP-only cookie.

## Validation Commands

Backend syntax check:

```powershell
python -m compileall SourceCode\BE
```

Frontend lint and production build:

```powershell
cd SourceCode\FE
npm.cmd run lint
npm.cmd run build
```

## Security Notes

- Never commit `.env`, credentials, model weights, or database dumps.
- Replace all default passwords and placeholder secrets.
- Restrict `CORS_ORIGINS` to trusted frontend origins.
- Enable HTTPS and secure cookies in production.
- Back up PostgreSQL and MongoDB.
- Apply Alembic migrations during deployment.
- TensorRT engines should be rebuilt when the GPU or TensorRT runtime is incompatible.
- Consider moving access tokens from `localStorage` to a hardened cookie-based flow for production.
