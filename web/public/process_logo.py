from PIL import Image
import sys

def make_transparent(input_path, output_path, tolerance=20):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()

    # Get the color of the top-left pixel(white background)
    bg_color = data[0]

    newData = []
    for item in data:
        if (abs(item[0] - bg_color[0]) <= tolerance and
            abs(item[1] - bg_color[1]) <= tolerance and
            abs(item[2] - bg_color[2]) <= tolerance):
            newData.append((255, 255, 255, 0))  # fully transparent
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")
    print(f"Transparent logo saved: {output_path}")

# Source = the uploaded logo from chat media
source = r"C:\Users\mahdi\.gemini\antigravity\brain\b6629119-3482-4f5f-9c91-2662853feb2d\media__1774280428159.png"

# Step 1: Make background transparent, save as logo.png
make_transparent(source, "logo.png", tolerance=20)

# Step 2: Create favicon.ico
img = Image.open("logo.png").convert("RGBA")
ico16 = img.resize((16, 16), Image.LANCZOS)
ico32 = img.resize((32, 32), Image.LANCZOS)
ico48 = img.resize((48, 48), Image.LANCZOS)
ico32.save("favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print("favicon.ico created!")

# Verify
from PIL import Image as Img
check = Img.open("logo.png")
print(f"Logo size: {check.size}, mode: {check.mode}")
