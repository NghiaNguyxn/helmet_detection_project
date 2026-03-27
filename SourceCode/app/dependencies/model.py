from fastapi import Request

def get_model(request: Request):
    return request.app.state.model