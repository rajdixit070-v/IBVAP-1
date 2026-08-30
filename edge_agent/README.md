# IBVAP Tactical Edge Agent (Border Outpost Appliance)

The **IBVAP Tactical Edge Agent** is a lightweight, offline-resilient edge computing service designed to run directly at remote Border Outposts (BOPs), Forward Operating Bases (FOBs), or tactical surveillance towers.

---

## Key Tactical Capabilities

1. **Local RTSP Ingestion & Security**:
   - Cameras connect directly to the Edge Agent over the local air-gapped / outpost LAN (`192.168.x.x` or `10.x.x.x`).
   - **Zero Public Internet Exposure**: Remote cameras are NEVER exposed to the public Internet or port-forwarded.
2. **Local Edge AI Inference**:
   - Runs local YOLOv8 & ByteTrack object detection for Person (Intruders/Terrorists), Vehicles, and Animals.
   - Detects boundary breaches, loitering, and abnormal movement in real-time on local hardware (NVIDIA Jetson, Intel NUC, or tactical laptops).
3. **Cryptographic Forensic Evidence Capture**:
   - Stamps captured frames with forensic tactical HUD headers, color-coded bounding boxes, and SHA-256 digital hashes.
4. **Durable Offline Store-and-Forward Buffer**:
   - If the satellite, 4G, or fiber connection to Central IBVAP drops, the Edge Agent continues full surveillance and queues events in local SQLite storage.
   - Upon reconnection, events and evidence snapshots are automatically synced to Central IBVAP in prioritized order (`CRITICAL` -> `HIGH` -> `MEDIUM` -> `LOW`).
5. **Encrypted VPN / mTLS Tunnel**:
   - Communicates with Central IBVAP through WireGuard / OpenVPN or mTLS with 256-bit cryptographic tokens.

---

## Quick Setup & Deployment

### 1. Installation
```bash
cd edge_agent
pip install -r requirements.txt
```

### 2. Configuration (`edge_config.json`)
Run the interactive setup wizard:
```bash
python agent.py --setup
```

Or configure `edge_config.json` manually:
```json
{
  "node_id": "EDGE-BOP-KARGIL-01",
  "node_name": "Kargil Outpost 4",
  "bop_site": "Sector North",
  "central_url": "http://10.8.0.1:8000",
  "api_key": "edg_live_YOUR_256_BIT_TOKEN_HERE",
  "heartbeat_interval_sec": 10,
  "sync_interval_sec": 5,
  "cameras": [
    {
      "camera_id": "CAM-BOP-NORTH-01",
      "rtsp_url": "rtsp://192.168.1.50:554/live",
      "name": "Perimeter Fence Camera"
    }
  ]
}
```

### 3. Run Self-Verification Test
```bash
python agent.py --test-mode
```

### 4. Start Edge Daemon in Production
```bash
python agent.py --config edge_config.json
```
