from typing import List, Dict, Any, Optional
from datetime import datetime
import json
from sqlalchemy.orm import Session

from app.models.federation_models import Site, BOP, ConfigurationScope
from app.models.camera import Camera
from app.models.edge_node import EdgeNode
from app.models.incident import Incident
from app.models.alert import Alert
from app.models.user import User
from app.services.federation.scope_service import ScopeService

class FederationService:
    """
    Coordinates multi-site telemetry aggregation, hierarchical health scoring,
    risk propagation, global search, and configuration inheritance.
    """

    @staticmethod
    def get_bop_health(bop_id: str, db: Session) -> Dict[str, Any]:
        """Calculates explainable health score for a specific BOP."""
        bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
        bop_name = bop.name if bop else bop_id

        # Query cameras for this BOP
        cameras = db.query(Camera).filter(
            (Camera.bop_site == bop_name) | (Camera.bop_id == bop_id)
        ).all()

        total_cams = len(cameras)
        if total_cams == 0:
            return {
                "health_score": 100.0,
                "health_status": "HEALTHY",
                "total_cameras": 0,
                "online_cameras": 0,
                "offline_cameras": 0,
                "degraded_cameras": 0
            }

        online = sum(1 for c in cameras if c.status in ["HEALTHY", "ONLINE"] and not c.is_maintenance)
        degraded = sum(1 for c in cameras if c.status == "DEGRADED" and not c.is_maintenance)
        offline = sum(1 for c in cameras if c.status in ["OFFLINE", "ERROR"] and not c.is_maintenance)
        maintenance = sum(1 for c in cameras if c.is_maintenance)

        active_pool = total_cams - maintenance
        if active_pool <= 0:
            return {
                "health_score": 100.0,
                "health_status": "HEALTHY",
                "total_cameras": total_cams,
                "online_cameras": 0,
                "offline_cameras": 0,
                "degraded_cameras": 0
            }

        # Weighted calculation
        avail_ratio = (online + (degraded * 0.5)) / active_pool
        fps_health = 1.0
        fps_degraded_count = sum(
            1 for c in cameras 
            if (c.fps or 0.0) < ((c.expected_fps or 25.0) * 0.6) and c.status in ["HEALTHY", "ONLINE"]
        )
        if online > 0:
            fps_health = max(0.4, 1.0 - (fps_degraded_count / online * 0.5))

        score = round(((avail_ratio * 0.7) + (fps_health * 0.3)) * 100.0, 1)

        # Status classification
        if score >= 85.0:
            status = "HEALTHY"
        elif score >= 70.0:
            status = "DEGRADED"
        elif score >= 50.0:
            status = "WARNING"
        else:
            status = "CRITICAL"

        return {
            "health_score": score,
            "health_status": status,
            "total_cameras": total_cams,
            "online_cameras": online,
            "offline_cameras": offline,
            "degraded_cameras": degraded
        }

    @staticmethod
    def get_site_health(site_id: str, db: Session) -> Dict[str, Any]:
        """Calculates hierarchical health score for a Site aggregated across its BOPs."""
        bops = db.query(BOP).filter(BOP.site_id == site_id).all()
        if not bops:
            return {
                "health_score": 100.0,
                "health_status": "HEALTHY",
                "bops_count": 0,
                "total_cameras": 0,
                "online_cameras": 0,
                "offline_cameras": 0,
                "degraded_cameras": 0
            }

        bop_scores = []
        tot_cams = 0
        tot_online = 0
        tot_offline = 0
        tot_degraded = 0

        for b in bops:
            bh = FederationService.get_bop_health(b.bop_id, db)
            bop_scores.append(bh["health_score"])
            tot_cams += bh["total_cameras"]
            tot_online += bh["online_cameras"]
            tot_offline += bh["offline_cameras"]
            tot_degraded += bh["degraded_cameras"]

        avg_score = round(sum(bop_scores) / len(bop_scores), 1) if bop_scores else 100.0
        
        # Check edge nodes for site
        edge_nodes = db.query(EdgeNode).filter(EdgeNode.site_id == site_id).all()
        if edge_nodes:
            offline_edges = sum(1 for e in edge_nodes if e.status == "OFFLINE")
            if offline_edges > 0:
                avg_score = round(max(20.0, avg_score - (offline_edges * 15.0)), 1)

        if avg_score >= 85.0:
            status = "HEALTHY"
        elif avg_score >= 70.0:
            status = "DEGRADED"
        elif avg_score >= 50.0:
            status = "WARNING"
        else:
            status = "CRITICAL"

        return {
            "health_score": avg_score,
            "health_status": status,
            "bops_count": len(bops),
            "total_cameras": tot_cams,
            "online_cameras": tot_online,
            "offline_cameras": tot_offline,
            "degraded_cameras": tot_degraded
        }

    @staticmethod
    def get_bop_risk(bop_id: str, db: Session) -> int:
        """Calculates current risk score for a BOP based on active incidents and alerts."""
        bop = db.query(BOP).filter((BOP.bop_id == bop_id) | (BOP.name == bop_id)).first()
        bop_name = bop.name if bop else bop_id

        # Query active incidents
        active_inc = db.query(Incident).filter(
            (Incident.bop_site == bop_name) | (Incident.bop_id == bop_id),
            Incident.status.in_(["ACTIVE", "UNDER_INVESTIGATION", "ESCALATED"])
        ).all()

        base_risk = 20
        if not active_inc:
            return base_risk

        crit_count = sum(1 for i in active_inc if i.priority == "CRITICAL")
        high_count = sum(1 for i in active_inc if i.priority == "HIGH")
        med_count = sum(1 for i in active_inc if i.priority in ["MEDIUM", "NORMAL"])

        calculated = base_risk + (crit_count * 30) + (high_count * 15) + (med_count * 5)
        return min(100, max(0, calculated))

    @staticmethod
    def get_site_risk(site_id: str, db: Session) -> int:
        """Calculates composite risk score for a Site across its BOPs."""
        bops = db.query(BOP).filter(BOP.site_id == site_id).all()
        if not bops:
            return 15
        risks = [FederationService.get_bop_risk(b.bop_id, db) for b in bops]
        # Return maximum BOP risk with slight dampening
        return max(risks) if risks else 15

    @staticmethod
    def resolve_effective_config(
        config_key: str,
        site_id: Optional[str] = None,
        bop_id: Optional[str] = None,
        zone_id: Optional[str] = None,
        camera_id: Optional[str] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Resolves configuration key using hierarchy inheritance:
        CAMERA (highest priority) -> ZONE -> BOP -> SITE -> GLOBAL (fallback).
        """
        levels = [
            ("CAMERA", camera_id),
            ("ZONE", zone_id),
            ("BOP", bop_id),
            ("SITE", site_id),
            ("GLOBAL", "*")
        ]

        chain = []
        effective_val = None
        resolved_level = "GLOBAL"
        resolved_scope = "*"

        for level_name, scope_val in levels:
            if not scope_val:
                continue
            cfg = db.query(ConfigurationScope).filter(
                ConfigurationScope.scope_level == level_name,
                ConfigurationScope.scope_id == scope_val,
                ConfigurationScope.config_key == config_key
            ).first()
            if cfg:
                parsed_val = json.loads(cfg.config_value_json) if cfg.config_value_json else None
                entry = {
                    "level": level_name,
                    "scope_id": scope_val,
                    "value": parsed_val,
                    "overridden_by": cfg.overridden_by,
                    "reason": cfg.reason
                }
                chain.append(entry)
                if effective_val is None:
                    effective_val = parsed_val
                    resolved_level = level_name
                    resolved_scope = scope_val

        # If completely unconfigured, provide safe system default
        if effective_val is None:
            effective_val = "DEFAULT"
            resolved_level = "SYSTEM_DEFAULT"
            resolved_scope = "DEFAULT"

        return {
            "config_key": config_key,
            "effective_value": effective_val,
            "resolved_from_level": resolved_level,
            "resolved_scope_id": resolved_scope,
            "inheritance_chain": chain
        }

    @staticmethod
    def global_search(query_str: str, user: User, db: Session, limit: int = 50) -> List[Dict[str, Any]]:
        """Performs scoped multi-faceted search across sites, BOPs, cameras, and incidents."""
        results = []
        q = f"%{query_str.strip().lower()}%"

        # 1. Search Sites
        sites_q = db.query(Site).filter(
            (Site.name.ilike(q)) | (Site.code.ilike(q)) | (Site.site_id.ilike(q))
        )
        sites = sites_q.limit(limit).all()
        for s in sites:
            if ScopeService.can_access_site(user, s.site_id, db):
                results.append({
                    "entity_type": "SITE",
                    "entity_id": s.site_id,
                    "name_or_title": s.name,
                    "site_id": s.site_id,
                    "status": s.status,
                    "details": {"code": s.code, "timezone": s.timezone}
                })

        # 2. Search BOPs
        bops_q = db.query(BOP).filter(
            (BOP.name.ilike(q)) | (BOP.code.ilike(q)) | (BOP.bop_id.ilike(q))
        )
        bops = bops_q.limit(limit).all()
        for b in bops:
            if ScopeService.can_access_bop(user, b.bop_id, db):
                results.append({
                    "entity_type": "BOP",
                    "entity_id": b.bop_id,
                    "name_or_title": b.name,
                    "site_id": b.site_id,
                    "bop_name": b.name,
                    "status": b.status,
                    "risk_or_severity": b.operational_priority,
                    "details": {"code": b.code}
                })

        # 3. Search Cameras
        cams_q = db.query(Camera).filter(
            (Camera.camera_name.ilike(q)) | (Camera.camera_id.ilike(q)) | (Camera.location.ilike(q))
        )
        cams_q = ScopeService.filter_query_by_scope(cams_q, Camera, user, db)
        cameras = cams_q.limit(limit).all()
        for c in cameras:
            results.append({
                "entity_type": "CAMERA",
                "entity_id": c.camera_id,
                "name_or_title": c.camera_name,
                "site_id": c.site_id or "SITE-BORDER-NORTH",
                "bop_name": c.bop_site,
                "status": c.status,
                "details": {"fps": c.fps, "resolution": c.resolution}
            })

        # 4. Search Incidents
        inc_q = db.query(Incident).filter(
            (Incident.title.ilike(q)) | (Incident.incident_id.ilike(q)) | (Incident.incident_type.ilike(q))
        )
        inc_q = ScopeService.filter_query_by_scope(inc_q, Incident, user, db)
        incidents = inc_q.limit(limit).all()
        for i in incidents:
            results.append({
                "entity_type": "INCIDENT",
                "entity_id": i.incident_id,
                "name_or_title": i.title,
                "site_id": i.site_id or "SITE-BORDER-NORTH",
                "bop_name": i.bop_site,
                "status": i.status,
                "risk_or_severity": i.priority,
                "timestamp": i.created_at.isoformat() if i.created_at else None,
                "details": {"risk_score": i.risk_score, "camera_id": i.camera_id}
            })

        return results[:limit]
