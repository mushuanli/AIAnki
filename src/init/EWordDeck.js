// @ts-check
"use strict"

const fs = require('fs');
const path = require('path');

const config = require('../lib/config');
const { ensureDirectories,AIChat,genMultimedia } = require('../lib/utils');

const initFilename = './EA/EWordList.json';

async function initMultimedia(outputdir) {
    let waitRetryCount = 0;
    const files = fs.readdirSync(path.join(outputdir,config.JSON_DIR));
    const jsonFiles = files.filter((file) => path.extname(file) === ".json");

    for (let wordFile of jsonFiles) {
      const filePath = path.join(outputdir, `./${config.JSON_DIR}`, wordFile);
      try {
        let wordData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        let mediaNum = await genMultimedia(wordData, outputdir, {
          audio: [
            {
              name: "audio",
              text: wordData.word,
              file: `${wordData.word}.mp3`,
            },
            {
              name: "audio_example",
              text: wordData.example_en,
              file: `${wordData.word}_example.mp3`,
            },
          ],
          image: [
            {
              name: "image",
              text: wordData?.image_prompt,
              file: `${wordData.word}.png`,
              tmpId: "image_taskid",
            },
          ],
        });
        if (mediaNum > 0){
            waitRetryCount ++;
            fs.writeFileSync(filePath, JSON.stringify(wordData, null, 2));
        }
      } catch (err) {
        console.error("load cache file failed", filePath, err);
        waitRetryCount ++;
      }
    }
 
    if( waitRetryCount > 0){
        console.log(`===== NEED TO WAIT FOR DOWNLOAD IMAGE COUNT: ${waitRetryCount} =====`);
    }

    return waitRetryCount;
}

async function initFromTxt(fileName, outputdir) {
  const wordListText = fs.readFileSync(fileName, "utf-8");
  const wordList = wordListText.split("\n").filter((line) => line.trim());
  let currentUnit = 1;

  for (const line of wordList) {
    if (line.startsWith("Unit")) {
      currentUnit = parseInt(line.split(" ")[1], 10);
      continue;
    }
    let wordData = await AIChat([
      {
        role: "system",
        content:
          "你是一名英语教育专家和anki大师，精通英语单词的学习和教学，生成适合青少年学习的英语单词卡片内容。",
      },
      {
        role: "user",
        content: `请为单词 "${line}" 生成完整的学习卡片内容，包括：
        1. 基本信息：音标, 词义，难度等级 (1-5)
        2. 词源和记忆技巧：词根词缀、联想记忆、图像记忆
        3. 一个例句和对应的中文翻译
        4. 搭配：常用词组搭配
        5. 图片生成提示：为主图和例句配图提供详细的场景描述
        输出为json格式, 但是不要包括markdown语法:  + ${JSON.stringify({
          word: "输入的英文单词或词组",
          symbol: "音标",
          chn: "中文释义",
          example_en: "一个英文例句",
          example_cn: "example_en的中文意思",
          word_family: "词族,单词的常用变形和常用组合",
          memory_tips: "记忆技巧,包括词源、记忆技巧等有助于记忆的信息",
          difficulty: "难度等级",
          image_prompt: 'example_en 配图的详细描述',
          collocations: '常用搭配和对应的中文意思'
        })}`,
      },
    ]);
    const filePath = path.join(
      outputdir,
      `./${config.JSON_DIR}`,
      `${wordData.word}.json`
    );
    wordData.unit = currentUnit;
    fs.writeFileSync(filePath, JSON.stringify(wordData, null, 2));
  }
}

async function initFromJson(fileName, outputdir) {
  const wordListText = fs.readFileSync(fileName, "utf-8");
  const wordList = JSON.parse(wordListText);

  let currentUnit = 1;
  for (let item of wordList) {
    if (/^\d+$/.test(item.name)) {
      currentUnit = item.name;
      continue;
    }
    const filePath = path.join(
      outputdir,
      `./${config.JSON_DIR}`,
      `${item.name}.json`
    );
    if (fs.existsSync(filePath)) 
      continue;

    let wordData = await AIChat([
      {
        role: "system",
        content:
          "你是一名英语教育专家和anki大师，精通英语单词的学习和教学，生成适合青少年学习的英语单词卡片内容。",
      },
      {
        role: "user",
        content: `请为英文单词 "${item.name}  ${
          item.chn
        }" 生成完整的学习卡片内容，包括：
        1. 基本信息：音标, 词义，难度等级 (1-5)
        2. 词源和记忆技巧：词根词缀、联想记忆、图像记忆
        3. 一个例句和对应的中文翻译
        4. 搭配：常用词组搭配
        5. 图片生成提示：为主图和例句配图提供详细的场景描述
        输出为json格式, 但是不要包括markdown语法:  + ${JSON.stringify({
          example_en: "一个英文例句",
          example_cn: "example_en的中文意思",
          word_family: "词族,单词的常用变形和常用组合",
          memory_tips: "记忆技巧,包括词源、记忆技巧等有助于记忆的信息",
          difficulty: "难度等级",
          image_prompt: 'example_en 配图的详细描述',
          collocations: '常用搭配和对应的中文意思'

        })}`,
      },
    ]);
    wordData = { ...wordData, ...item, word: item.name, unit: currentUnit };
    
    fs.writeFileSync(filePath, JSON.stringify(wordData, null, 2));
  }
}

async function main() {
  try {
    const intFilePath = path.join(__dirname,'../../',initFilename);
    const outputDir = path.dirname(intFilePath);
    ensureDirectories(outputDir,[config.AUDIO_DIR, config.IMAGE_DIR, config.MEDIA_DIR,config.JSON_DIR]);

    if( intFilePath.endsWith('.json') )
        await initFromJson(intFilePath,outputDir);
    else     if( intFilePath.endsWith('.txt') ){
        await initFromTxt(intFilePath,outputDir);
    }

    let count = 1;
    while(count > 0 ){
        count = await initMultimedia(outputDir);
        if( count > 0 )
            await new Promise((resolve) => setTimeout(resolve, 30*1000))
    }

    // 创建Anki包的逻辑可以在这里添加
    // await createAnkiPackage(wordDataList, "Enhanced Vocabulary Deck");
    // 代码无效，得使用 anki.py 生成 apkg  -- importNewData();
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

main().catch(console.error);