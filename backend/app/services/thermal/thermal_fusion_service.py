import json
import logging
import uuid
import math
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.thermal_fusion_models import CameraPair, ThermalFusionResult
from app.models.camera import Camera
from app.services.stream_manager import stream_manager
from app.schemas.thermal_schemas import CameraPairCreate, CameraPairUpdate, ThermalFusionExecutionRequest

logger = logging.getLogger("ibvap.services.thermal")

class ThermalRGBFusionService:
    """
    Module 2: Thermal + RGB Camera Pairing, Homography Alignment, and Synchronized Fusion Service.
    """

    @staticmethod
    def get_all_pairs(db: Session, site_id: Optional[str] = None, status: Optional[str] = None) -> List[CameraPair]:
        query = db.query(CameraPair)
        if site_id:
            query = query.filter(CameraPair.site_id == site_id)
        if status:
            query = query.filter(CameraPair.status == status.upper())
        return query.order_by(CameraPair.created_at.desc()).all()

    @staticmethod
    def get_pair_by_id(db: Session, pair_id: str) -> Optional[CameraPair]:
        return db.query(CameraPair).filter(CameraPair.pair_id == pair_id).first()

    @staticmethod
    def create_pair(db: Session, data: CameraPairCreate) -> CameraPair:
        existing = db.query(CameraPair).filter(CameraPair.pair_id == data.pair_id).first()
        if existing:
            raise ValueError(f"Camera pair '{data.pair_id}' already exists.")

        # Ensure both Optical and Thermal cameras exist in the database and are streaming
        camera_specs = [
            (data.rgb_camera_id, "main", f"Optical Sensor {data.rgb_camera_id}"),
            (data.thermal_camera_id, "thermal", f"Thermal LWIR Sensor {data.thermal_camera_id}")
        ]
        for cam_id, stype, def_name in camera_specs:
            cam = db.query(Camera).filter(Camera.camera_id == cam_id).first()
            if not cam:
                cam = Camera(
                    camera_id=cam_id,
                    camera_name=def_name,
                    description=f"Auto-registered sensor for thermal fusion pair {data.pair_id}",
                    bop_site=data.bop_id or "BOP Alpha",
                    sector="North Sector",
                    location="Perimeter Tower",
                    stream_type=stype,
                    rtsp_url=f"synthetic://{cam_id.lower()}/main",
                    resolution="1920x1080",
                    fps=25.0,
                    codec="H.264",
                    enabled=True,
                    status="HEALTHY"
                )
                db.add(cam)
                db.commit()
                db.refresh(cam)
                logger.info(f"Auto-registered missing camera '{cam_id}' for pair '{data.pair_id}'")

            # Start video stream in stream_manager if not already running
            try:
                stream_manager.start_camera(
                    camera_id=cam.camera_id,
                    camera_name=cam.camera_name,
                    bop_site=cam.bop_site,
                    rtsp_url=cam.rtsp_url
                )
            except Exception as se:
                logger.debug(f"Stream startup notice for {cam.camera_id}: {se}")

        pair = CameraPair(
            pair_id=data.pair_id,
            rgb_camera_id=data.rgb_camera_id,
            thermal_camera_id=data.thermal_camera_id,
            site_id=data.site_id,
            bop_id=data.bop_id,
            calibration_transform_json=data.calibration_transform_json or '{"homography": [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]], "scale_x": 1.0, "scale_y": 1.0, "offset_x": 0, "offset_y": 0, "rotation_deg": 0.0}',
            overlap_area_json=data.overlap_area_json or '[{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}, {"x": 1.0, "y": 1.0}, {"x": 0.0, "y": 1.0}]',
            overlap_ratio=data.overlap_ratio if data.overlap_ratio is not None else 0.85,
            sync_tolerance_ms=data.sync_tolerance_ms if data.sync_tolerance_ms is not None else 100.0,
            fusion_mode=data.fusion_mode.upper() if data.fusion_mode else "FUSED",
            status=data.status.upper() if data.status else "ACTIVE"
        )
        db.add(pair)
        db.commit()
        db.refresh(pair)
        logger.info(f"Created CameraPair: {pair.pair_id} (RGB={pair.rgb_camera_id}, Thermal={pair.thermal_camera_id})")
        return pair

    @staticmethod
    def update_pair(db: Session, pair_id: str, data: CameraPairUpdate) -> Optional[CameraPair]:
        pair = db.query(CameraPair).filter(CameraPair.pair_id == pair_id).first()
        if not pair:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        for k, v in update_dict.items():
            if k in ("fusion_mode", "status") and v:
                setattr(pair, k, v.upper())
            else:
                setattr(pair, k, v)

        pair.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(pair)
        return pair

    @staticmethod
    def delete_pair(db: Session, pair_id: str) -> bool:
        pair = db.query(CameraPair).filter(CameraPair.pair_id == pair_id).first()
        if not pair:
            return False
        db.delete(pair)
        db.commit()
        logger.info(f"Deleted CameraPair: {pair_id}")
        return True

    @staticmethod
    def clear_fusion_results(db: Session, pair_id: Optional[str] = None) -> int:
        query = db.query(ThermalFusionResult)
        if pair_id:
            query = query.filter(ThermalFusionResult.pair_id == pair_id)
        count = query.delete()
        db.commit()
        logger.info(f"Cleared {count} ThermalFusionResult records")
        return count

    @staticmethod
    def delete_single_result(db: Session, result_id: str) -> bool:
        res = db.query(ThermalFusionResult).filter(ThermalFusionResult.result_id == result_id).first()
        if not res:
            return False
        db.delete(res)
        db.commit()
        logger.info(f"Deleted ThermalFusionResult: {result_id}")
        return True

    @classmethod
    def execute_fusion(
        cls,
        db: Session,
        request: ThermalFusionExecutionRequest
    ) -> ThermalFusionResult:
        """
        Performs spatial alignment and dynamic low-light weighted fusion on RGB and Thermal detections.
        """
        pair = None
        if request.pair_id:
            pair = db.query(CameraPair).filter(CameraPair.pair_id == request.pair_id).first()
        if not pair:
            pair = db.query(CameraPair).first()
        if not pair:
            # Auto-provision an operational pair on-the-fly so Trigger Heat Scan always works
            target_pair_id = request.pair_id or "PAIR-NORTH-01"
            cams = db.query(Camera).all()
            rgb_id = cams[0].camera_id if len(cams) > 0 else "CAM-001"
            th_id = cams[1].camera_id if len(cams) > 1 else ("CAM-002" if len(cams) == 0 else cams[0].camera_id)

            for cid, name, stype in [(rgb_id, f"Optical Camera {rgb_id}", "main"), (th_id, f"Thermal LWIR {th_id}", "thermal")]:
                if not db.query(Camera).filter(Camera.camera_id == cid).first():
                    db.add(Camera(
                        camera_id=cid,
                        camera_name=name,
                        site_id="SITE-BORDER-NORTH",
                        bop_site="BOP Alpha",
                        sector="North Sector",
                        rtsp_url=f"synthetic://{cid.lower()}/main",
                        stream_type=stype,
                        status="HEALTHY",
                        enabled=True
                    ))
                    db.commit()

            pair = CameraPair(
                pair_id=target_pair_id,
                rgb_camera_id=rgb_id,
                thermal_camera_id=th_id,
                site_id="SITE-BORDER-NORTH",
                bop_id="BOP-ALPHA",
                calibration_transform_json='{"homography": [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]], "scale_x": 1.0, "scale_y": 1.0, "offset_x": 0, "offset_y": 0, "rotation_deg": 0.0}',
                overlap_area_json='[{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}, {"x": 1.0, "y": 1.0}, {"x": 0.0, "y": 1.0}]',
                overlap_ratio=0.85,
                sync_tolerance_ms=100.0,
                fusion_mode="FUSED",
                status="ACTIVE"
            )
            db.add(pair)
            db.commit()
            db.refresh(pair)
            logger.info(f"Auto-provisioned CameraPair '{pair.pair_id}' for live fusion execution.")

        mode = pair.fusion_mode or "FUSED"
        lighting = (request.lighting_condition or "DAY").upper()
        
        rgb_detections = request.rgb_detections or []
        thermal_detections = request.thermal_detections or []

        # Parse homography calibration parameters
        calib = {}
        try:
            calib = json.loads(pair.calibration_transform_json or "{}")
        except Exception:
            calib = {}

        # 1. Transform thermal bounding boxes into RGB coordinate space
        aligned_thermal = []
        for th in thermal_detections:
            transformed_th = cls._align_thermal_detection_to_rgb(th, calib)
            aligned_thermal.append(transformed_th)

        # 2. Determine environmental weighting
        # In night / low-light conditions, thermal channel carries higher authority
        if lighting in ("NIGHT", "LOW_LIGHT", "FOG"):
            w_rgb = 0.20
            w_thermal = 0.80
        else:
            w_rgb = 0.65
            w_thermal = 0.35

        # 3. Fuse overlapping detections and identify heat anomalies
        fused_detections, has_heat_anomaly, has_obstruction = cls._correlate_and_fuse_detections(
            rgb_detections, aligned_thermal, mode, w_rgb, w_thermal
        )

        # Calculate channel-specific and fused confidences
        rgb_conf = max([d.get("confidence", 0.0) for d in rgb_detections], default=0.0)
        thermal_conf = max([d.get("confidence", 0.0) for d in thermal_detections], default=0.0)
        
        if mode == "RGB_ONLY":
            fused_conf = rgb_conf
        elif mode == "THERMAL_ONLY":
            fused_conf = thermal_conf
        else:
            if rgb_conf > 0 and thermal_conf > 0:
                fused_conf = (w_rgb * rgb_conf) + (w_thermal * thermal_conf)
            else:
                fused_conf = max(rgb_conf, thermal_conf) * 0.85

        result_id = f"TFR-{uuid.uuid4().hex[:12].upper()}"
        result = ThermalFusionResult(
            result_id=result_id,
            pair_id=pair.pair_id,
            rgb_camera_id=pair.rgb_camera_id,
            thermal_camera_id=pair.thermal_camera_id,
            rgb_confidence=round(rgb_conf, 4),
            thermal_confidence=round(thermal_conf, 4),
            fused_confidence=round(fused_conf, 4),
            fusion_mode_applied=mode,
            lighting_condition=lighting,
            detections_json=json.dumps(fused_detections),
            has_heat_anomaly=has_heat_anomaly,
            has_thermal_obstruction=has_obstruction,
            timestamp=datetime.utcnow()
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return result

    @classmethod
    def _align_thermal_detection_to_rgb(cls, th_det: Dict[str, Any], calib: Dict[str, Any]) -> Dict[str, Any]:
        """
        Applies homography translation, scaling, and offset to map normalized thermal bbox to RGB.
        """
        bbox = th_det.get("bbox", [0.0, 0.0, 0.1, 0.1])
        if len(bbox) != 4:
            return th_det

        x, y, w, h = bbox
        scale_x = calib.get("scale_x", 1.0)
        scale_y = calib.get("scale_y", 1.0)
        offset_x = calib.get("offset_x", 0.0)
        offset_y = calib.get("offset_y", 0.0)

        # Apply transformation
        x_prime = max(0.0, min(1.0, (x * scale_x) + offset_x))
        y_prime = max(0.0, min(1.0, (y * scale_y) + offset_y))
        w_prime = max(0.01, min(1.0 - x_prime, w * scale_x))
        h_prime = max(0.01, min(1.0 - y_prime, h * scale_y))

        aligned = dict(th_det)
        aligned["bbox"] = [round(x_prime, 4), round(y_prime, 4), round(w_prime, 4), round(h_prime, 4)]
        aligned["original_thermal_bbox"] = bbox
        return aligned

    @classmethod
    def _correlate_and_fuse_detections(
        cls,
        rgb_dets: List[Dict[str, Any]],
        th_dets: List[Dict[str, Any]],
        mode: str,
        w_rgb: float,
        w_th: float
    ) -> Tuple[List[Dict[str, Any]], bool, bool]:
        fused = []
        has_heat_anomaly = False
        has_obstruction = False

        if mode == "RGB_ONLY":
            for r in rgb_dets:
                fused.append({
                    "class": r.get("class", "object"),
                    "confidence": r.get("confidence", 0.7),
                    "rgb_confidence": r.get("confidence", 0.7),
                    "thermal_confidence": 0.0,
                    "bbox": r.get("bbox", [0.1, 0.1, 0.2, 0.2]),
                    "source": "RGB_ONLY"
                })
            return fused, False, False

        if mode == "THERMAL_ONLY":
            for t in th_dets:
                temp_c = t.get("temp_c", 36.5)
                is_anomaly = temp_c > 39.0 or temp_c < 20.0
                if is_anomaly:
                    has_heat_anomaly = True
                fused.append({
                    "class": t.get("class", "object"),
                    "confidence": t.get("confidence", 0.7),
                    "rgb_confidence": 0.0,
                    "thermal_confidence": t.get("confidence", 0.7),
                    "bbox": t.get("bbox", [0.1, 0.1, 0.2, 0.2]),
                    "temp_c": temp_c,
                    "is_heat_anomaly": is_anomaly,
                    "source": "THERMAL_ONLY"
                })
            return fused, has_heat_anomaly, False

        # Mode == "FUSED": Spatial intersection of bounding boxes
        matched_thermal_indices = set()

        for r in rgb_dets:
            r_bbox = r.get("bbox", [0, 0, 0, 0])
            best_iou = 0.0
            best_th_idx = -1

            for idx, t in enumerate(th_dets):
                if idx in matched_thermal_indices:
                    continue
                t_bbox = t.get("bbox", [0, 0, 0, 0])
                iou = cls._calculate_iou(r_bbox, t_bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_th_idx = idx

            if best_iou >= 0.20 and best_th_idx >= 0:
                matched_thermal_indices.add(best_th_idx)
                matched_t = th_dets[best_th_idx]
                
                r_conf = r.get("confidence", 0.7)
                t_conf = matched_t.get("confidence", 0.7)
                combined_conf = (w_rgb * r_conf) + (w_th * t_conf)
                temp_c = matched_t.get("temp_c", 36.8)
                is_anomaly = temp_c > 39.0 or temp_c < 20.0
                if is_anomaly:
                    has_heat_anomaly = True

                # Blended bounding box
                fused_bbox = [
                    round((r_bbox[0] + matched_t["bbox"][0]) / 2.0, 4),
                    round((r_bbox[1] + matched_t["bbox"][1]) / 2.0, 4),
                    round((r_bbox[2] + matched_t["bbox"][2]) / 2.0, 4),
                    round((r_bbox[3] + matched_t["bbox"][3]) / 2.0, 4),
                ]

                fused.append({
                    "class": r.get("class", matched_t.get("class", "object")),
                    "confidence": round(combined_conf, 4),
                    "rgb_confidence": round(r_conf, 4),
                    "thermal_confidence": round(t_conf, 4),
                    "bbox": fused_bbox,
                    "temp_c": temp_c,
                    "is_heat_anomaly": is_anomaly,
                    "source": "FUSED"
                })
            else:
                # RGB-only detection without thermal counterpart
                fused.append({
                    "class": r.get("class", "object"),
                    "confidence": round(r.get("confidence", 0.7) * 0.85, 4),
                    "rgb_confidence": round(r.get("confidence", 0.7), 4),
                    "thermal_confidence": 0.0,
                    "bbox": r_bbox,
                    "source": "RGB_UNMATCHED"
                })

        # Add remaining unmatched thermal detections (e.g. hidden targets in darkness)
        for idx, t in enumerate(th_dets):
            if idx not in matched_thermal_indices:
                temp_c = t.get("temp_c", 36.5)
                is_anomaly = temp_c > 39.0 or temp_c < 20.0
                if is_anomaly:
                    has_heat_anomaly = True
                fused.append({
                    "class": t.get("class", "thermal_target"),
                    "confidence": round(t.get("confidence", 0.7) * 0.90, 4),
                    "rgb_confidence": 0.0,
                    "thermal_confidence": round(t.get("confidence", 0.7), 4),
                    "bbox": t.get("bbox", [0.1, 0.1, 0.2, 0.2]),
                    "temp_c": temp_c,
                    "is_heat_anomaly": is_anomaly,
                    "source": "THERMAL_UNMATCHED_CONCEALED"
                })

        return fused, has_heat_anomaly, has_obstruction

    @staticmethod
    def _calculate_iou(boxA: List[float], boxB: List[float]) -> float:
        if len(boxA) < 4 or len(boxB) < 4:
            return 0.0
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
        yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])

        interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
        boxAArea = boxA[2] * boxA[3]
        boxBArea = boxB[2] * boxB[3]
        unionArea = boxAArea + boxBArea - interArea
        if unionArea <= 0:
            return 0.0
        return interArea / unionArea

