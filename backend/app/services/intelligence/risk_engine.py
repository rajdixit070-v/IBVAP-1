from typing import List, Dict, Tuple, Any
from app.models.risk_config import SystemRiskConfig

class ThreatRiskEngine:
    """
    Centralized Explainable Risk Scoring Engine for Border Surveillance Events.
    Calculates normalized scores (0 to 100) and compiles transparent breakdown factors.
    """
    def __init__(self, config: SystemRiskConfig = None):
        self.config = config or SystemRiskConfig()

    def update_config(self, config: SystemRiskConfig):
        self.config = config

    def _get_val(self, attr_name: str, fallback: int) -> int:
        val = getattr(self.config, attr_name, fallback)
        return val if val is not None else fallback

    def calculate_risk(
        self,
        event_type: str,
        zone_type: str = "RESTRICTED",
        is_night: bool = False,
        is_forbidden_direction: bool = False,
        is_loitering: bool = False,
        is_stationary_vehicle: bool = False,
        is_group: bool = False,
        is_rapid_movement: bool = False,
        is_anpr_watchlist: bool = False,
        is_face_watchlist: bool = False,
        is_monitor_target: bool = False,
        detection_confidence: float = 0.90,
        confidence: float = None,
        in_blind_spot: bool = False,
        terrain_factor: str = None
    ) -> Tuple[int, str, List[Dict[str, Any]]]:
        """
        Computes composite risk score with terrain, blind spot, and multi-sensor intelligence.
        Returns: (risk_score, risk_level, [factors])
        """
        det_conf = confidence if confidence is not None else detection_confidence
        score = 0
        factors = []

        w_restricted = self._get_val("weight_restricted_zone", 25)
        w_fence = self._get_val("weight_fence_crossing", 25)
        w_forbid = self._get_val("weight_forbidden_direction", 15)
        w_night = self._get_val("weight_night_movement", 15)
        w_loiter = self._get_val("weight_loitering", 10)
        w_stationary = self._get_val("weight_stationary_vehicle", 15)
        w_group = self._get_val("weight_group_movement", 10)
        w_rapid = self._get_val("weight_rapid_movement", 10)
        w_anpr_wl = 30
        w_face_wl = 35
        w_monitor = 15
        p_low_conf = self._get_val("penalty_low_confidence", -10)

        # 1. Target Detection & Intrusion Factors
        if event_type in ["PERSON_DETECTED", "PERIMETER_HUMAN_DETECTED", "UNAUTHORIZED_INTRUSION", "HUMAN_DETECTED"]:
            score += 75
            factors.append({"factor": "HUMAN_TARGET_DETECTED", "weight": 75, "description": "Human subject detected on perimeter camera sensor."})
        elif event_type in ["DRONE_DETECTED", "AERIAL_THREAT"]:
            score += 85
            factors.append({"factor": "AERIAL_DRONE_DETECTED", "weight": 85, "description": "Unmanned aerial vehicle/drone detected in airspace."})
        elif event_type in ["VEHICLE_DETECTED", "VEHICLE_APPROACH"]:
            score += 65
            factors.append({"factor": "VEHICLE_DETECTED", "weight": 65, "description": "Motorized vehicle detected in camera sector."})
        elif event_type in ["ANIMAL_INTRUSION"]:
            score += 50
            factors.append({"factor": "ANIMAL_INTRUSION", "weight": 50, "description": "Wildlife / animal presence detected near perimeter."})
        elif event_type in ["ZONE_INTRUSION"]:
            if zone_type == "RESTRICTED":
                score += w_restricted
                factors.append({"factor": "RESTRICTED_ZONE_INTRUSION", "weight": w_restricted, "description": "Subject penetrated a designated restricted perimeter zone."})
            elif zone_type == "HIGH_SECURITY":
                w = w_restricted + 10
                score += w
                factors.append({"factor": "HIGH_SECURITY_BREACH", "weight": w, "description": "Subject penetrated a high-security critical asset perimeter."})
            elif zone_type == "BUFFER":
                w = max(10, w_restricted - 5)
                score += w
                factors.append({"factor": "BUFFER_ZONE_ENTRY", "weight": w, "description": "Subject entered buffer observation perimeter."})
            else:
                score += 25
                factors.append({"factor": "MONITORED_ZONE_ENTRY", "weight": 25, "description": "Subject detected entering a monitored surveillance sector."})

        # 2. ANPR Watchlist Factor
        if event_type == "ANPR_WATCHLIST_MATCH" or is_anpr_watchlist:
            score += w_anpr_wl
            factors.append({"factor": "ANPR_WATCHLIST_MATCH", "weight": w_anpr_wl, "description": "Recognized vehicle license plate matches active security watchlist record."})

        # 3. Facial Watchlist Factor
        if event_type == "FACE_POTENTIAL_MATCH" or is_face_watchlist:
            score += w_face_wl
            factors.append({"factor": "FACE_WATCHLIST_POTENTIAL_MATCH", "weight": w_face_wl, "description": "Facial biometric features indicate potential match against security watchlist."})

        # 4. Monitor Target Factor
        if event_type == "MONITOR_VEHICLE_DETECTED" or is_monitor_target:
            score += w_monitor
            factors.append({"factor": "MONITOR_TARGET_DETECTED", "weight": w_monitor, "description": "Target tagged for active situational surveillance observation."})

        # 5. Night Movement Factor
        if is_night:
            score += w_night
            factors.append({"factor": "NIGHT_MOVEMENT", "weight": w_night, "description": "Activity detected during active night hours."})

        # 6. Forbidden Direction Factor
        if is_forbidden_direction:
            score += w_forbid
            factors.append({"factor": "FORBIDDEN_DIRECTION", "weight": w_forbid, "description": "Movement trajectory aligns with configured forbidden breach direction."})

        # 7. Loitering Factor
        if is_loitering:
            score += w_loiter
            factors.append({"factor": "LOITERING_BEHAVIOUR", "weight": w_loiter, "description": "Target prolonged presence in zone exceeding nominal dwell threshold."})

        # 8. Stationary Vehicle Factor
        if is_stationary_vehicle:
            score += w_stationary
            factors.append({"factor": "STATIONARY_VEHICLE", "weight": w_stationary, "description": "Vehicle remained stationary in restricted sector for sustained duration."})

        # 9. Group Movement Factor
        if is_group:
            score += w_group
            factors.append({"factor": "GROUP_MOVEMENT", "weight": w_group, "description": "Multiple correlated targets moving in spatial proximity."})

        # 10. Rapid Movement Factor
        if is_rapid_movement:
            score += w_rapid
            factors.append({"factor": "RAPID_MOVEMENT", "weight": w_rapid, "description": "Sudden abnormal velocity observed within perimeter."})

        # 11. Tactical Blind Spot Proximity Factor
        if in_blind_spot:
            score += 15
            factors.append({"factor": "BLIND_SPOT_PROXIMITY", "weight": 15, "description": "Target detected inside or immediately adjacent to high-risk perimeter blind spot."})

        # 12. Vulnerable Terrain Corridor Factor
        if terrain_factor in ("RIVER_RAVINE", "STEEP_SLOPE", "DENSE_VEGETATION"):
            t_weight = 12 if terrain_factor == "RIVER_RAVINE" else 8
            score += t_weight
            factors.append({"factor": "VULNERABLE_TERRAIN_CORRIDOR", "weight": t_weight, "description": f"Target detected utilizing {terrain_factor} topographical concealment corridor."})

        # 13. Low Confidence Adjustment
        if det_conf < 0.50:
            score += p_low_conf
            factors.append({"factor": "LOW_DETECTION_CONFIDENCE", "weight": p_low_conf, "description": "Confidence penalty applied due to marginal AI detection quality."})

        # Base minimum for any confirmed security event
        if score < 15 and event_type != "ZONE_EXIT":
            score = 15

        # Normalize score to 0 - 100
        final_score = max(0, min(100, score))

        # Classify Risk Level
        if final_score >= 81:
            level = "CRITICAL"
        elif final_score >= 61:
            level = "HIGH"
        elif final_score >= 31:
            level = "MEDIUM"
        else:
            level = "LOW"

        return final_score, level, factors

# Global instance
risk_engine = ThreatRiskEngine()
