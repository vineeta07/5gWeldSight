// Files in /public are served as-is, so we reference them by URL instead of
// importing them (Vite doesn't process imports from /public).
// encodeURI handles the spaces in folder names like "welsight images".
const asset = (path) => encodeURI(`/assets/${path}`);

// Videos
export const weldsightHeroVideo = asset("videosweldsight/hero0.mp4?v=3");
export const highlightFirstVideo = asset("videosweldsight/highlight1.mp4?v=3");
export const highlightSecondVideo = asset("videosweldsight/highlight2.mp4?v=3");
export const highlightThirdVideo = asset("videosweldsight/highlight3.mp4?v=3");
export const highlightFourthVideo = asset("videosweldsight/highlight4.mp4?v=3");

// Exhibition photos
export const exhibitionImage = asset("welsight images/exhibition.jpeg");
export const ministerImage = asset("welsight images/witheducation minister.jpeg");

// Prototype photos
const proto = (file) => asset(`welsight images/prototypeallsideview/${file}`);
export const protoFront = proto("0121ffd6-fc1e-4190-b6eb-7f4f3e2f624c.jpg");
export const protoPower = proto("072359da-65d2-4d4b-ae56-067a9c8e2225.jpg");
export const protoAngled = proto("607f95df-55f2-4b41-ac2b-edff990a267e.jpg");
export const protoAntennas = proto("758d81e1-456e-434c-8884-e8309931dd6a.jpg");
export const protoCamera = proto("9affc39b-7691-493f-9423-99a1c646ce6e.jpg");
export const protoSide1 = proto("WhatsApp Image 2026-09-21 at 4.30.49 PM.jpeg");
export const protoSide2 = proto("WhatsApp Image 2026-09-21 at 4.30.50 PM.jpeg");
export const protoTop = proto("a673315b-b258-4043-83ea-39967e5029a5.jpg");
export const protoTop2 = proto("bcc583e4-4988-4e30-b5a9-ce9231a25bcf.jpg");
export const protoPower2 = proto("dd2165d5-0c59-4525-b32d-efae9f3c2bdb.jpg");
export const protoBack = proto("ea109a44-8f9f-4805-9e14-0f9194e672a7.jpg");

