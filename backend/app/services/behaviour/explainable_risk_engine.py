import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Any, Optional

logger = logging.getLogger("ibvap.behaviour.risk")

class ExplainableRiskEngine:
    """
    Multi-Signal Explainable Threat & Risk Assessment Engine.
    Combines kinetic indicators, zone context, cross-camera routes,
    temporal hours, and watchlists into an explainable score with counter-signals
    and graceful temporal risk decay.
    """

    @staticmethod
    def assess_risk(
        event_type: str,
        zone_type: str = "RESTRICTED",
        is_repeated_approach: bool = False,
        is_fence_edge: bool = False,
        is_route_anomaly: bool = False,
        is_rapid_direction: bool = False,
        is_stop_and_go: bool = False,
        is_sudden_speed: bool = False,
        is_density_anomaly: bool = False,
        is_vehicle_dwell: bool = False,
        is_night: bool = False,
        is_authorized_watchlist: bool = False,
        is_suspect_watchlist: bool = False,
        has_zone_breach: bool = False,
        detection_confidence: float = 0.90,
        elapsed_sec: float = 0.0
    ) -> Tuple[int, int, str, List[Dict[str, Any]], List[Dict[str, Any]], str]:
        """
        Computes composite explainable risk score, decayed score, factors, and counter-factors.
        Returns: (base_risk_score, decayed_risk_score, risk_level, factors, counter_factors, decay_explanation)
        """
        factors = []
        counter_factors = []
        raw_score = 0

        # --- 1. Positive Risk Contributing Factors ---

        # Zone Intrusion / Breach or Proximity
        if has_zone_breach or event_type == "ZONE_INTRUSION":
            if zone_type == "RESTRICTED":
                w = 30
                raw_score += w
                factors.append({"factor": "RESTRICTED_ZONE_BREACH", "weight": w, "description": "Subject entered designated zero-line restricted perimeter."})
            elif zone_type == "HIGH_SECURITY":
                w = 40
                raw_score += w
                factors.append({"factor": "HIGH_SECURITY_BREACH", "weight": w, "description": "Critical security barrier penetration detected."})
            else:
                w = 15
                raw_score += w
                factors.append({"factor": "BUFFER_ZONE_ENTRY", "weight": w, "description": "Subject detected in buffer surveillance sector."})
        elif zone_type == "RESTRICTED":
            w = 15
            raw_score += w
            factors.append({"factor": "RESTRICTED_PERIMETER_PROXIMITY", "weight": w, "description": "Activity occurring in immediate proximity to restricted perimeter."})

        # Repeated Approach Anomaly / Perimeter Probing
        if is_repeated_approach or event_type in ["REPEATED_APPROACH", "POTENTIAL_PERIMETER_PROBING_PATTERN"]:
            w = 25
            raw_score += w
            factors.append({"factor": "REPEATED_APPROACH", "weight": w, "description": "Subject repeatedly approached sensitive boundary before retreating."})

        # Fence-Edge Movement
        if is_fence_edge or event_type == "FENCE_EDGE_MOVEMENT":
            w = 20
            raw_score += w
            factors.append({"factor": "FENCE_EDGE_MOVEMENT", "weight": w, "description": "Prolonged parallel trajectory along perimeter wire."})

        # Route Anomaly / Deviation
        if is_route_anomaly or event_type in ["ROUTE_ANOMALY", "ROUTE_DEVIATION"]:
            w = 20
            raw_score += w
            factors.append({"factor": "ROUTE_ANOMALY", "weight": w, "description": "Cross-camera transition violates expected transit corridor."})

        # Kinetic Oscillations (Rapid Direction / Stop-and-Go)
        if is_rapid_direction or event_type == "RAPID_DIRECTION_CHANGE":
            w = 15
            raw_score += w
            factors.append({"factor": "RAPID_DIRECTION_CHANGE", "weight": w, "description": "Subject executed rapid directional oscillations."})

        if is_stop_and_go or event_type == "STOP_GO_ANOMALY":
            w = 15
            raw_score += w
            factors.append({"factor": "STOP_GO_ANOMALY", "weight": w, "description": "Intermittent stop-and-go pattern observed."})

        # Sudden Speed Change / Running
        if is_sudden_speed or event_type == "SUDDEN_SPEED_CHANGE":
            w = 18
            raw_score += w
            factors.append({"factor": "SUDDEN_SPEED_CHANGE", "weight": w, "description": "Sudden acceleration or sprint detected."})

        # Activity Density Outlier
        if is_density_anomaly or event_type == "ACTIVITY_DENSITY_ANOMALY":
            w = 18
            raw_score += w
            factors.append({"factor": "ACTIVITY_DENSITY_ANOMALY", "weight": w, "description": "Local crowd density significantly exceeds historical baseline."})

        # Vehicle Dwell
        if is_vehicle_dwell or event_type in ["VEHICLE_DWELL_ANOMALY", "REPEATED_VEHICLE_VISIT"]:
            w = 20
            raw_score += w
            factors.append({"factor": "VEHICLE_DWELL_ANOMALY", "weight": w, "description": "Vehicle remained stationary in restricted or sensitive area."})

        # Night Hours
        if is_night or event_type == "AFTER_HOURS_ACTIVITY":
            w = 15
            raw_score += w
            factors.append({"factor": "AFTER_HOURS_ACTIVITY", "weight": w, "description": "Activity occurred during restricted night hours (22:00–05:00)."})

        # Watchlist
        if is_suspect_watchlist or event_type in ["ANPR_WATCHLIST_MATCH", "FACE_POTENTIAL_MATCH"]:
            w = 30
            raw_score += w
            factors.append({"factor": "SECURITY_WATCHLIST_MATCH", "weight": w, "description": "Biometric or ANPR sighting matches active security watchlist."})

        # --- 2. Mitigating Counter-Signals ---

        mitigation = 0
        if is_authorized_watchlist:
            m = 30
            mitigation += m
            counter_factors.append({"signal": "AUTHORIZED_PERSONNEL_MATCH", "mitigation": m, "description": "Target identity matches authorized patrol or leadership roster."})

        if not has_zone_breach and not event_type == "ZONE_INTRUSION" and not is_repeated_approach:
            m = 10
            mitigation += m
            counter_factors.append({"signal": "NO_ZONE_BREACH", "mitigation": m, "description": "Subject maintained distance outside restricted perimeter boundaries."})

        if not is_night and event_type != "AFTER_HOURS_ACTIVITY":
            m = 5
            mitigation += m
            counter_factors.append({"signal": "NORMAL_DAYLIGHT_HOURS", "mitigation": m, "description": "Activity occurred during normal daytime operational hours."})

        # Apply score caps and mitigation
        net_score = max(0, min(100, raw_score - mitigation))
        if len(factors) == 0:
            net_score = 15

        # --- 3. Temporal Risk Decay Calculation ---
        # If behaviour normalizes, risk decays over 10 minutes (600s)
        decay_factor = max(0.35, 1.0 - (elapsed_sec / 600.0)) if elapsed_sec > 30.0 else 1.0
        decayed_score = int(round(net_score * decay_factor))
        decay_exp = f"Decayed from {net_score} based on {int(elapsed_sec)}s inactive elapsed time." if elapsed_sec > 30.0 else "Active threat peak."

        # Risk Level Classification
        if decayed_score >= 81:
            level = "CRITICAL"
        elif decayed_score >= 61:
            level = "HIGH"
        elif decayed_score >= 41:
            level = "ELEVATED"
        elif decayed_score >= 21:
            level = "GUARDED"
        else:
            level = "LOW"

        return net_score, decayed_score, level, factors, counter_factors, decay_exp

explainable_risk_engine = ExplainableRiskEngine()
