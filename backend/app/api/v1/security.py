import csv
import io
import json
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.enterprise_security_models import (
    SecurityThreatEvent,
    EdgeNodeCredential,
    BlockedIPEntry,
    SecurityAuditLogEntry
)
from app.schemas.enterprise_security_schemas import (
    SecurityThreatEventResponse,
    SecurityThreatEventCreate,
    SecurityThreatResolveRequest,
    EdgeNodeKeyIssueRequest,
    EdgeNodeKeyResponse,
    EdgeNodeKeyIssuedSecretResponse,
    EdgeNodeRevokeRequest,
    BlockedIPResponse,
    BlockIPRequest,
    SecurityPostureOverview,
    SecurityAuditLogResponse
)
from app.api.deps import get_current_user, get_current_user_optional, require_admin, require_super_admin
from app.services.security.security_correlation_engine import SecurityCorrelationEngine
from app.services.security.edge_auth_service import EdgeAuthService
from app.services.security.auth_rate_limiter import AuthRateLimiter

router = APIRouter(prefix="/security", tags=["Enterprise Security & Zero-Trust"])

@router.get("/overview", response_model=SecurityPostureOverview)
def get_security_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves high-level Zero-Trust Security Posture score, metrics, and findings."""
    return SecurityCorrelationEngine.get_security_posture_overview(db)

@router.get("/threats", response_model=List[SecurityThreatEventResponse])
def list_security_threats(
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists security threat events with filtering options."""
    query = db.query(SecurityThreatEvent)
    if severity and severity != "ALL":
        query = query.filter(SecurityThreatEvent.severity == severity)
    if event_type and event_type != "ALL":
        query = query.filter(SecurityThreatEvent.event_type == event_type)
    if status and status != "ALL":
        query = query.filter(SecurityThreatEvent.status == status)

    return query.order_by(SecurityThreatEvent.timestamp.desc()).limit(limit).all()

