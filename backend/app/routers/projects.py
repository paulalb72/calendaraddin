"""Projekt-Endpunkte.

- GET  /api/projects        -> aktive Projekte für das Add-on (Token-geschützt, F-14/F-15)
- GET  /api/admin/projects  -> alle Projekte (UI, Session-geschützt, F-07)
- POST /api/admin/projects  -> Projekt anlegen (F-07/F-08)
- PUT  /api/admin/projects/{id} -> Projekt bearbeiten / aktiv schalten (F-08/F-09)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth import require_api_token, require_ui_session
from ..database import get_db
from ..models import Project
from ..schemas import ProjectAdmin, ProjectCreate, ProjectPublic, ProjectUpdate

router = APIRouter(prefix="/api")


@router.get(
    "/projects",
    response_model=list[ProjectPublic],
    dependencies=[Depends(require_api_token)],
)
def list_active_projects(db: Session = Depends(get_db)):
    """F-14: Nur aktive Projekte als {id, name} (F-01/AK-01)."""
    projects = (
        db.query(Project)
        .filter(Project.active.is_(True))
        .order_by(Project.name)
        .all()
    )
    return [ProjectPublic(id=p.id, name=p.name) for p in projects]


@router.get(
    "/admin/projects",
    response_model=list[ProjectAdmin],
    dependencies=[Depends(require_ui_session)],
)
def list_all_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.name).all()


@router.post(
    "/admin/projects",
    response_model=ProjectAdmin,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_ui_session)],
)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(name=payload.name.strip(), active=payload.active)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.put(
    "/admin/projects/{project_id}",
    response_model=ProjectAdmin,
    dependencies=[Depends(require_ui_session)],
)
def update_project(
    project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Projekt nicht gefunden")
    if payload.name is not None:
        project.name = payload.name.strip()
    if payload.active is not None:
        project.active = payload.active
    db.commit()
    db.refresh(project)
    return project
