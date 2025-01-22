import genanki
import yaml

# 定义 Enhanced Cloze 2.1 v2 模型， 需要 anki 添加插件id: 1990296174
my_model = genanki.Model(
    1607392319,  # 随机生成唯一ID，需固定不变
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
my_deck = genanki.Deck(2059400110, "古诗文默写完形填空")

# 从 YAML 文件加载数据
with open("data.yaml", "r", encoding="utf-8") as file:
    data = yaml.safe_load(file)

# 生成卡片
for item in data:
    title = item["title"]
    content = item["content"]
    formatted_text = f"<h1>{title}</h1><br>{content}"  # 添加标题并用 <br> 分隔
    note = genanki.Note(
        model=my_model,
        fields=[formatted_text],  # 每张卡片的内容
    )
    my_deck.add_note(note)

# 生成APKG文件
genanki.Package(my_deck).write_to_file("poetry_cloze.apkg")