@router.post("/threats", response_model=SecurityThreatEventResponse)
def record_custom_threat(
    threat_in: SecurityThreatEventCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Records a new security threat event and runs real-time correlation."""
    return SecurityCorrelationEngine.record_threat(
        event_type=threat_in.event_type,
        severity=threat_in.severity,
        source_ip=threat_in.source_ip,
        username=threat_in.username,
        target_resource=threat_in.target_resource,
        endpoint=threat_in.endpoint,
        details=threat_in.details,
        mitigation_action=threat_in.mitigation_action,
        user_agent=threat_in.user_agent,
        db=db
    )

@router.post("/threats/{threat_id}/resolve", response_model=SecurityThreatEventResponse)
def resolve_threat(
    threat_id: str,
    req: SecurityThreatResolveRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Marks a security threat event as resolved or contained."""
    threat = db.query(SecurityThreatEvent).filter(SecurityThreatEvent.event_id == threat_id).first()
    if not threat:
        raise HTTPException(status_code=404, detail=f"Threat event '{threat_id}' not found.")

    threat.status = req.status
    threat.resolved_by = current_user.username if current_user else "operator"
    threat.resolved_at = datetime.utcnow()
    threat.resolution_notes = req.resolution_notes
    db.commit()
    db.refresh(threat)
    return threat

@router.delete("/threats/clear-all")
@router.post("/threats/clear-all")
def clear_all_security_threats(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Purges all security threat events."""
    count = db.query(SecurityThreatEvent).delete()
    db.commit()
    return {"message": f"Successfully deleted {count} threat events.", "count": count}

@router.delete("/threats/{threat_id}")
def delete_security_threat(
    threat_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Deletes a security threat record."""
    threat = db.query(SecurityThreatEvent).filter(SecurityThreatEvent.event_id == threat_id).first()
    if not threat:
        raise HTTPException(status_code=404, detail="Threat event not found.")

    db.delete(threat)
    db.commit()
    return {"message": f"Threat event '{threat_id}' successfully deleted."}

@router.post("/purge-system-data")
@router.delete("/purge-system-data")
def purge_system_data(
    purge_evidence: bool = Query(True),
    purge_events: bool = Query(True),
    purge_alerts: bool = Query(True),
    purge_incidents: bool = Query(True),
    purge_notifications: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Master purge: Permanently removes all operational logs, alerts, evidence, incidents, and events in 1 click."""
    import os
    from app.models.evidence import Evidence
    from app.models.security_event import SecurityEvent
    from app.models.alert import Alert
    from app.models.incident import Incident
    from app.models.notification import Notification

    counts = {}

    if purge_evidence:
        ev_records = db.query(Evidence).all()
        for ev in ev_records:
            if ev.file_path and os.path.exists(ev.file_path) and os.path.isfile(ev.file_path):
                try:
                    os.remove(ev.file_path)
                except Exception:
                    pass
            db.delete(ev)
        counts["evidence_deleted"] = len(ev_records)

    if purge_events:
        counts["events_deleted"] = db.query(SecurityEvent).delete()

    if purge_alerts:
        counts["alerts_deleted"] = db.query(Alert).delete()

    if purge_incidents:
        counts["incidents_deleted"] = db.query(Incident).delete()

    if purge_notifications:
        counts["notifications_deleted"] = db.query(Notification).delete()

    db.commit()
    return {"status": "SUCCESS", "message": "Master system data purge completed successfully.", "summary": counts}

@router.post("/threats/correlate")
def run_threat_correlation(
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Manually triggers threat pattern correlation over recent telemetry."""
    patterns = SecurityCorrelationEngine.evaluate_correlation_rules(db)
    return {"message": "Correlation evaluation complete.", "detected_patterns": patterns}

@router.get("/edge-keys", response_model=List[EdgeNodeKeyResponse])
def list_edge_node_keys(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Lists cryptographic edge node credentials and status."""
    return db.query(EdgeNodeCredential).order_by(EdgeNodeCredential.created_at.desc()).all()

@router.post("/edge-keys", response_model=EdgeNodeKeyIssuedSecretResponse)
def issue_or_rotate_edge_key(
    req: EdgeNodeKeyIssueRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Issues or rotates an Edge Node API key. The plaintext key is returned ONCE."""
    api_key, cred = EdgeAuthService.issue_edge_key(
        node_id=req.node_id,
        site_id=req.site_id,
        bop_id=req.bop_id,
        expires_in_days=req.expires_in_days,
        actor=current_user.username,
        db=db
    )

    # Log audit
    audit = SecurityAuditLogEntry(
        audit_id=f"AUD-KEY-{int(datetime.utcnow().timestamp() * 1000)}",
        actor_username=current_user.username,
        action_type="EDGE_KEY_ISSUED",
        resource_type="EDGE_NODE",
        resource_id=req.node_id,
        new_value_json=json.dumps({"key_prefix": cred.key_prefix, "expires_at": str(cred.expires_at)}),
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()

    return {
        "node_id": req.node_id,
        "api_key": api_key,
        "key_prefix": cred.key_prefix,
        "expires_at": cred.expires_at,
        "message": "Key generated successfully. Store it safely; it will not be displayed again."
    }

@router.post("/edge-keys/{node_id}/revoke")
def revoke_edge_key(
    node_id: str,
    req: EdgeNodeRevokeRequest,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Revokes an edge node key immediately."""
    success = EdgeAuthService.revoke_edge_key(
        node_id=node_id,
        reason=req.reason,
        revoked_by=current_user.username,
        db=db
    )
    if not success:
        raise HTTPException(status_code=404, detail=f"Edge node '{node_id}' credential not found.")

    audit = SecurityAuditLogEntry(
        audit_id=f"AUD-KEYREV-{int(datetime.utcnow().timestamp() * 1000)}",
        actor_username=current_user.username,
        action_type="EDGE_KEY_REVOKED",
        resource_type="EDGE_NODE",
        resource_id=node_id,
        new_value_json=json.dumps({"reason": req.reason}),
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()

    return {"message": f"Edge node '{node_id}' credential revoked.", "status": "REVOKED"}

@router.get("/ip-blocklist", response_model=List[BlockedIPResponse])
def list_blocked_ips(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Lists currently active blocked IP entries."""
    return db.query(BlockedIPEntry).filter(BlockedIPEntry.is_active == True).all()

@router.post("/ip-blocklist", response_model=BlockedIPResponse)
def block_ip(
    req: BlockIPRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Manually adds an IP address to the blocklist."""
    entry = db.query(BlockedIPEntry).filter(BlockedIPEntry.ip_address == req.ip_address).first()
    blocked_until = datetime.utcnow() + timedelta(hours=req.duration_hours) if req.duration_hours else None

    if entry:
        entry.is_active = True
        entry.reason = req.reason
        entry.blocked_until = blocked_until
        entry.created_by = current_user.username
    else:
        entry = BlockedIPEntry(
            ip_address=req.ip_address,
            reason=req.reason,
            is_active=True,
            blocked_until=blocked_until,
            created_by=current_user.username
        )
        db.add(entry)

    db.commit()
    db.refresh(entry)
    return entry

@router.delete("/ip-blocklist/{ip_address}")
def unblock_ip(
    ip_address: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unblocks an IP address."""
    entry = db.query(BlockedIPEntry).filter(BlockedIPEntry.ip_address == ip_address).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"IP '{ip_address}' is not blocked.")

    entry.is_active = False
    db.commit()
    return {"message": f"IP '{ip_address}' unblocked successfully."}

@router.post("/accounts/{username}/unlock")
def unlock_operator_account(
    username: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Administratively unlocks a locked user account."""
    success = AuthRateLimiter.unlock_user_account(username, db)
    if not success:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found.")

    audit = SecurityAuditLogEntry(
        audit_id=f"AUD-UNLK-{int(datetime.utcnow().timestamp() * 1000)}",
        actor_username=current_user.username,
        action_type="ACCOUNT_UNLOCKED",
        resource_type="USER",
        resource_id=username,
        status="SUCCESS"
    )
    db.add(audit)
    db.commit()

    return {"message": f"Account '{username}' unlocked successfully."}

@router.get("/audit-logs", response_model=List[SecurityAuditLogResponse])
def list_security_audit_logs(
    action_type: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Lists tamper-evident security audit logs."""
    query = db.query(SecurityAuditLogEntry)
    if action_type and action_type != "ALL":
        query = query.filter(SecurityAuditLogEntry.action_type == action_type)

    return query.order_by(SecurityAuditLogEntry.created_at.desc()).limit(limit).all()

@router.get("/export-report")
def export_security_report(
    format: str = Query("json", pattern="^(json|csv)$"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Exports comprehensive Enterprise Security Posture Report."""
    overview = SecurityCorrelationEngine.get_security_posture_overview(db)

    if format == "json":
        return overview

    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Section", "Metric / Finding", "Value", "Status"])
    writer.writerow(["Overview", "Posture Score", f"{overview.posture_score}/100", overview.overall_status])
    writer.writerow(["Overview", "Active Threats", overview.active_threats_count, ""])
    writer.writerow(["Overview", "Critical Threats", overview.critical_threats_count, ""])
    writer.writerow(["Overview", "Locked Accounts", overview.locked_accounts_count, ""])
    writer.writerow(["Overview", "Revoked Edge Nodes", overview.revoked_edge_nodes_count, ""])
    writer.writerow(["Overview", "Blocked IPs", overview.blocked_ips_count, ""])

    for f in overview.findings:
        writer.writerow(["Finding", f.title, f.recommendation, f.severity])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=security_posture_report_{datetime.utcnow().strftime('%Y%m%d')}.csv"}
    )
