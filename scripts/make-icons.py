"""生成 PWA 图标：深色底 + 3×3 宫格 + 少量填充格，无外部字体依赖。"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "icons"
SIZES = (192, 512)

BG = (15, 23, 42, 255)
LINE = (255, 255, 255, 255)
FILL_BLUE = (59, 130, 246, 255)
FILL_WHITE = (248, 250, 252, 255)

# 用 9×9 网格坐标标出要填充的格子（行列从 0 开始）
BLUE_CELLS = {(0, 1), (1, 4), (2, 7), (3, 2), (4, 5), (5, 0), (6, 6), (7, 3), (8, 8)}
WHITE_CELLS = {(0, 4), (2, 2), (4, 4), (6, 8), (8, 0)}


def draw_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(image)

    margin = round(size * 0.16)
    board = size - margin * 2
    cell = board / 9

    for row, col in BLUE_CELLS:
        x = margin + col * cell
        y = margin + row * cell
        draw.rounded_rectangle(
            (x + cell * 0.16, y + cell * 0.16, x + cell * 0.84, y + cell * 0.84),
            radius=cell * 0.18,
            fill=FILL_BLUE,
        )

    for row, col in WHITE_CELLS:
        x = margin + col * cell
        y = margin + row * cell
        draw.rounded_rectangle(
            (x + cell * 0.16, y + cell * 0.16, x + cell * 0.84, y + cell * 0.84),
            radius=cell * 0.18,
            fill=FILL_WHITE,
        )

    # 细网格
    for i in range(10):
        pos = margin + i * cell
        width = max(1, round(size * 0.0025))
        draw.line([(margin, pos), (size - margin, pos)], fill=LINE, width=width)
        draw.line([(pos, margin), (pos, size - margin)], fill=LINE, width=width)

    # 宫格线
    for i in (0, 3, 6, 9):
        pos = margin + i * cell
        width = max(3, round(size * 0.011))
        draw.line([(margin, pos), (size - margin, pos)], fill=LINE, width=width)
        draw.line([(pos, margin), (pos, size - margin)], fill=LINE, width=width)

    return image


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUT_DIR / f"icon-{size}.png"
        draw_icon(size).save(path, "PNG")
        print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
