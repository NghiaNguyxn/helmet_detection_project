import uvicorn
import sys
from pathlib import Path

if __name__ == "__main__":
    root_path = Path(__file__).resolve().parent.parent
    
    if str(root_path) not in sys.path:
        sys.path.append(str(root_path))

    uvicorn.run(
        "SourceCode.BE.app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[str(root_path / "SourceCode")],
        reload_excludes=[
            "venv/*",
            ".git/*",
            "dataset/*",
            "runs/*",
            "SourceCode/FE/node_modules/*",
            "SourceCode/FE/dist/*",
        ],
    )
