# Inspection dashboard

The dashboard is the inspector's workspace. The main pages:

- **Overview**: counts of cameras online, open defect reports and critical findings, the main camera feed and the latest reports.
- **Live feeds**: all cameras in a grid or one at a time. Turn on "Defect detection" to send frames from the selected feed to the model every few seconds; findings are drawn on the video.
- **Facility map**: where the cameras are in the facility and which ones have open findings.
- **Video analysis**: upload a recorded weld video. The backend samples frames across the video, runs the defect model on each, and shows a timeline, the frames with the most defects and a written summary. You can then ask the assistant questions about that video.
- **Defect reports**: every finding, whether from a camera, a video upload or the website photo inspector. Each report has a status: New, Acknowledged, Investigating, Resolved or False positive. Inspectors can add notes.
- **Analytics**: charts of findings over time, by camera and by risk level.
- **Inspection records**: saved evidence for each report, with a SHA-256 fingerprint so anyone can check a record has not been changed. Anchoring records to a blockchain ledger is optional and needs the separate chain gateway service.
- **Weld zones**: areas of each camera view marked as acceptable, review or critical.
- **Reports**: export a summary as PDF or PowerPoint.
- **Settings**: account, display options and connection status.

# Defect report statuses

- **New**: just created, nobody has looked at it yet.
- **Acknowledged**: an inspector has seen it.
- **Investigating**: someone is checking the weld on site.
- **Resolved**: fixed or confirmed acceptable.
- **False positive**: the model was wrong; useful for improving it later.

# Project website

The project website explains WeldSight with videos, a 3D model of the prototype, the photo inspector and the assistant. It links to the dashboard. Both apps use the same backend, so inspections from the website appear in the dashboard's defect reports.

# The assistant

The assistant in the website and the dashboard is powered by Google Gemini. It answers from the WeldSight project notes and can look up live data: defect reports, camera status, the latest inspections and model settings. It says when it does not know something rather than guessing. It is a helper, not a certified inspector: decisions about accepting or rejecting welds must be made by a qualified person using the applicable standard.
