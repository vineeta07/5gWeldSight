from PIL import Image
import os
import sys

def crop_transparent_padding(input_path, output_path):
    print(f"Opening {input_path}")
    try:
        img = Image.open(input_path)
        img = img.convert("RGBA")
        
        # Get bounding box of non-transparent pixels
        bbox = img.getbbox()
        if bbox:
            print(f"Found bounding box: {bbox}")
            cropped_img = img.crop(bbox)
            cropped_img.save(output_path, "PNG")
            print(f"Saved cropped image to {output_path}")
            return True
        else:
            print("Image is entirely transparent or empty")
            return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    website_logo = "../website/public/logo.png"
    dashboard_logo = "../dashboard/public/logo.png"
    
    website_out = "../website/public/logo_favicon.png"
    dashboard_out = "../dashboard/public/logo_favicon.png"
    
    if os.path.exists(website_logo):
        crop_transparent_padding(website_logo, website_out)
    else:
        print(f"Could not find {website_logo}")
        
    if os.path.exists(dashboard_logo):
        crop_transparent_padding(dashboard_logo, dashboard_out)
    else:
        print(f"Could not find {dashboard_logo}")

if __name__ == "__main__":
    main()
