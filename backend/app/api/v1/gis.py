from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.gis_schemas import (
    GISLayerResponse,
    GISLayerUpdate,
    CameraFOVResponse,
    CameraFOVUpdate,
    SectorCoverageResponse,
    BlindSpotResponse,
    TerrainQueryRequest,
    TerrainQueryResponse
)
from app.api.deps import get_current_user, require_admin
from app.services.gis.gis_service import GISService
from app.services.gis.blind_spot_engine import BlindSpotAnalyzer
from app.services.gis.terrain_adapter import terrain_provider

router = APIRouter(prefix="/gis", tags=["GIS, Terrain & Blind-Spots"])

@router.get("/layers", response_model=List[GISLayerResponse])
def get_gis_layers(
    site_id: Optional[str] = "SITE-BORDER-NORTH",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return GISService.get_all_layers(db, site_id=site_id)

@router.put("/layers/{layer_id}", response_model=GISLayerResponse)
def update_gis_layer(
    layer_id: str,
    data: GISLayerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lyr = GISService.update_layer(db, layer_id, data)
    if not lyr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"GIS Layer '{layer_id}' not found.")
    return lyr

@router.get("/fov/{camera_id}", response_model=CameraFOVResponse)
def get_camera_fov(
    camera_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return GISService.get_or_calculate_fov(db, camera_id)

@router.get("/coverage/calculate", response_model=SectorCoverageResponse)
def calculate_sector_coverage(
    site_id: str = "SITE-BORDER-NORTH",
    bop_id: str = "BOP-ALPHA",
    sector_name: str = "Sector-North",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Computes real geometric optical and sensor coverage across perimeter sector and derives blind spots.
    """
    cov, _ = BlindSpotAnalyzer.calculate_sector_coverage_and_blind_spots(db, site_id, bop_id, sector_name)
    return cov

@router.get("/blind-spots", response_model=List[BlindSpotResponse])
def list_blind_spots(
    site_id: Optional[str] = "SITE-BORDER-NORTH",
    risk_level: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return BlindSpotAnalyzer.get_blind_spots(db, site_id=site_id, risk_level=risk_level)

@router.post("/blind-spots/{blind_spot_id}/acknowledge", response_model=BlindSpotResponse)
def acknowledge_blind_spot(
    blind_spot_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    bs = BlindSpotAnalyzer.acknowledge_blind_spot(db, blind_spot_id)
    if not bs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Blind Spot '{blind_spot_id}' not found.")
    return bs

@router.post("/terrain/query", response_model=TerrainQueryResponse)
def query_terrain_elevation(
    req: TerrainQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Queries topographical elevation, slope, aspect, and terrain morphology at specified coordinate.
    """
    return terrain_provider.get_elevation_and_slope(req.latitude, req.longitude)

