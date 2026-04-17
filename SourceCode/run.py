import uvicorn
import sys
import os
from pathlib import Path

if __name__ == "__main__":
    root_path = str(Path(__file__).resolve().parent.parent)
    
    if root_path not in sys.path:
        sys.path.append(root_path)

    uvicorn.run(
        "SourceCode.BE.app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )