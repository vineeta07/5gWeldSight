import cv2
import numpy as np

def resize_pad(img_path, out_path, size):
    img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
    h, w = img.shape[:2]
    # pad to square
    side = max(h, w)
    padded = np.zeros((side, side, img.shape[2]), dtype=img.dtype)
    y_off = (side - h) // 2
    x_off = (side - w) // 2
    padded[y_off:y_off+h, x_off:x_off+w] = img
    # resize
    resized = cv2.resize(padded, (size, size), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out_path, resized)

resize_pad("../dashboard/public/logo.png", "../dashboard/public/pwa-192x192.png", 192)
resize_pad("../dashboard/public/logo.png", "../dashboard/public/pwa-512x512.png", 512)
print("Icons created!")
