import json
import logging
import math
import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.sensor_models import Sensor, SensorFusionEvent
from app.schemas.sensor_schemas import MultiSensorFusionRequest

logger = logging.getLogger("ibvap.services.sensors.fusion")

# Default Sensor Reliability Matrix
SENSOR_RELIABILITY_MATRIX = {
    "RADAR": 0.92,
    "THERMAL": 0.90,
    "CAMERA": 0.88,
    "DRONE": 0.94,
    "SEISMIC": 0.78,
    "ACOUSTIC": 0.72,
    "WEATHER": 0.85,
    "OTHER": 0.70
}

class MultiSensorFusionEngine:
    """
    Module 1: Heterogeneous Multi-Sensor Bayesian Evidential Fusion Engine.
    Correlates Optical, Thermal, Radar, Seismic, Acoustic, and Drone signals with explainable confidence and conflict detection.
    """

    @classmethod
    def fuse_observations(
        cls,
        db: Session,
        request: MultiSensorFusionRequest
    ) -> SensorFusionEvent:
        """
        Main entry point for multi-sensor observation fusion.
        """
        obs_list = request.observations
        if not obs_list:
            raise ValueError("No sensor observations provided for fusion.")

        # 1. Normalize timestamps & Filter by time window
        now = datetime.utcnow()
        parsed_obs = []
        for obs in obs_list:
            ts = obs.get("timestamp")
            if isinstance(ts, str):
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
                except Exception:
                    dt = now
            elif isinstance(ts, (int, float)):
                dt = datetime.utcfromtimestamp(ts)
            else:
                dt = now
            
            # Check clock drift against time window
            delta_sec = abs((now - dt).total_seconds())
            if delta_sec <= (request.time_window_sec or 10.0):
                parsed_obs.append({**obs, "_normalized_dt": dt})

        if not parsed_obs:
            # Fallback to all observations if time windowing filtered everything out
            parsed_obs = [{**obs, "_normalized_dt": now} for obs in obs_list]

        # 2. Extract involved sensor IDs and calculate weighted evidence
        source_sensor_ids = list(set(obs.get("sensor_id", "UNKNOWN") for obs in parsed_obs))
        
        # Look up stored sensor reliability weights from database if available
        sensor_records = db.query(Sensor).filter(Sensor.sensor_id.in_(source_sensor_ids)).all()
        db_weights = {s.sensor_id: (s.reliability_weight or SENSOR_RELIABILITY_MATRIX.get(s.sensor_type, 0.85)) for s in sensor_records}

        # 3. Classify target types and evaluate consensus / conflicts
        event_types_detected = [obs.get("detection", obs.get("event_type", "UNKNOWN")).upper() for obs in parsed_obs]
        
        # Conflict Detection Analysis
        conflict_status, dominant_event_type, explanation = cls._evaluate_conflicts_and_consensus(parsed_obs)

        # 4. Bayesian Evidential Probability Combination
        fused_confidence, math_explanation = cls._calculate_bayesian_confidence(parsed_obs, db_weights)

        # 5. Geolocation estimation (weighted centroid of sensor/target coordinates)
        estimated_loc = cls._estimate_target_location(parsed_obs)

        # 6. Risk Scoring (0 to 100 based on event type, confidence, and conflict status)
        risk_score = cls._calculate_fusion_risk_score(dominant_event_type, fused_confidence, conflict_status)

        # 7. Confidence Level classification
        if fused_confidence >= 0.85:
            conf_level = "CRITICAL" if risk_score > 85 else "HIGH"
        elif fused_confidence >= 0.65:
            conf_level = "MEDIUM"
        else:
            conf_level = "LOW"

        fusion_event_id = f"SFE-{uuid.uuid4().hex[:12].upper()}"
        explanation["bayesian_math"] = math_explanation
        explanation["sensors_evaluated"] = source_sensor_ids

        fusion_event = SensorFusionEvent(
            fusion_event_id=fusion_event_id,
            site_id=request.site_id,
            bop_id=request.bop_id,
            sector=request.sector or "Sector-North",
            zone_id=parsed_obs[0].get("zone_id") if parsed_obs else None,
            fused_event_type=dominant_event_type,
            confidence=round(fused_confidence, 4),
            confidence_level=conf_level,
            conflict_status=conflict_status,
            fusion_method="BAYESIAN_EVIDENTIAL_FUSION",
            source_sensor_ids_json=json.dumps(source_sensor_ids),
            individual_observations_json=json.dumps([{k: v for k, v in o.items() if k != "_normalized_dt"} for o in parsed_obs]),
            confidence_explanation_json=json.dumps(explanation),
            location_json=json.dumps(estimated_loc),
            track_id=parsed_obs[0].get("track_id") if parsed_obs else None,
            global_track_id=parsed_obs[0].get("global_track_id"),
            risk_score=risk_score,
            is_acknowledged=False,
            timestamp=now
        )
        db.add(fusion_event)
        db.commit()
        db.refresh(fusion_event)

        logger.info(f"Generated SensorFusionEvent: {fusion_event.fusion_event_id} type={dominant_event_type} conf={fused_confidence} conflict={conflict_status}")
        return fusion_event

    @classmethod
    def _evaluate_conflicts_and_consensus(cls, observations: List[Dict[str, Any]]) -> Tuple[str, str, Dict[str, Any]]:
        """
        Detects sensor divergence (e.g. RGB sees human, Thermal sees cold background, Radar sees ground clutter).
        """
        types = [o.get("detection", o.get("event_type", "UNKNOWN")).upper() for o in observations]
        type_counts = {}
        for t in types:
            type_counts[t] = type_counts.get(t, 0) + 1

        dominant_type = max(type_counts, key=type_counts.get)
        total_obs = len(observations)
        consensus_ratio = type_counts[dominant_type] / total_obs

        has_negation = any(o.get("detection") in ("NONE", "CLEAR", "NO_TARGET") or o.get("confidence", 0) < 0.20 for o in observations)
        has_positive = any(o.get("detection") not in ("NONE", "CLEAR", "NO_TARGET") and o.get("confidence", 0) > 0.60 for o in observations)

        if has_negation and has_positive:
            conflict_status = "CONFLICTING_SENSORS"
            explanation = {
                "conflict_reason": "Divergent readings: Positive detection on one sensor modality contradicted by negative/clear reading on another.",
                "consensus_ratio": round(consensus_ratio, 2)
            }
        elif consensus_ratio < 0.60 and len(type_counts) > 1:
            conflict_status = "DEGRADED_CONSENSUS"
            explanation = {
                "conflict_reason": "Multiple distinct target classes detected simultaneously in same spatio-temporal cluster.",
                "consensus_ratio": round(consensus_ratio, 2)
            }
        else:
            conflict_status = "NONE"
            explanation = {
                "consensus_reason": f"High consensus among {total_obs} sensor observations on target class '{dominant_type}'.",
                "consensus_ratio": round(consensus_ratio, 2)
            }

        return conflict_status, dominant_type, explanation

    @classmethod
    def _calculate_bayesian_confidence(
        cls,
        observations: List[Dict[str, Any]],
        db_weights: Dict[str, float]
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Computes Bayesian combined belief from multiple independent sensor channels:
        P_fused = (Prod(p_i)) / (Prod(p_i) + Prod(1 - p_i))
        """
        p_list = []
        for o in observations:
            raw_conf = float(o.get("confidence", 0.75))
            sensor_id = o.get("sensor_id", "")
            sensor_type = o.get("sensor_type", "OTHER").upper()
            rel = db_weights.get(sensor_id, SENSOR_RELIABILITY_MATRIX.get(sensor_type, 0.80))
            
            # Calibrated probability: p_calibrated = 0.5 + rel * (raw_conf - 0.5)
            # Bound within [0.05, 0.99] to prevent mathematical singularities
            calibrated_p = max(0.05, min(0.99, 0.5 + rel * (raw_conf - 0.5)))
            p_list.append(calibrated_p)

        if not p_list:
            return 0.70, {"steps": "No valid probabilities"}

        if len(p_list) == 1:
            return p_list[0], {"single_sensor_p": p_list[0]}

        prod_p = 1.0
        prod_not_p = 1.0
        for p in p_list:
            prod_p *= p
            prod_not_p *= (1.0 - p)

        denominator = prod_p + prod_not_p
        if denominator == 0:
            fused_p = 0.5
        else:
            fused_p = prod_p / denominator

        # Clamp between 0.05 and 0.99
        fused_p = max(0.05, min(0.99, fused_p))

        math_detail = {
            "sensor_probabilities": [round(x, 4) for x in p_list],
            "numerator_prod_p": round(prod_p, 6),
            "denominator_sum": round(denominator, 6),
            "result_p": round(fused_p, 4)
        }
        return fused_p, math_detail

    @classmethod
    def _estimate_target_location(cls, observations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes weighted centroid of coordinate readings.
        """
        lats, lngs, weights = [], [], []
        for o in observations:
            loc = o.get("location")
            if isinstance(loc, dict) and "lat" in loc and "lng" in loc:
                try:
                    lat = float(loc["lat"])
                    lng = float(loc["lng"])
                    conf = float(o.get("confidence", 0.5))
                    lats.append(lat)
                    lngs.append(lng)
                    weights.append(conf)
                except (ValueError, TypeError):
                    continue

        if lats and sum(weights) > 0:
            total_w = sum(weights)
            avg_lat = sum(lats[i] * weights[i] for i in range(len(lats))) / total_w
            avg_lng = sum(lngs[i] * weights[i] for i in range(len(lngs))) / total_w
            return {"lat": round(avg_lat, 6), "lng": round(avg_lng, 6), "precision_radius_m": 25.0}
        return {"lat": 31.6240, "lng": 74.8720, "estimated": True}

    @classmethod
    def _calculate_fusion_risk_score(cls, event_type: str, confidence: float, conflict_status: str) -> int:
        """
        Calculates threat risk score (0-100) integrated with sensor fusion confidence.
        """
        base_weights = {
            "TUNNELING_SEISMIC": 95,
            "DRONE_INCURSION": 90,
            "WEAPON_DETECTED": 95,
            "VEHICLE_CONVOY": 85,
            "PERSON_INTRUSION": 80,
            "HEAT_ANOMALY": 70,
            "GROUND_VIBRATION": 60,
            "MOTION": 50
        }
        base = base_weights.get(event_type.upper(), 65)
        
        # Scale by confidence
        score = base * confidence
        
        # Conflict penalty: If sensors are in conflict, discount score by 20%
        if conflict_status == "CONFLICTING_SENSORS":
            score *= 0.80
        elif conflict_status == "DEGRADED_CONSENSUS":
            score *= 0.90

        return max(10, min(100, int(round(score))))

