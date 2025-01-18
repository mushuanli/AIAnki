// @ts-check
"use strict"

const fs = require('fs');
const path = require('path');

const config = require('./config');
const { ensureDirectories,AIChat,genMultimedia } = require('./utils');

const workdir = '../article';

async function genAItem(fileName,outputdir) {
  let dirtyNum = 0;
    try {
      const filePath = path.join(outputdir, `./${config.JSON_DIR}`, fileName);
      if (!fs.existsSync(filePath)) return 0;
      const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));

      let wordData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      let mediaInfo = {
        audio: [
          { name: "audio", text: `${wordData.name}\n${wordData.author}\n${wordData.text}\n`, file: `${fileNameWithoutExt}.mp3` },
        ],
      }
      for( let i = 1 ; i < 20; i ++ ){
        if( !wordData[`text${i}`])
          break;

        mediaInfo.audio.push({
          name: `audio${i}`, text: wordData[`text${i}`], file: `${fileNameWithoutExt}${i}.mp3`
        })
      }
      let mediaNum = await genMultimedia(wordData, outputdir, mediaInfo);

      if (dirtyNum + mediaNum > 0)
        fs.writeFileSync(filePath, JSON.stringify(wordData, null, 2));

      return mediaNum;
    } catch (err) {
      console.error("load cache file failed", fileName, err);
      return 0;
    }
}

/**
 * 
 * @returns 
 */
async function genFromList(outputdir)
{
  let waitRetryCount = 0;
    const jsonDir = path.join(outputdir, `./${config.JSON_DIR}`);
    const files = fs.readdirSync(jsonDir);
    const jsonFiles = files.filter((file) => path.extname(file) === ".json");
  for (const line of jsonFiles) {
    console.log(`Processing word: ${line.trim()}`);
    try {
      let mediaNum = await genAItem(line.trim(),outputdir);
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
    await genFromList(path.join(__dirname,workdir));

    // 创建Anki包的逻辑可以在这里添加
    // await createAnkiPackage(wordDataList, "Enhanced Vocabulary Deck");
    // 代码无效，得使用 anki.py 生成 apkg  -- importNewData();
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

main().catch(console.error);