from typing import Generic, TypeVar, Optional, Any
from pydantic import BaseModel

T = TypeVar("T")

class BaseResponse(BaseModel, Generic[T]):
    code: int
    message: str = "Successful"
    result: Optional[T] = None
    error_code: Optional[str] = None
    errors: Optional[list] = []