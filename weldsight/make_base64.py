import base64
with open('website/src/logo.png', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')
content = f'export const logoUrl = "data:image/png;base64,{b64}";\n'
with open('website/src/logoBase64.js', 'w') as f:
    f.write(content)
with open('dashboard/src/logoBase64.ts', 'w') as f:
    f.write(content)
print('Base64 files created!')
