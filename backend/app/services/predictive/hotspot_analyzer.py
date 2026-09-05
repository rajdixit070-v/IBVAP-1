import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.zone import SecurityZone
from app.models.camera import Camera
from app.models.security_event import SecurityEvent
from app.models.behaviour_event import BehaviourEvent

logger = logging.getLogger("ibvap.predictive.hotspot")

class HotspotAnalyzer:
    """
    Spatial Activity and Security Hotspot Analyzer.
    Computes activity density across geographic sectors without demographic bias.
    """

    def analyze_zone_hotspots(self) -> List[Dict[str, Any]]:
        """
        Analyzes security event and behaviour anomaly density across all registered virtual zones.
        """
        db: Session = SessionLocal()
        try:
            zones = db.query(SecurityZone).all()
            hotspots = []

            for z in zones:
                cam = db.query(Camera).filter(Camera.camera_id == z.camera_id).first()
                lat = float(cam.latitude) if (cam and cam.latitude is not None) else 32.7266
                lon = float(cam.longitude) if (cam and cam.longitude is not None) else 74.8570
                site = cam.bop_site if (cam and cam.bop_site) else "BOP Alpha"



                sec_events_count = db.query(SecurityEvent).filter(SecurityEvent.zone_name == z.name).count()
                bhv_events_count = db.query(BehaviourEvent).filter(BehaviourEvent.zone_id == z.zone_id).count()
                
                total_events = sec_events_count + bhv_events_count
                baseline = 5.0
                dev_pct = round(((total_events - baseline) / baseline) * 100.0, 1)

                if total_events >= 15:
                    level = "HIGH"
                    density = 8.5
                    risk_score = 82
                elif total_events >= 8:
                    level = "ELEVATED"
                    density = 5.8
                    risk_score = 64
                elif total_events >= 3:
                    level = "WATCH"
                    density = 3.2
                    risk_score = 42
                else:
                    level = "NORMAL"
                    density = 1.0
                    risk_score = 18

                factors = []
                if sec_events_count > 0:
                    factors.append(f"{sec_events_count} perimeter intrusion / loitering events")
                if bhv_events_count > 0:
                    factors.append(f"{bhv_events_count} behavioural probing / kinetic anomalies")
                if not factors:
                    factors.append("Routine sector surveillance density")

                hotspots.append({
                    "zone_id": z.zone_id,
                    "name": z.name,
                    "camera_id": z.camera_id,
                    "bop_site": site,
                    "latitude": lat,
                    "longitude": lon,
                    "hotspot_level": level,
                    "activity_density": density,
                    "current_activity": total_events,
                    "baseline_activity": baseline,
                    "deviation_percent": dev_pct,
                    "risk_score": risk_score,
                    "contributing_factors": factors
                })

            return hotspots
        finally:
            db.close()

hotspot_analyzer = HotspotAnalyzer()
