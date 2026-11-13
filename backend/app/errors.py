from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ClipMatrixError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class VideoProcessingError(ClipMatrixError):
    def __init__(self, message: str):
        super().__init__(message, status_code=422)


class WhisperNotAvailableError(ClipMatrixError):
    def __init__(self, message: str):
        super().__init__(message, status_code=503)


class GeminiConfigurationError(ClipMatrixError):
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ClipMatrixError)
    async def handle_clipmatrix_error(_request: Request, exc: ClipMatrixError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={"error": f"Backend error: {str(exc)}"},
        )
