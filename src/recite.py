import os
import json
import genanki
from pathlib import Path

# 定义 Anki 模型 ID 和卡片包 ID（确保唯一性）
MODEL_ID = 1607392319
DECK_ID = 2059400120

# 加载模板文件
with open('data/model.json', 'r', encoding='utf-8') as f:
    model_data = json.load(f)

# 创建 Anki 模型
my_model = genanki.Model(
    model_id=MODEL_ID,
    name=model_data['name'],
    fields=[{'name': field['name']} for field in model_data['flds']],
    templates=[
        {
            'name': tmpl['name'],
            'qfmt': tmpl['qfmt'],
            'afmt': tmpl['afmt'],
        }
        for tmpl in model_data['tmpls']
    ],
    css=model_data['css'],
    model_type=model_data['type'],
    latex_pre=model_data['latexPre'],
    latex_post=model_data['latexPost'],
)

# 遍历 article/json 目录下的所有 JSON 文件
json_dir = Path('json')
audio_dir = Path('audio')
image_dir = Path('images')
output_dir = Path('output')

# 确保输出目录存在
output_dir.mkdir(parents=True, exist_ok=True)

# 创建卡片包
deck_name = "综合卡片包"  # 卡片包名称
my_deck = genanki.Deck(DECK_ID, deck_name)
media_files = []

# 遍历所有 JSON 文件
for json_file in json_dir.glob('*.json'):
    # 读取 JSON 数据
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 创建笔记
    fields = []
    for field in model_data['flds']:
        field_name = field['name']
        if field_name == 'Name':
            fields.append(data.get('name', ''))  # 获取 name 字段
        elif field_name == 'Author':
            fields.append(data.get('author', ''))  # 获取 author 字段
        elif field_name == 'Text':
            # 处理 Text 字段
            text = data.get('text', '')
            fields.append(text.replace('\n', '<br>'))  # 将 \n 替换为 <br>
        elif field_name.startswith('Text') and field_name != 'Text':
            # 处理 Text1, Text2, ..., Text15
            try:
                index = int(field_name.replace('Text', ''))
                text = data.get(f'text{index}', '')
                fields.append(text.replace('\n', '<br>'))  # 将 \n 替换为 <br>
            except ValueError:
                fields.append('')  # 如果字段名不包含数字，返回空字符串
        elif field_name == 'Hint':
            # 处理 Hint 字段
            hint = data.get('hint', '')
            fields.append(hint.replace('\n', '<br>'))  # 将 \n 替换为 <br>
        elif field_name.startswith('Hint') and field_name != 'Hint':
            # 处理 Hint1, Hint2, ..., Hint15
            try:
                index = int(field_name.replace('Hint', ''))
                hint = data.get(f'hint{index}', '')
                fields.append(hint.replace('\n', '<br>'))  # 将 \n 替换为 <br>
            except ValueError:
                fields.append('')  # 如果字段名不包含数字，返回空字符串
        elif field_name == 'Audio':
            # 处理 Audio 字段
            audio_file = data.get('audio', '')
            if audio_file:
                audio_path = audio_dir / audio_file
                if audio_path.exists():
                    media_files.append(audio_path)
                    fields.append(f'[sound:{audio_file}]')
                else:
                    fields.append('')
            else:
                fields.append('')
        elif field_name.startswith('Audio') and field_name != 'Audio':
            # 处理 Audio1, Audio2, ..., Audio15
            try:
                index = int(field_name.replace('Audio', ''))
                audio_file = data.get(f'audio{index}', '')
                if audio_file:
                    audio_path = audio_dir / audio_file
                    if audio_path.exists():
                        media_files.append(audio_path)
                        fields.append(f'[sound:{audio_file}]')
                    else:
                        fields.append('')
                else:
                    fields.append('')
            except ValueError:
                fields.append('')  # 如果字段名不包含数字，返回空字符串
        elif field_name == 'Translate':
            translate = data.get('translate', '')
            fields.append(translate.replace('\n', '<br>'))  # 将 \n 替换为 <br>
        elif field_name == 'Image':
            image_file = data.get('image', '')
            if image_file:
                image_path = image_dir / image_file
                if image_path.exists():
                    media_files.append(image_path)
                    fields.append(image_file)  # 只存储文件名，模板中处理 <img> 标签
                else:
                    fields.append('')
            else:
                fields.append('')
        elif field_name == 'ImagePrompt':
            fields.append(data.get('imageprompt', ''))  # 如果字段不存在，返回空字符串
        else:
            fields.append('')  # 默认返回空字符串

    # 创建笔记并添加到卡片包
    my_note = genanki.Note(
        model=my_model,
        fields=fields,
    )
    my_deck.add_note(my_note)

# 保存卡片包
apkg_file = output_dir / f'{deck_name}.apkg'
genanki.Package(my_deck, media_files=media_files).write_to_file(apkg_file)
print(f'已生成卡片包: {apkg_file}')