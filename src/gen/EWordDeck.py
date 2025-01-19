# -*- coding: utf-8 -*-
import genanki
import json
import os

_DECK_NAME = '初中单词'

current_dir = os.path.dirname(__file__)

model_json_path = os.path.join(current_dir, '../../data/EWordModel.json')

with open(model_json_path, 'r', encoding='utf-8') as f:
    model_data = json.load(f)

# 从 JSON 数据中提取模型参数
my_model = genanki.Model(
    model_id=model_data['id'],  # 模型ID
    name=model_data['name'],  # 模型名称
    fields=[{'name': field['name']} for field in model_data['flds']],  # 字段
    templates=[
        {
            'name': tmpl['name'],
            'qfmt': tmpl['qfmt'],
            'afmt': tmpl['afmt'],
        }
        for tmpl in model_data['tmpls']
    ],
    css=model_data['css'],  # CSS 样式
    model_type=model_data['type'],  # 模型类型
    latex_pre=model_data['latexPre'],  # LaTeX 前置代码
    latex_post=model_data['latexPost'],  # LaTeX 后置代码
)

# 手动设置排序字段
my_model.sortf = model_data['sortf']

# 定义卡片包
my_deck = genanki.Deck(
    2059400110,  # 卡片包ID
    _DECK_NAME  # 卡片包名称
)

media_files = []

json_dir = './json'
for filename in os.listdir(json_dir):
    if filename.endswith('.json'):
        with open(os.path.join(json_dir, filename), 'r', encoding='utf-8') as f:
            word_data = json.load(f)

        word = word_data['word']
        symbol = word_data['symbol']
        chn = word_data['chn']
        example_en = word_data['example_en']
        audio = word_data.get('audio', '')  # 获取单词音频文件，默认为空
        audio_example = word_data.get('audio_example', '')  # 获取例句音频文件，默认为空
        image = word_data.get('image', '')  # 获取图片文件，默认为空
        unit = word_data['unit']
        grade = "七下"  # 固定值，可以根据需要调整
        example_cn = word_data['example_cn']
        word_family = word_data['word_family']
        if 'memory_tips' in word_data:
            # 提取 memory_tips，并删除“联想记忆”和“图像记忆”部分
            memory_tips = word_data['memory_tips'].split("联想记忆：")[0].strip()
        else:
            # 如果 memory_tips 不存在，设置为空字符串或默认值
            memory_tips = ""
        difficulty = word_data['difficulty']

        # 添加多媒体文件路径（如果文件存在）
        if audio:
            media_files.append(f'audio/{audio}')
        if audio_example:
            media_files.append(f'audio/{audio_example}')
        if image:
            media_files.append(f'images/{image}')

        # 定义 fields
        fields = [
            word,  # 单词（现在是第一个字段）
            "",  # 个人笔记
            grade,  # 年级
            str(unit),  # 单元
            symbol,  # 音标
            chn,  # 中文解释
            f'<img src="{image}">' if image else "",  # 图片（如果存在）
            example_en,  # 英文例句
            f'[sound:{audio_example}]' if audio_example else "",  # 例句发音（如果存在）
            f'[sound:{audio}]' if audio else "",  # 单词发音（如果存在）
            "",  # Photo2（空字段）
            example_cn if example_cn else "",  # 中文例句
            word_family if word_family else "",  # 词族
            memory_tips if memory_tips else "",  # 记忆技巧
            str(difficulty) if difficulty else "",  # 难度
        ]

        for i, field in enumerate(fields):
            if not isinstance(field, str):
                print(f"error {word}: field at index {i} is not a string (type: {type(field)})")

        # 定义卡片
        note = genanki.Note(
            model=my_model,
            fields=fields,
        )

        my_deck.add_note(note)

genanki.Package(my_deck, media_files=media_files).write_to_file('EWordDeck.apkg')