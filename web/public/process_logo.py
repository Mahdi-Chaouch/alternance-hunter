from PIL import Image

def make_transparent(input_path, output_path, tolerance=20):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    bg_color = data[0]  # coin supérieur gauche = blanc

    newData = []
    for item in data:
        if (abs(item[0] - bg_color[0]) <= tolerance and
            abs(item[1] - bg_color[1]) <= tolerance and
            abs(item[2] - bg_color[2]) <= tolerance):
            newData.append((255, 255, 255, 0))  # transparent
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")
    print(f"✅ Saved: {output_path}")

source = r"C:\Users\mahdi\.gemini\antigravity\brain\b6629119-3482-4f5f-9c91-2662853feb2d\media__1774281439386.png"

# Logo principal transparent
make_transparent(source, "logo.png", tolerance=15)

# Favicon.ico multi-résolution
img = Image.open("logo.png").convert("RGBA")
ico32 = img.resize((32, 32), Image.LANCZOS)
ico32.save("favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print("✅ favicon.ico créé!")

check = Image.open("logo.png")
print(f"✅ logo.png: {check.size}, mode={check.mode}")
