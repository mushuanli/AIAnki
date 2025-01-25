Anki 卡片生成工具
# 介绍
## 英文单词背诵卡片
- src/init/EWordDeck.js  - 读取 data/EWordList.txt, 为每个单词生成当前目录下 json/ audio/ images 
  ** 需要有 deepseek 和 flux API KEY(生成图片)并设置环境变量 OPENAI_API_KEY FLUX_API_KEY **
  ** 如果在 mac , 那么需要brew install lame, 其他环境需要 python -m venv myenv ; 然后安装 edge-tts **

  ** data/EWordList.txt  的内容生成可以拍照，然后让 deepseek 提示："把图片中内容转变成文字" 得到也可以使用其他免费的AI 例如 gemini 等, 然后自己校对一下，
 ** 务必保证每个单词一行 ** 

- src/gen/EWordDeck.py  - 读取 data/EWordModel.json 和 当前目录下 json/ audio/ images 生成英文单词背诵卡片

## 文章背诵卡片
- src/init/recite.js  - 读取 当前目录下 json/, 生成 audio/ images/ , 当前目录下 json/可以让 ai 生成
- src/gen/recite.py - 读取 data/recitemodel.json 和当前目录 json/ audio/ image/ 生成 recite.apkg

读取 data/wordlist.txt 文件内的内容，并为每个单词造句生成 音频和单词卡片


# 运行前：
## 设置环境变量和服务器信息，默认使用 deepseek和阿里云百炼的flux， 如果改用其他需要修改 src/config.js:
    FLUX_API_KEY - flux 认证，
    OPENAI_API_KEY - deepseek 认证
 # 运行
 保存单词信息到 data/EWordList.txt 文件，格式保持相同
 先运行 src/EWordDeck.js 生成 json/ audio/ images/ 信息
 由于图片的生成是异步的而且速度慢，并且还可能失败，所以多运行几次，一般图片申请成功后可能几个小时才会生成。
 重复运行一直到所有图片都生成。

 再运行 src/gen/EWordDeck.py, 这将会将json/ audio/ images打包成 apkg.


# prompt
## 图片到单词信息
提取单词信息, 输出json格式，如果单词前面有* 去掉，如果一个单词信息在多行，放在一起，如:
    {"name": "type", "symbol": "/tarp/", "chn": "n. 类型, 种类; vt. & vi. 打字"},
## 数学卡片 prompt
- 订正下面 anki卡片内容，使用 HTML 代替 Markdown 并确保在 Anki 中格式良好， 确认anki中数学公式都正确使用 mathJax表示，输出 YAML 格式内容：
- 转换成一张数学学习卡片，数学公式使用 mathjax, 对重要知识点标记 cloze, 输出 yaml 格式:

