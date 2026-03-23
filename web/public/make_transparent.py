from PIL import Image
import sys

def make_transparent(input_path, output_path, tolerance=10):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()

    # Get the color of the top-left pixel to assume as background
    bg_color = data[0]

    newData = []
    for item in data:
        # Check if the pixel is within the tolerance of the background color
        if (abs(item[0] - bg_color[0]) <= tolerance and
            abs(item[1] - bg_color[1]) <= tolerance and
            abs(item[2] - bg_color[2]) <= tolerance):
            newData.append((255, 255, 255, 0)) # transparent
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")
    print(f"Saved transparent image to {output_path}")

if __name__ == "__main__":
    make_transparent("logo.png", "logo_transparent.png")
