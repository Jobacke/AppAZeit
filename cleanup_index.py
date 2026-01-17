import re

source_path = '/Users/johannes/Library/CloudStorage/OneDrive-Backhaus/Antigravity/AppAZeit/index.html'

with open(source_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove script tags (including multi-line)
content = re.sub(r'<script\b[^>]*>([\s\S]*?)</script>', '', content)

# Remove style tags
content = re.sub(r'<style\b[^>]*>([\s\S]*?)</style>', '', content)

# Inject main.js
if '</body>' in content:
    content = content.replace('</body>', '<script type="module" src="/src/main.js"></script>\n</body>')
else:
    content += '\n<script type="module" src="/src/main.js"></script>'

# Write back
with open(source_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleaned index.html")
