// @ts-check
"use strict"

const fs = require('fs');
const path = require('path');

const config = require('../lib/config');
const { ensureDirectories,AIChat,genMultimedia } = require('../lib/utils');


async function genAItem(inputString, unit,outputdir) {
  let wordData;
  let filePath;
  let dirtyNum = 0;

  if (inputString.endsWith('.json')) {
    try{
      filePath = path.join(outputdir,`./${config.JSON_DIR}`, inputString);
      if ( !fs.existsSync(filePath))
        return 0;

      wordData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
    catch(err){
      console.error('load cache file failed',filePath,err);
      return 0;
    }
  }
  else{
    wordData = await AIChat( [
      {
        role: "system",
        content: "你是一名英语教育专家和anki大师，精通英语单词的学习和教学，生成适合青少年学习的英语单词卡片内容。"
      },
      {
        role: "user",
        content: `请为单词 "${inputString}" 生成完整的学习卡片内容，包括：
  1. 基本信息：音标, 词义，难度等级 (1-5)
  2. 词源和记忆技巧：词根词缀、联想记忆、图像记忆
  3. 一个例句和对应的中文翻译
  4. 搭配：常用词组搭配
  5. 图片生成提示：为主图和例句配图提供详细的场景描述
  输出为json格式, 但是不要包括markdown语法:  + ${JSON.stringify({
          "word": "输入的英文单词或词组",
          "symbol": "音标",
          "chn": "中文释义",
          "example_en": "一个英文例句",
          "example_cn": "example_en的中文意思",
          "word_family": "词族,单词的常用变形和常用组合",
          "memory_tips": "记忆技巧,包括词源、记忆技巧等有助于记忆的信息",
          "difficulty": "难度等级"
        })}`
      }
    ]);
    filePath = path.join(outputdir,`./${config.JSON_DIR}`, `${wordData.word}.json`);
    dirtyNum ++;
    wordData.unit = unit;
  }

  let mediaNum = await genMultimedia(wordData,outputdir,{
    audio: [{name: 'audio',text: wordData.word, file: `${wordData.word}.mp3`},
      {name: 'audio_example',text: wordData.example_en, file: `${wordData.word}_example.mp3`}
    ],
    image: [{name: 'image',text: wordData?.image_prompt?.example_image,
        file: `${wordData.word}.png`,tmpId: 'image_taskid'},
    ],
  });

  // @ts-ignore
  if( dirtyNum + mediaNum > 0 )
    fs.writeFileSync(filePath, JSON.stringify(wordData, null, 2));

  return mediaNum;
}

/**
 * 
 * @param {string|undefined} filename - if set filename, will load word list from file,
 *                                      else load word json file list from output dirs 
 * @returns 
 */
async function genFromList(filename,outputdir)
{
  let wordList;
  if( filename) {
    const wordListText = fs.readFileSync(filename, 'utf-8');
    wordList = wordListText.split('\n').filter(line => line.trim());
  }
  else{
    const jsonDir = path.join(outputdir, `./${config.JSON_DIR}`);
    const files = fs.readdirSync(jsonDir);
    const jsonFiles = files.filter((file) => path.extname(file) === ".json");
    wordList = jsonFiles;
  }

  let currentUnit = 1;
  let waitRetryCount = 0;

  for (const line of wordList) {
    if (line.startsWith("Unit")) {
      currentUnit = parseInt(line.split(" ")[1], 10);
      continue;
    }
    console.log(`Processing word: ${line.trim()}`);
    try {
      let mediaNum = await genAItem(line.trim(), currentUnit,outputdir);
      if( mediaNum > 0 )
        waitRetryCount ++;
      console.log(`Completed processing: ${line.trim()}`);
    } catch (error) {
      console.error(`Error processing word ${line.trim()}:`, error.message);
      fs.appendFileSync('errorlist.txt', `Error processing word ${line.trim()}: ${error.message}\n`);
    }
  }

  if( waitRetryCount > 0){
    console.log(`===== NEED TO WAIT FOR DOWNLOAD IMAGE COUNT: ${waitRetryCount} =====`);
  }

  return waitRetryCount;
}


async function main() {
  try {
    ensureDirectories([config.AUDIO_DIR, config.IMAGE_DIR, config.MEDIA_DIR,config.JSON_DIR]);
    let fileName ;//= 'wordlist.txt'; // 如果指定，那么重建，不然仅更新媒体文件
    await genFromList(fileName,path.join(__dirname,'../'));

    // 创建Anki包的逻辑可以在这里添加
    // await createAnkiPackage(wordDataList, "Enhanced Vocabulary Deck");
    // 代码无效，得使用 anki.py 生成 apkg  -- importNewData();
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

main().catch(console.error);