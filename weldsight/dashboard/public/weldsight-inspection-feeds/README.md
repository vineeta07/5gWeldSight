# WeldSight inspection feeds (simulated)

Four 12-second camera feeds plus a 2x2 control-room wall, styled like the
border-surveillance dashboard. All footage is procedurally generated and
stamped "SIMULATED FEED | DEMO DATA".

| File | Camera | What happens |
|---|---|---|
| cam01_weld_bay_live_arc.mp4 | CAM-01 Weld Bay A | Live arc tracked; porosity and undercut detected as the bead cools; a gloved hand enters the arc zone and triggers a CRITICAL intrusion alert |
| cam02_seam_scanner.mp4 | CAM-02 Seam Scanner | Scanner passes a finished seam: spatter, transverse crack (weld rejected), porosity, lack of fusion; live quality graph |
| cam03_thermal_cooling.mp4 | CAM-03 Thermal | Thermal view with isotherms and spot temperatures; one section cools too fast and is flagged |
| cam04_pipeline_girth_weld.mp4 | CAM-04 Pipeline P-12 | Crawler rotates around a girth weld: burn-through (pressure test blocked) and external corrosion |
| ops_center_4up.mp4 | All four | 1920x1080 control-room wall |

`incidents.json` lists every event with the same fields your dashboard uses
(incident_code, camera_id, sector, tracking_id, confidence, threat_type,
risk_score, risk_level, ai_reasons, timeline) plus `video_file` and
`video_time_s`, so the dashboard can jump to the exact moment in each clip.

The *_poster.jpg files are thumbnails for <video poster="...">.

## Regenerate or customise
    pip install opencv-python numpy      # ffmpeg must be on PATH
    python generate_feeds.py

Camera names, defect types, positions, risk levels and timings are all near
the top of each cam0X() function in generate_feeds.py.
