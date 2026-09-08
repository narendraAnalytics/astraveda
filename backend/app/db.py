from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.config import get_settings

settings = get_settings()

_connect_args = {"check_same_thread": False} if settings.sqlalchemy_url.startswith("sqlite") else {}
engine = create_engine(settings.sqlalchemy_url, echo=False, pool_pre_ping=True, connect_args=_connect_args)


def init_db() -> None:
    # The Neon table already exists (created via MCP); this is a no-op there and
    # creates the SQLite table for local dev.
    SQLModel.metadata.create_all(engine)

    # Seed the demo temple/puja catalog if empty (idempotent).
    from app.services.puja_catalog import seed_catalog

    try:
        with Session(engine) as session:
            seed_catalog(session)
    except Exception:  # noqa: BLE001 — never block startup on the seed
        pass


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
