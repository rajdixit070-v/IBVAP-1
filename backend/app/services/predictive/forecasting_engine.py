import math
import logging
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timedelta

from app.services.predictive.infrastructure_correlator import infrastructure_correlator

logger = logging.getLogger("ibvap.predictive.forecasting")

class ForecastingEngine:
    """
    Modular Time-Series Anomaly Forecasting Engine.
    Implements statistical moving averages, exponential smoothing,
    uncertainty band estimation, data quality weighting, and explainable driver attribution.
    """

    def __init__(self, model_version: str = "1.0.0", min_samples_threshold: int = 4):
        self.model_version = model_version
        self.min_samples_threshold = min_samples_threshold

    def build_features(self, history_values: List[float]) -> Dict[str, float]:
        """Extracts statistical features from historical time-series values."""
        if not history_values:
            return {"mean": 0.0, "last": 0.0, "trend_slope": 0.0, "variance": 0.0}

        n = len(history_values)
        mean = sum(history_values) / n
        last = history_values[-1]
        var = sum((v - mean)**2 for v in history_values) / max(1, n - 1)
        
        # Simple slope
        slope = (history_values[-1] - history_values[0]) / max(1, n - 1) if n > 1 else 0.0

        return {
            "mean": round(mean, 2),
            "last": round(last, 2),
            "trend_slope": round(slope, 2),
            "variance": round(var, 2),
            "sample_count": n
        }

    def predict(
        self,
        target_type: str,
        target_id: str,
        history_values: List[float],
        baseline_expected: float = 12.0,
        forecast_horizon_minutes: int = 60,
        current_risk_score: int = 40,
        has_route_anomalies: bool = False,
        has_behaviour_probing: bool = False,
        has_watchlist_activity: bool = False,
        is_night: bool = False
    ) -> Dict[str, Any]:
        """
        Generates short-term activity forecast with uncertainty bands and explainability.
        """
        # Step 1: Evaluate Data Quality via Infrastructure Correlator
        if target_type == "camera":
            dq_score, is_down, outage_reason = infrastructure_correlator.evaluate_camera_data_quality(target_id)
        elif target_type == "site":
            dq_score = infrastructure_correlator.evaluate_site_data_quality(target_id)
            is_down = False
            outage_reason = "HEALTHY"
        else:
            dq_score = 0.90
            is_down = False
            outage_reason = "HEALTHY"

        if is_down:
            return {
                "status": "INFRASTRUCTURE_DEGRADED",
                "forecast_level": "UNKNOWN",
                "expected_activity_count": 0.0,
                "expected_range_min": 0.0,
                "expected_range_max": 0.0,
                "forecast_risk_score": 20,
                "current_risk_score": current_risk_score,
                "confidence": round(dq_score, 2),
                "data_quality_score": round(dq_score, 2),
                "reasons": [{"driver": "INFRASTRUCTURE_OFFLINE", "description": f"Target hardware reported: {outage_reason}."}],
                "counter_signals": [],
                "model_version": self.model_version
            }

        # Step 2: Enforce Minimum Historical Sample Threshold
        if len(history_values) < self.min_samples_threshold:
            return {
                "status": "INSUFFICIENT_DATA",
                "forecast_level": "NORMAL",
                "expected_activity_count": round(baseline_expected, 1),
                "expected_range_min": round(max(0.0, baseline_expected * 0.7), 1),
                "expected_range_max": round(baseline_expected * 1.3, 1),
                "forecast_risk_score": current_risk_score,
                "current_risk_score": current_risk_score,
                "confidence": 0.45,
                "data_quality_score": round(dq_score, 2),
                "reasons": [{"driver": "HISTORICAL_SAMPLE_SPARSE", "description": "Insufficient historical points for high-confidence forecast."}],
                "counter_signals": [],
                "model_version": self.model_version
            }

        # Step 3: Compute Exponential Smoothing Forecast
        # alpha = 0.6 (weight on recent trends)
        alpha = 0.6
        smoothed = history_values[0]
        for val in history_values[1:]:
            smoothed = alpha * val + (1.0 - alpha) * smoothed

        features = self.build_features(history_values)
        projected_activity = max(0.0, smoothed + (features["trend_slope"] * (forecast_horizon_minutes / 15.0)))
        
        # Uncertainty band based on historical variance
        if features["variance"] == 0.0 and projected_activity == 0.0:
            range_min = 0.0
            range_max = 0.0
        else:
            std_err = math.sqrt(max(1.0, features["variance"]))
            range_min = max(0.0, round(projected_activity - 1.64 * std_err, 1))
            range_max = round(projected_activity + 1.64 * std_err, 1)

        # Step 4: Multi-Signal Risk Projection & Driver Attribution
        reasons = []
        counter_signals = []
        forecast_risk = current_risk_score

        # Activity deviation above baseline
        dev_ratio = projected_activity / max(1.0, baseline_expected) if baseline_expected > 0 else (1.0 if projected_activity == 0 else 2.0)
        if dev_ratio >= 2.0 and projected_activity > 0:
            forecast_risk += 22
            reasons.append({
                "driver": "SUSTAINED_ACTIVITY_SPIKE",
                "description": f"Forecast activity ({projected_activity:.1f}) is {dev_ratio:.1f}x higher than typical baseline."
            })
        elif dev_ratio >= 1.4 and projected_activity > 0:
            forecast_risk += 12
            reasons.append({
                "driver": "ELEVATED_ACTIVITY_TREND",
                "description": f"Activity trending {dev_ratio:.1f}x above normal baseline."
            })

        if has_route_anomalies:
            forecast_risk += 15
            reasons.append({
                "driver": "CROSS_CAMERA_ROUTE_ANOMALIES",
                "description": "Correlated cross-camera transition violations detected in adjacent sectors."
            })

        if has_behaviour_probing:
            forecast_risk += 18
            reasons.append({
                "driver": "PERIMETER_PROBING_INDICATORS",
                "description": "Kinematic oscillations and repeated approach patterns active."
            })

        if has_watchlist_activity:
            forecast_risk += 20
            reasons.append({
                "driver": "SECURITY_WATCHLIST_MATCH",
                "description": "Recent sightings match flagged surveillance watchlist."
            })

        if is_night and projected_activity > 0:
            forecast_risk += 10
            reasons.append({
                "driver": "AFTER_HOURS_WINDOW",
                "description": "Forecast covers 22:00–05:00 restricted surveillance window."
            })

        # Counter-signals
        if dq_score >= 0.90:
            counter_signals.append({
                "signal": "TELEMETRY_HEALTHY",
                "description": "High edge telemetry data quality and active camera streams."
            })
        if dev_ratio < 1.3 and not has_behaviour_probing:
            forecast_risk = max(0, forecast_risk - 15)
            if projected_activity > 0:
                counter_signals.append({
                    "signal": "STABLE_PERIMETER_DYNAMICS",
                    "description": "No perimeter boundary breaches or rapid direction reversals observed."
                })
            else:
                counter_signals.append({
                    "signal": "CLEAR_SECTOR",
                    "description": "Perimeter sector is quiescent with zero anomalies detected."
                })

        forecast_risk = max(0, min(100, forecast_risk))

        # Classify Forecast Level
        if forecast_risk >= 75:
            forecast_level = "HIGH"
        elif forecast_risk >= 50:
            forecast_level = "ELEVATED"
        elif forecast_risk >= 25:
            forecast_level = "NORMAL"
        else:
            forecast_level = "LOW"

        # Calculate Confidence based on Data Quality and Sample Density
        confidence = round(min(0.95, dq_score * (0.60 + 0.35 * min(1.0, len(history_values) / 10.0))), 2)

        return {
            "status": "COMPLETED",
            "forecast_level": forecast_level,
            "expected_activity_count": round(projected_activity, 1),
            "expected_range_min": range_min,
            "expected_range_max": range_max,
            "forecast_risk_score": forecast_risk,
            "current_risk_score": current_risk_score,
            "confidence": confidence,
            "data_quality_score": round(dq_score, 2),
            "reasons": reasons,
            "counter_signals": counter_signals,
            "model_version": self.model_version
        }

forecasting_engine = ForecastingEngine()
