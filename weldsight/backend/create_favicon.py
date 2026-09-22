import base64
import os

def create_svg_favicon(png_path, svg_path):
    if not os.path.exists(png_path):
        print(f"PNG not found: {png_path}")
        return
        
    with open(png_path, "rb") as f:
        png_data = f.read()
        
    b64_data = base64.b64encode(png_data).decode("utf-8")
    
    # Create the SVG with the base64 encoded image embedded
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <image href="data:image/png;base64,{b64_data}" x="-25" y="-25" width="150" height="150" />
</svg>"""

    with open(svg_path, "w") as f:
        f.write(svg_content)
    print(f"Created SVG favicon at {svg_path}")

create_svg_favicon("../website/public/logo.png", "../website/public/favicon.svg")
create_svg_favicon("../dashboard/public/logo.png", "../dashboard/public/favicon.svg")
