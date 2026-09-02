import json
import logging
import math
import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.gis_models import GISLayer, CameraFOV, SectorCoverage
from app.models.camera import Camera
from app.schemas.gis_schemas import GISLayerUpdate, CameraFOVUpdate

logger = logging.getLogger("ibvap.services.gis")

# Earth radius in meters
EARTH_RADIUS_M = 6371000.0

class GISService:
    """
    Module 5: Spatial Layer Management and Real Geometric Camera FOV Projection Engine.
    """

    @staticmethod
    def get_all_layers(db: Session, site_id: Optional[str] = None) -> List[GISLayer]:
        query = db.query(GISLayer)
        if site_id:
            query = query.filter(GISLayer.site_id == site_id)
        layers = query.order_by(GISLayer.id.asc()).all()
        
        # If no layers exist, seed standard tactical GIS layers
        if not layers:
            layers = GISService.init_default_layers(db, site_id or "SITE-BORDER-NORTH")
        return layers

    @staticmethod
    def init_default_layers(db: Session, site_id: str = "SITE-BORDER-NORTH") -> List[GISLayer]:
        layer_defs = [
            ("BASE_MAP", "Satellite & Topo Base", "BASE_MAP", 1.0, True),
            ("BOUNDARY", "International Border Line & Buffer", "BOUNDARY", 0.9, True),
            ("CAMERAS", "Optical & Thermal CCTV Nodes", "CAMERAS", 1.0, True),
            ("COVERAGE", "Camera FOV Cones & Wedges", "COVERAGE", 0.7, True),
            ("BLIND_SPOTS", "Tactical Blind-Spot Heatmap", "BLIND_SPOTS", 0.85, True),
            ("SENSORS", "Radar, Seismic & Acoustic Fleet", "SENSORS", 0.9, True),
            ("DRONES", "Active UAV Patrol Orbits", "DRONES", 0.95, True),
            ("ZONES", "Virtual Security Zones & Tripwires", "ZONES", 0.8, True),
            ("TERRAIN", "Elevation & Ravine Contours", "TERRAIN", 0.6, False),
            ("INCIDENTS", "Live Incident Hotspots", "INCIDENTS", 1.0, True)
        ]
        created = []
        for l_id, name, l_type, opacity, visible in layer_defs:
            lyr = GISLayer(
                layer_id=f"LYR-{l_id}",
                name=name,
                layer_type=l_type,
                site_id=site_id,
                is_visible=visible,
                opacity=opacity,
                features_geojson="{}",
                config_json="{}"
            )
            db.add(lyr)
            created.append(lyr)
        db.commit()
        return created

    @staticmethod
    def update_layer(db: Session, layer_id: str, data: GISLayerUpdate) -> Optional[GISLayer]:
        lyr = db.query(GISLayer).filter(GISLayer.layer_id == layer_id).first()
        if not lyr:
            return None
        if data.is_visible is not None:
            lyr.is_visible = data.is_visible
        if data.opacity is not None:
            lyr.opacity = data.opacity
        if data.features_geojson is not None:
            lyr.features_geojson = data.features_geojson
        if data.config_json is not None:
            lyr.config_json = data.config_json
        lyr.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(lyr)
        return lyr

    @classmethod
    def calculate_camera_fov_polygon(
        cls,
        lat: float,
        lng: float,
        heading_deg: float,
        horizontal_fov_deg: float,
        range_meters: float,
        mount_height_m: float = 12.0,
        tilt_deg: float = -15.0,
        num_arc_points: int = 12
    ) -> List[List[float]]:
        """
        Computes accurate geospatial ground polygon for a camera FOV cone.
        Returns GeoJSON coordinates list: [[lng, lat], [lng, lat], ...]
        """
        # Validate coordinates
        lat = max(-90.0, min(90.0, lat))
        lng = max(-180.0, min(180.0, lng))

        # Effective ground range adjustment based on mounting height and tilt angle
        tilt_rad = math.radians(abs(tilt_deg))
        effective_range = range_meters
        if tilt_rad > 0:
            effective_range = min(range_meters, range_meters * math.cos(tilt_rad) + (mount_height_m * 2.0))

        half_fov = horizontal_fov_deg / 2.0
        start_angle = (heading_deg - half_fov) % 360.0
        end_angle = (heading_deg + half_fov) % 360.0

        coords = []
        # Origin vertex (Camera Tower position)
        coords.append([round(lng, 6), round(lat, 6)])

        # Generate smooth circular arc for the field of view cone
        step = horizontal_fov_deg / (num_arc_points - 1)
        for i in range(num_arc_points):
            angle = heading_deg - half_fov + (i * step)
            bearing_rad = math.radians(angle)
            
            # Destination point using spherical geodesy
            d_over_r = effective_range / EARTH_RADIUS_M
            lat_rad = math.radians(lat)
            lng_rad = math.radians(lng)

            dest_lat_rad = math.asin(
                math.sin(lat_rad) * math.cos(d_over_r) +
                math.cos(lat_rad) * math.sin(d_over_r) * math.cos(bearing_rad)
            )
            dest_lng_rad = lng_rad + math.atan2(
                math.sin(bearing_rad) * math.sin(d_over_r) * math.cos(lat_rad),
                math.cos(d_over_r) - math.sin(lat_rad) * math.sin(dest_lat_rad)
            )

            dest_lat = math.degrees(dest_lat_rad)
            dest_lng = math.degrees(dest_lng_rad)
            coords.append([round(dest_lng, 6), round(dest_lat, 6)])

        # Close polygon
        coords.append([round(lng, 6), round(lat, 6)])
        return coords

    @classmethod
    def get_or_calculate_fov(cls, db: Session, camera_id: str) -> CameraFOV:
        fov = db.query(CameraFOV).filter(CameraFOV.camera_id == camera_id).first()
        cam = db.query(Camera).filter(Camera.camera_id == camera_id).first()
        
        lat = (cam.latitude if cam and cam.latitude is not None else 31.6240)
        lng = (cam.longitude if cam and cam.longitude is not None else 74.8720)
        
        # Default headings per camera ID to form realistic border coverage
        default_heading = 45.0 if camera_id == "CAM-001" else 135.0 if camera_id == "CAM-002" else 90.0

        if not fov:
            poly_coords = cls.calculate_camera_fov_polygon(
                lat=lat,
                lng=lng,
                heading_deg=default_heading,
                horizontal_fov_deg=65.0,
                range_meters=350.0
            )
            geojson_poly = {
                "type": "Polygon",
                "coordinates": [poly_coords]
            }
            fov = CameraFOV(
                fov_id=f"FOV-{camera_id}",
                camera_id=camera_id,
                site_id=cam.site_id if cam else "SITE-BORDER-NORTH",
                bop_id=cam.bop_id if cam else "BOP-ALPHA",
                latitude=lat,
                longitude=lng,
                heading_deg=default_heading,
                horizontal_fov_deg=65.0,
                vertical_fov_deg=45.0,
                range_meters=350.0,
                mount_height_m=12.0,
                tilt_deg=-15.0,
                polygon_geojson=json.dumps(geojson_poly)
            )
            db.add(fov)
            db.commit()
            db.refresh(fov)
        return fov

