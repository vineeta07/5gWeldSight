# WeldSight overview

WeldSight is a 5G-connected weld inspection system built by a student team at Delhi Technological University (DTU), New Delhi, India. A portable camera unit sits next to the weld, streams live video over a 5G network, a vision model checks the footage for defects, and an inspector reviews the results remotely, including in a VR headset.

The goal is to let one qualified inspector check welds at several sites without travelling to each one, and to catch problems while the job is still underway instead of after it is finished.

WeldSight has three parts that work together:

- The **camera unit** on site (the hardware prototype).
- The **backend**, which runs the vision model, the assistant and stores defect reports.
- Two web apps: the **project website** (with a photo inspector anyone can try) and the **inspection dashboard** used by inspectors.

# Hardware prototype

The prototype is a stacked, 3D-printed chassis about the size of a small speaker. From bottom to top:

- **Battery housing**: a 3D-printed base (orange in the photos) holding the power pack, so the unit runs without a cable.
- **Power stage**: a regulator board with a finned heatsink and an inductor that keeps the electronics on a steady supply.
- **Compute layer**: a Raspberry Pi that captures the video and runs the pipeline, plus a 5G modem.
- **Antennas**: four external antennas feed the 5G modem for a strong, low-delay uplink.
- **Pan-tilt camera head**: a camera module on servo-driven pan and tilt axes, so an inspector can aim it at the seam remotely.

The layers are held apart by brass standoffs so wiring stays short and the unit stays compact and portable.

# How it works

WeldSight follows four steps:

1. **Capture**: the pan-tilt camera films the weld as it happens.
2. **Stream**: the 5G modem sends the video out with low delay.
3. **Detect**: the vision model looks for defects in the frames.
4. **Review**: an inspector checks the results on the dashboard or in VR, from anywhere.

For live video, the recommended setup is a MediaMTX media server: the Pi publishes the camera once, and the same stream is available as RTSP (for Unity and OpenCV), WebRTC (for browsers, under a second of delay) and HLS (a browser fallback with a few seconds of delay). Browsers cannot play RTSP directly. 5G SIM cards usually sit behind carrier NAT, so the Pi should push its stream to a cloud relay or join a mesh VPN such as Tailscale.

# VR review

Inspectors can review the live feed in a VR headset through a Unity application. The video is shown on a large curved screen in front of the inspector, with defect markers drawn on top. The same connection can send pan and tilt commands back to the camera head, so the inspector can aim the camera by turning their head.

# Exhibition

WeldSight was shown at the Innovation Exhibition at Delhi Technological University. The team demonstrated the prototype to the Education Minister and the Vice Chairman of DTU, and visitors, including school students, tried the VR inspection and saw the live stream.

# Team and contact

WeldSight is built by students at Delhi Technological University (DTU), New Delhi. For questions about the project, visitors can use the contact links on the project website.
