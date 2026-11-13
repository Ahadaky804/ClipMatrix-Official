from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings

# Build SQLAlchemy URL from discrete parameters (supports TCP host or Unix domain socket)
if settings.SQL_HOST.startswith("/"):
    db_url = URL.create(
        drivername="postgresql+psycopg2",
        username=settings.SQL_USER,
        password=settings.SQL_PASSWORD,
        database=settings.SQL_DB_NAME,
        query={"host": settings.SQL_HOST},
    )
else:
    db_url = URL.create(
        drivername="postgresql+psycopg2",
        username=settings.SQL_USER,
        password=settings.SQL_PASSWORD,
        host=settings.SQL_HOST,
        port=int(settings.SQL_PORT or 5432),
        database=settings.SQL_DB_NAME,
    )

engine = create_engine(db_url, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
