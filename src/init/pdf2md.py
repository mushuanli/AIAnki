import sys
from pdf2image import convert_from_path
from paddleocr import PaddleOCR

def pdf_to_md(pdf_filename):
    # 将 PDF 转换为图片
    images = convert_from_path(pdf_filename)

    # 初始化 PaddleOCR
    ocr = PaddleOCR(use_angle_cls=True, lang="ch")  # 设置语言为中文

    # 生成输出文件名（将 .pdf 替换为 .md）
    if pdf_filename.lower().endswith(".pdf"):
        md_filename = pdf_filename[:-4] + ".md"
    else:
        md_filename = pdf_filename + ".md"

    # 提取文本并保存为 Markdown
    with open(md_filename, "w", encoding="utf-8") as f:
        for i, image in enumerate(images):
            image.save(f"page_{i+1}.png", "PNG")  # 保存图片
            result = ocr.ocr(f"page_{i+1}.png", cls=True)  # 提取文本
            for line in result:
                f.write(line[1][0] + "\n")  # 将每一行写入 Markdown 文件

    print(f"Markdown 文件已生成: {md_filename}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("请提供 PDF 文件名作为参数。")
        print("用法: python pdf_to_md.py <文件名>.pdf")
    else:
        pdf_filename = sys.argv[1]
        pdf_to_md(pdf_filename)