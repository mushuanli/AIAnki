import genanki
import yaml
import os
import argparse

# 设置命令行参数解析
parser = argparse.ArgumentParser(description="生成 Anki 卡片")
parser.add_argument("data_file", type=str, help="YAML 数据文件的路径")
args = parser.parse_args()

# 从命令行参数中获取 data_file
data_file = args.data_file

# 从 YAML 文件加载数据
with open(data_file, "r", encoding="utf-8") as file:
    data = yaml.safe_load(file)

# 从 YAML 数据中读取 DECK_ID 和 DECK_NAME
_DECK_ID = None
_DECK_NAME = None

for item in data:
    if "deckId" in item:
        _DECK_ID = item["deckId"]
    if "deckName" in item:
        _DECK_NAME = item["deckName"]

if _DECK_ID is None or _DECK_NAME is None:
    raise ValueError("YAML 文件中缺少 deckId 或 deckName")

# 定义 Enhanced Cloze 2.1 v2 模型
my_model = genanki.Model(
    1607392019,  # 随机生成唯一ID，需固定不变
    "Enhanced Cloze 2.1 v2",
    fields=[
        {"name": "Text"},  # 文本字段
    ],
    templates=[
        {
            "name": "Cloze Card",
            "qfmt": "{{cloze:Text}}",  # 正面：显示完形填空
            "afmt": "{{cloze:Text}}",  # 背面：显示完形填空（答案部分高亮）
        },
    ],
    css="""
        .card {
            font-family: Arial;
            font-size: 16px;
            text-align: left;
        }
        .cloze {
            font-weight: bold;
            color: blue;
        }
        strong {
            font-weight: bold;
            color: red;  # 自定义加粗文本的颜色
        }
    """,
    model_type=genanki.Model.CLOZE,  # 设置为完形填空模型
)

# 定义卡组
my_deck = genanki.Deck(_DECK_ID, _DECK_NAME)

# 生成卡片
for item in data:
    if "title" in item and "content" in item:  # 仅处理包含 title 和 content 的项
        title = item["title"]
        content = item["content"]
        
        # 将内容中的换行符替换为 HTML 的 <br> 标签
        content_with_br = content.replace("\n", "<br>")
        
        # 添加标题并用 <br> 分隔
        formatted_text = f"<h1>{title}</h1><br>{content_with_br}"
        
        # 创建笔记并添加到卡组中
        note = genanki.Note(
            model=my_model,
            fields=[formatted_text],  # 每张卡片的内容
        )
        my_deck.add_note(note)

# 生成APKG文件，文件名为 deckName.apkg
output_file = f"{_DECK_NAME}.apkg"
genanki.Package(my_deck).write_to_file(output_file)
print(f"Anki 卡片已生成，保存为: {output_file}")