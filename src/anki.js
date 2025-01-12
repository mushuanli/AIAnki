// @ts-check
"use strict"

const fs = require('fs');
const path = require('path');

const config = require('./config');
const { ensureDirectories,genFromWordList } = require('./utils');
const {importNewData} = require('./import')

async function main() {
  try {
    ensureDirectories([config.AUDIO_DIR, config.IMAGE_DIR, config.MEDIA_DIR,config.JSON_DIR]);
    let fileName ;//= 'wordlist.txt'; // 如果指定，那么重建，不然仅更新媒体文件
    const wordDataList = await genFromWordList(fileName);

    // 创建Anki包的逻辑可以在这里添加
    // await createAnkiPackage(wordDataList, "Enhanced Vocabulary Deck");
    // 代码无效，得使用 anki.py 生成 apkg  -- importNewData();
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

main().catch(console.error);