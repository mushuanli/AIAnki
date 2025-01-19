import os
import json
import genanki
from pathlib import Path

# 定义 Anki 模型 ID 和卡片包 ID（确保唯一性）
MODEL_ID = 1607392319
DECK_ID = 2059400120

current_dir = os.path.dirname(__file__)
model_json_path = os.path.join(current_dir, '../../data/recitemodel.json')
with open(model_json_path, 'r', encoding='utf-8') as f:
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

output_dir.mkdir(parents=True, exist_ok=True)

deck_name = "综合卡片包"
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
        elif field_name.startswith('Text'):
            # 处理 Text, Text1, Text2, ..., Text9
            if field_name == 'Text':
                text = data.get('text', '')
            else:
                try:
                    index = int(field_name.replace('Text', ''))
                    text = data.get(f'text{index}', '')
                except ValueError:
                    text = ''
            fields.append(text.replace('\n', '<br>'))  # 将 \n 替换为 <br>
        elif field_name.startswith('Hint'):
            # 处理 Hint, Hint1, Hint2, ..., Hint9
            if field_name == 'Hint':
                hint = data.get('hint', '')
            else:
                try:
                    index = int(field_name.replace('Hint', ''))
                    hint = data.get(f'hint{index}', '')
                except ValueError:
                    hint = ''
            fields.append(hint.replace('\n', '<br>'))  # 将 \n 替换为 <br>
        elif field_name.startswith('Audio'):
            # 处理 Audio, Audio1, Audio2, ..., Audio9
            if field_name == 'Audio':
                audio_file = data.get('audio', '')
            else:
                try:
                    index = int(field_name.replace('Audio', ''))
                    audio_file = data.get(f'audio{index}', '')
                except ValueError:
                    audio_file = ''
            if audio_file:
                audio_path = audio_dir / audio_file
                if audio_path.exists():
                    media_files.append(audio_path)
                    fields.append(f'[sound:{audio_file}]')  # 直接写入音频引用
                else:
                    fields.append('')
            else:
                fields.append('')
        elif field_name == 'Translate':
            translate = data.get('translate', '')
            fields.append(translate.replace('\n', '<br>'))  # 将 \n 替换为 <br>
        elif field_name == 'Image':
            image_file = data.get('image', '')
            if image_file:
                image_path = image_dir / image_file
                if image_path.exists():
                    media_files.append(image_path)
                    fields.append(f'<img src="{image_file}">')  # 直接写入图片引用
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