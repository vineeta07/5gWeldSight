# Vision model

WeldSight's detection model is a segmentation model that finds defects and anomalies on metal surfaces. The file is `rust_seg_unity.onnx`. It follows the RF-DETR segmentation design: for each image it proposes up to 100 regions, each with a box, a confidence score and a pixel mask, and keeps the ones above the confidence threshold.

- Input: a colour image resized to 384 × 384 pixels.
- Output per finding: a confidence score from 0 to 1, a bounding box and a mask outlining the affected area.
- Classes: one class, defect.
- The same ONNX file runs in the backend (onnxruntime) and in the Unity VR app (it was exported for Unity).
- On a normal CPU server one image takes well under a second.

The backend reports, for every image: how many areas were found, the confidence of each, and the **coverage**, meaning the percentage of the image covered by the defect.

# How risk levels are assigned

The dashboard turns the model output into a risk level with simple rules:

- **Critical**: defect covers 30% or more of the image.
- **High**: coverage of 12% or more, or a very confident finding (90%+) covering at least 5%.
- **Medium**: coverage of 3% or more.
- **Low**: small or no findings.

These thresholds are a starting point chosen by the team, not an industry standard. They should be tuned with real inspection data.

# Confidence threshold

By default only findings with at least 70% confidence are shown. In testing, real defects scored above 90%, while false alarms scored between 50% and 73%. The threshold can be changed with the `DETECTION_THRESHOLD` setting on the backend, and per request from the dashboard.

# Known limitations

- The model detects **general defects and anomalies**. It doesn't classify specific weld defects on its own.
- It can mistake other features for defects, for example some cables or fabrics. It works best on close-up photos of metal.
- It has not been validated on a large independent test set, so results should be treated as a screening aid, not a certified inspection.
- Better results would come from more training images, especially "negative" examples of things that are not defects.

# Photo inspector (website)

The project website has a photo inspector. A visitor uploads a photo; the backend runs the defect model on it and, if Gemini is configured, also asks Gemini to review the photo for specific weld defects. The result shows the defect areas drawn on the photo, a 0–100 quality score, a green/amber/red status, the defects found, a short summary and one recommended action. Every inspection is saved as a defect report that also appears in the dashboard. The Gemini part is a visual review, not a certified inspection.
