import json
import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.camera import Camera
from app.models.edge_node import EdgeNode
from app.models.health_models import HealthEvent, MaintenanceWindow
from app.schemas.health_schemas import (
    DiagnosticResultItem,
    DiagnosticRecommendation
)

logger = logging.getLogger("ibvap.health.diagnostics")

class SelfDiagnosticEngine:
    """
    Correlates multi-layer symptoms across cameras, RTSP streams, edge nodes,
    network links, storage, and AI workers to identify likely root causes,
    prevent alert duplication, and automate Phase 10 Infrastructure Incident generation.
    """

    def evaluate_diagnostics(self) -> List[DiagnosticResultItem]:
        """
        Runs comprehensive correlation rules against live infrastructure telemetry.
        """
        db: Session = SessionLocal()
        findings: List[DiagnosticResultItem] = []
        now = datetime.utcnow()

        try:
            # Check active maintenance windows
            active_maint = db.query(MaintenanceWindow).filter(MaintenanceWindow.status == "ACTIVE").all()
            maint_targets = {f"{m.target_type}:{m.target_id}" for m in active_maint}

            cameras = db.query(Camera).all()
            nodes = db.query(EdgeNode).all()

            # Group cameras by edge node and status
            cams_by_node: Dict[str, List[Camera]] = {}
            offline_cams_by_node: Dict[str, List[Camera]] = {}
            high_latency_cams: List[Camera] = []

            for c in cameras:
                if f"CAMERA:{c.camera_id}" in maint_targets or c.is_maintenance:
                    continue
                node_id = c.edge_node_id or "UNKNOWN"
                cams_by_node.setdefault(node_id, []).append(c)
                if c.status in ["OFFLINE", "ERROR"]:
                    offline_cams_by_node.setdefault(node_id, []).append(c)
                if (c.stream_latency_ms or 0.0) > 120.0:
                    high_latency_cams.append(c)

            # Rule 1: Correlated Edge Node Unresponsive / Disconnect
            for node in nodes:
                if f"EDGE_NODE:{node.node_id}" in maint_targets:
                    continue

                hb_age = (now - node.last_heartbeat).total_seconds() if node.last_heartbeat else 999.0
                offline_attached = offline_cams_by_node.get(node.node_id, [])
                total_attached = cams_by_node.get(node.node_id, [])

                if hb_age > 60.0 or node.status == "OFFLINE":
                    # Correlated edge failure
                    affected_ids = [c.camera_id for c in offline_attached]
                    if not affected_ids and total_attached:
                        affected_ids = [c.camera_id for c in total_attached]

                    diag_id = f"DIAG-EDGE-{node.node_id}"
                    finding = DiagnosticResultItem(
                        diagnostic_id=diag_id,
                        event_type="EDGE_NODE_UNRESPONSIVE",
                        severity="CRITICAL",
                        what_happened=f"Edge appliance {node.node_id} ({node.name}) is unresponsive; {len(affected_ids)} camera streams unavailable.",
                        affected_components=[f"Node: {node.node_id}"] + [f"Camera: {cid}" for cid in affected_ids],
                        possible_root_cause="Likely edge-node network partition, power interruption, or hardware reboot.",
                        confidence_percent=92.0 if len(affected_ids) >= 2 else 78.0,
                        evidence_signals=[
                            f"Edge heartbeat overdue by {int(hb_age)}s (threshold 60s)",
                            f"{len(affected_ids)} attached camera streams lost concurrently",
                            f"Site: {node.bop_site}"
                        ],
                        recommendations=[
                            DiagnosticRecommendation(
                                action_type="INSPECT_EDGE",
                                recommendation=f"Inspect edge node {node.node_id} physical power and link LEDs at {node.bop_site}.",
                                priority="CRITICAL"
                            ),
                            DiagnosticRecommendation(
                                action_type="CHECK_CONNECTIVITY",
                                recommendation="Ping edge appliance local gateway IP to verify field switch status.",
                                priority="HIGH"
                            )
                        ],
                        detected_at=now
                    )
                    findings.append(finding)
                    self._ensure_infrastructure_incident(
                        db=db,
                        title=f"Edge Node Unresponsive: {node.node_id} ({len(affected_ids)} Cameras Affected)",
                        description=finding.what_happened,
                        camera_id=affected_ids[0] if affected_ids else "CAM-001",
                        related_cameras=affected_ids,
                        bop_site=node.bop_site,
                        severity="CRITICAL"
                    )

            # Rule 2: Multi-Camera Network Link Degradation
            if len(high_latency_cams) >= 3:
                diag_id = "DIAG-NET-DEGRADATION"
                affected_cams = [c.camera_id for c in high_latency_cams]
                finding = DiagnosticResultItem(
                    diagnostic_id=diag_id,
                    event_type="NETWORK_DEGRADATION",
                    severity="HIGH",
                    what_happened=f"Multi-camera stream latency elevation detected across {len(affected_cams)} streams.",
                    affected_components=[f"Camera: {cid}" for cid in affected_cams],
                    possible_root_cause="Possible wireless backhaul congestion, microwave fade, or switch port packet drops.",
                    confidence_percent=85.0,
                    evidence_signals=[
                        f"{len(affected_cams)} camera streams exceeding 120ms latency",
                        f"Average observed latency: {round(sum(c.stream_latency_ms for c in high_latency_cams) / len(high_latency_cams), 1)}ms",
                        "Correlated across multiple distinct edge endpoints"
                    ],
                    recommendations=[
                        DiagnosticRecommendation(
                            action_type="INSPECT_NETWORK",
                            recommendation="Inspect border microwave / optical transport link bandwidth utilization.",
                            priority="HIGH"
                        ),
                        DiagnosticRecommendation(
                            action_type="ENABLE_LOW_BANDWIDTH",
                            recommendation="Recommend enabling Phase 5 Low-Bandwidth Mode on affected sector.",
                            priority="MEDIUM"
                        )
                    ],
                    detected_at=now
                )
                findings.append(finding)

            # Rule 3: Single Isolated Camera Offline (when Edge Node is healthy)
            for node_id, off_cams in offline_cams_by_node.items():
                node_match = next((n for n in nodes if n.node_id == node_id), None)
                if node_match and (now - node_match.last_heartbeat).total_seconds() < 60.0:
                    # Edge node is completely online, only single camera failed
                    for c in off_cams:
                        diag_id = f"DIAG-CAM-OFFLINE-{c.camera_id}"
                        finding = DiagnosticResultItem(
                            diagnostic_id=diag_id,
                            event_type="CAMERA_OFFLINE",
                            severity="HIGH" if c.priority == "CRITICAL" else "MEDIUM",
                            what_happened=f"Camera {c.camera_id} ({c.camera_name}) stream disconnected while edge node is healthy.",
                            affected_components=[f"Camera: {c.camera_id}"],
                            possible_root_cause="Possible local camera RTSP failure, PoE power injector trip, or patch cord disconnection.",
                            confidence_percent=88.0,
                            evidence_signals=[
                                f"No RTSP frames received for {c.camera_id}",
                                f"Host Edge Node {node_id} is healthy and reporting",
                                f"Reconnect attempts: {c.reconnect_count}"
                            ],
                            recommendations=[
                                DiagnosticRecommendation(
                                    action_type="CHECK_CREDENTIALS",
                                    recommendation=f"Verify camera {c.camera_id} RTSP authentication and IP responsiveness.",
                                    priority="HIGH"
                                ),
                                DiagnosticRecommendation(
                                    action_type="CHECK_CONNECTIVITY",
                                    recommendation=f"Inspect field PoE injector or terminal box for {c.camera_name}.",
                                    priority="MEDIUM"
                                )
                            ],
                            detected_at=now
                        )
                        findings.append(finding)

            return findings

        finally:
            db.close()

    def _ensure_infrastructure_incident(
        self,
        db: Session,
        title: str,
        description: str,
        camera_id: str,
        related_cameras: List[str],
        bop_site: str,
        severity: str = "HIGH"
    ):
        """
        Creates or updates a Phase 10 INFRASTRUCTURE incident without duplicates.
        """
        try:
            from app.models.incident import Incident
            from app.services.incident.incident_service import incident_service
            from app.schemas.incident import IncidentCreate

            # Check if an active infrastructure incident already exists for this site within 30 mins
            cutoff = datetime.utcnow() - timedelta(minutes=30)
            existing = db.query(Incident).filter(
                Incident.incident_type == "INFRASTRUCTURE",
                Incident.bop_site == bop_site,
                Incident.status.in_(["NEW", "TRIAGED", "ASSIGNED", "INVESTIGATING", "RESPONDING", "CONTAINED"]),
                Incident.created_at >= cutoff
            ).first()

            if existing:
                rel = json.loads(existing.related_cameras_json or "[]")
                updated = False
                for cid in related_cameras:
                    if cid not in rel:
                        rel.append(cid)
                        updated = True
                if updated:
                    existing.related_cameras_json = json.dumps(rel)
                    db.commit()
                return

            # Otherwise, create an Infrastructure Incident using PB-INFRASTRUCTURE-OUTAGE
            create_payload = IncidentCreate(
                title=title,
                description=description,
                priority=severity,
                incident_type="INFRASTRUCTURE",
                camera_id=camera_id,
                bop_site=bop_site,
                playbook_id="PB-INFRASTRUCTURE-OUTAGE",
                risk_score=75 if severity == "HIGH" else 90
            )
            incident_service.create_incident(create_payload, operator_username="system_diagnostics")
            logger.info(f"Created Infrastructure Incident for {title}")
        except Exception as e:
            logger.error(f"Failed to record infrastructure incident: {e}")

diagnostic_engine = SelfDiagnosticEngine()
