from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .config import settings
from .database import Base, engine
from .errors import register_exception_handlers
from .routes.api import router as api_router
from .storage import init_storage_dirs

init_storage_dirs()
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.mount("/storage", StaticFiles(directory=str(settings.STORAGE_ROOT)), name="storage")
app.include_router(api_router)
