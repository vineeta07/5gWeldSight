import cv2
import numpy as np

def resize_pad(img_path, out_path, size):
    img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
    h, w = img.shape[:2]
    scale = (size * 0.6) / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    img_scaled = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    canvas = np.zeros((size, size, img.shape[2]), dtype=img.dtype)
    x_off = (size - new_w) // 2
    y_off = (size - new_h) // 2
    canvas[y_off:y_off+new_h, x_off:x_off+new_w] = img_scaled
    
    cv2.imwrite(out_path, canvas)

resize_pad("../dashboard/public/logoblack.png", "../dashboard/public/pwa-192x192.png", 192)
resize_pad("../dashboard/public/logoblack.png", "../dashboard/public/pwa-512x512.png", 512)
print("Icons created!")
