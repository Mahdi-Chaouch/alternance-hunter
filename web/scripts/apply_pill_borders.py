import re
import os

css_files = [
    "page.module.css",
    "landing.module.css",
    "login/login.module.css",
]

for file in css_files:
    if os.path.exists(file):
        with open(file, "r", encoding="utf-8") as f:
            content = f.read()

        # Change cards & panels to 36px for Extreme rounded
        content = re.sub(r"border-radius: 20px;", "border-radius: 36px;", content)
        content = re.sub(r"border-radius: 24px;", "border-radius: 36px;", content)
        content = re.sub(r"border-radius: 18px;", "border-radius: 36px;", content)
        
        # Change inputs, buttons to pill (9999px)
        content = re.sub(r"border-radius: 10px;", "border-radius: 9999px;", content)
        content = re.sub(r"border-radius: 12px;", "border-radius: 9999px;", content)
        content = re.sub(r"border-radius: 8px;", "border-radius: 9999px;", content)
        content = re.sub(r"border-radius: 6px;", "border-radius: 16px;", content)
        
        with open(file, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Applied Pill & Extreme rounded borders to {file}")

