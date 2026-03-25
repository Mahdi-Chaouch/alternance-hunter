import os

files_to_update = [
    "page.module.css",
    "login/login.module.css",
]

replacements = {
    # page.module.css standard primary
    "#2563eb": "#01B2B2", # primary
    "#1d4ed8": "#009B9B", # primary-hover
    
    # page.module.css dark mode primary
    "#3b82f6": "#01B2B2", # primary dark
    "#60a5fa": "#81DC4D", # primary-hover dark
    
    # RGB equivalents used in box-shadows or gradients
    "37, 99, 235": "1, 178, 178",
    "59, 130, 246": "1, 178, 178",
    
    # bg colors for running state
    "#dbeafe": "#E0F7F7",
    "#172554": "#003333",
    "#93c5fd": "#81DC4D",
    
    # login.module.css
    "#22c55e": "#01B2B2",
    "#16a34a": "#81DC4D",
    "#4ade80": "#81DC4D",
    "#a3e635": "#81DC4D",
    
    # RGBs for login buttons/focus
    "34, 197, 94": "1, 178, 178",
    "22, 163, 74": "1, 178, 178",
    "190, 242, 100": "129, 220, 77",
}

for filepath in files_to_update:
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        
        for old_val, new_val in replacements.items():
            content = content.replace(old_val, new_val)
            
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"File not found: {filepath}")
