import logging
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.activity_baseline import ActivityBaseline

logger = logging.getLogger("ibvap.behaviour.baseline")

class ActivityBaselineEngine:
    """
    Statistical Activity Baseline Engine: Tracks normal time-of-day activity
    patterns (person count, vehicle count, dwell time, speed) and detects deviations.
    """

    def get_baseline(
        self,
        camera_id: str,
        hour_of_day: int,
        zone_id: Optional[str] = None
    ) -> ActivityBaseline:
        """
        Retrieves or initializes a statistical hourly baseline record.
        """
        db: Session = SessionLocal()
        try:
            baseline = db.query(ActivityBaseline).filter(
                ActivityBaseline.camera_id == camera_id,
                ActivityBaseline.zone_id == zone_id,
                ActivityBaseline.hour_of_day == hour_of_day
            ).first()

            if not baseline:
                # Initialize default baseline for camera hour
                is_night = hour_of_day >= 22 or hour_of_day <= 5
                expected_people = 1.0 if is_night else 6.0
                expected_vehicles = 0.5 if is_night else 3.0
                expected_dwell = 10.0 if is_night else 25.0

                baseline = ActivityBaseline(
                    camera_id=camera_id,
                    zone_id=zone_id,
                    hour_of_day=hour_of_day,
                    expected_person_count=expected_people,
                    expected_vehicle_count=expected_vehicles,
                    expected_dwell_sec=expected_dwell,
                    expected_speed_ms=1.2,
                    density_std_dev=2.0,
                    samples_count=10,
                    version=1
                )
                db.add(baseline)
                db.commit()
                db.refresh(baseline)

            return baseline
        finally:
            db.close()

    def evaluate_density_deviation(
        self,
        camera_id: str,
        current_count: int,
        hour_of_day: int,
        object_type: str = "person",
        zone_id: Optional[str] = None
    ) -> Tuple[bool, float, str]:
        """
        Evaluates whether current object count significantly exceeds historical baseline.
        Returns: (is_anomaly, deviation_z_score, explanation)
        """
        baseline = self.get_baseline(camera_id, hour_of_day, zone_id)
        expected = baseline.expected_person_count if object_type == "person" else baseline.expected_vehicle_count
        std_dev = max(1.0, baseline.density_std_dev)

        z_score = (current_count - expected) / std_dev

        # Flag anomaly if current count exceeds expected + 2.5 * std_dev
        if z_score >= 2.5 and current_count >= 10:
            msg = (
                f"Observed {current_count} {object_type}s at {hour_of_day}:00 "
                f"(Normal baseline: {expected:.1f} ± {std_dev:.1f})"
            )
            return True, round(z_score, 2), msg

        return False, round(z_score, 2), "Normal density baseline."

baseline_engine = ActivityBaselineEngine()
