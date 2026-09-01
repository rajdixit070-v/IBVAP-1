import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.activity_snapshot import ActivitySnapshot
from app.models.activity_baseline import ActivityBaseline

class TimeSeriesEngine:
    """
    Time-Series Activity Aggregation Engine.
    Aggregates historical and real-time activity across configurable windows
    and detects linear trends and variance profiles.
    """

    def aggregate_activity(
        self,
        target_type: str, # "camera", "zone", "site"
        target_id: str,
        window_minutes: int = 15,
        history_points: int = 12
    ) -> Tuple[List[Dict[str, Any]], str, float]:
        """
        Aggregates activity time-series for a target.
        Returns: (points_list, trend_status, trend_slope)
        """
        db: Session = SessionLocal()
        try:
            query = db.query(ActivitySnapshot)
            if target_type == "camera":
                query = query.filter(ActivitySnapshot.camera_id == target_id)
            elif target_type == "zone":
                query = query.filter(ActivitySnapshot.zone_id == target_id)
            elif target_type == "site":
                query = query.filter(ActivitySnapshot.site_id == target_id)

            snapshots = query.order_by(ActivitySnapshot.timestamp.desc()).limit(history_points).all()
            snapshots = list(reversed(snapshots)) # Chronological order

            # If no snapshots exist in DB, synthesize baseline timeline points
            now = datetime.utcnow()
            points = []
            values = []

            if not snapshots:
                # Query actual real observations and security events for this camera/zone
                from app.models.security_event import SecurityEvent
                from app.models.multimodal_models import AIObservation
                for i in range(history_points):
                    pt_start = now - timedelta(minutes=(history_points - i) * window_minutes)
                    pt_end = now - timedelta(minutes=(history_points - 1 - i) * window_minutes)

                    evt_query = db.query(SecurityEvent).filter(
                        SecurityEvent.started_at >= pt_start,
                        SecurityEvent.started_at < pt_end
                    )
                    obs_query = db.query(AIObservation).filter(
                        AIObservation.timestamp >= pt_start,
                        AIObservation.timestamp < pt_end
                    )

                    if target_type == "camera":
                        evt_query = evt_query.filter(SecurityEvent.camera_id == target_id)
                        obs_query = obs_query.filter(AIObservation.camera_id == target_id)

                    evt_count = evt_query.count()
                    obs_count = obs_query.count()
                    actual = evt_count + obs_count

                    base = max(1.0, float(actual))
                    std = max(1.0, base * 0.2)
                    lower = max(0.0, base - 1.96 * std)
                    upper = base + 1.96 * std

                    points.append({
                        "timestamp": pt_end,
                        "actual_count": actual,
                        "expected_count": round(base, 1),
                        "lower_bound": round(lower, 1),
                        "upper_bound": round(upper, 1),
                        "is_spike": actual > 5,
                        "is_drop": False
                    })
                    values.append(actual)
            else:
                for s in snapshots:
                    total_act = s.person_count + s.vehicle_count + s.security_event_count
                    values.append(total_act)
                    hr = s.timestamp.hour
                    is_night = hr >= 22 or hr <= 5
                    base = 3.0 if is_night else 15.0
                    std = 3.0
                    lower = max(0.0, base - 1.96 * std)
                    upper = base + 1.96 * std
                    points.append({
                        "timestamp": s.timestamp,
                        "actual_count": total_act,
                        "expected_count": round(base, 1),
                        "lower_bound": round(lower, 1),
                        "upper_bound": round(upper, 1),
                        "is_spike": total_act > upper,
                        "is_drop": total_act < lower
                    })

            # Calculate Trend via Linear Regression
            slope = self._calculate_slope(values)
            if slope > 0.4:
                trend = "INCREASING"
            elif slope < -0.4:
                trend = "DECREASING"
            elif self._calculate_variance(values) > 15.0:
                trend = "VOLATILE"
            else:
                trend = "STABLE"

            return points, trend, round(slope, 2)
        finally:
            db.close()

    def _calculate_slope(self, values: List[float]) -> float:
        n = len(values)
        if n < 2: return 0.0
        x = list(range(n))
        x_mean = sum(x) / n
        y_mean = sum(values) / n
        numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean)**2 for i in range(n))
        if denominator == 0: return 0.0
        return numerator / denominator

    def _calculate_variance(self, values: List[float]) -> float:
        n = len(values)
        if n < 2: return 0.0
        mean = sum(values) / n
        return sum((v - mean)**2 for v in values) / (n - 1)

time_series_engine = TimeSeriesEngine()
