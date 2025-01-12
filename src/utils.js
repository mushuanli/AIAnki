// @ts-check
"use strict"

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const OpenAI = require('openai');

const config = require('./config');


// 初始化OpenAI
// @ts-ignore
const openai = new OpenAI({
  baseURL: config.OPENAI_BASEURL,
  apiKey: config.OPENAI_API_KEY,
});

function ensureDirectories(dirs) {
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

async function generateAudio(text, filename) {
  try {
    const aiffPath = path.join(__dirname, '../audio', filename.replace('.mp3', '.aiff'));
    await new Promise((resolve, reject) => {
      exec(`say -o "${aiffPath}" "${text}"`, (error) => {
        if (error) return reject(`Error generating AIFF file for "${text}": ${error.message}`);
        resolve(undefined);
      });
    });

    const mp3Path = path.join(__dirname, '../audio', filename);
    await new Promise((resolve, reject) => {
      exec(`lame "${aiffPath}" "${mp3Path}"`, (error) => {
        if (error) return reject(`Error converting AIFF to MP3 for "${text}": ${error.message}`);
        resolve(undefined);
      });
    });

    fs.unlinkSync(aiffPath);
    return `${filename}`;
  } catch (error) {
    console.error(`Error generating audio for "${text}":`, error.message);
    return null;
  }
}

function getFileExtensionFromUrl(url) {
  const fileName = url.split('/').pop(); // 获取 URL 的最后一部分
  const fileExtension = fileName.split('.').pop().split('?')[0]; // 去掉查询参数
  return fileExtension;
}

async function downloadFile(url, word) {
  try {
    // 从 URL 中解析文件扩展名
    const fileExtension = getFileExtensionFromUrl(url);
    if (!fileExtension) {
      throw new Error('无法从 URL 中解析文件扩展名');
    }

    // 生成文件路径
    const filePath = path.join(__dirname, '../images', `${word}.${fileExtension}`);

    // 确保输出目录存在
    const outputDir = path.dirname(filePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 下载文件
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    // 保存文件
    fs.writeFileSync(filePath, response.data);

    console.log(`文件已保存到: ${filePath}`);
    return `${word}.${fileExtension}`;
  } catch (error) {
    console.error(`下载文件失败: ${error.message}`);
    return null;
  }
}

async function queryImage(taskId,word){
  const url = config.FLUX_API_QUERYURL + taskId;
  const headers = {
    Authorization: `Bearer ${config.FLUX_API_KEY}`,
  };
  try {
    const response = await axios.get(url, { headers });
    console.log("Image query request successful:", word, response.data?.output);
    if( !response.data.output?.results?.length || response.data.output?.results?.length < 1 )
      return response.data.output.task_status === 'FAILED' ? '' : undefined;
    return downloadFile(response.data.output?.results[0].url,word);
  } catch (error) {
    console.error(
      "Error generating image:",word,
      error.response ? error.response.data : error.message
    );
    throw error;
  }
}
async function generateImage(prompt) {
    const url = config.FLUX_API_GENURL;
    const headers = {
      "X-DashScope-Async": "enable",
      Authorization: `Bearer ${config.FLUX_API_KEY}`,
      "Content-Type": "application/json",
    };

    const data = {
      model: config.FLUX_API_MODEL,
      input: {
        prompt: prompt,
      },
    };

    try {
      const response = await axios.post(url, data, { headers });
      console.log("Image generation request successful:", response.data?.output);
      return response.data;
    } catch (error) {
      console.error(
        "Error generating image:",
        error.response ? error.response.data : error.message
      );
      throw error;
    }
}
    
async function genNoteDataFromAI(inputString){
  const completion = await openai.chat.completions.create({
    model: config.OPENAI_MODEL,
    messages: [
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
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  return JSON.parse(completion.choices[0].message.content);
}

let _waitRetryCount = 0;
async function generateWordData(inputString, unit) {
  let wordData;
  let filePath;

  if (inputString.endsWith('.json')) {
    try{
      filePath = path.join(__dirname,`../${config.JSON_DIR}`, inputString);
      if ( !fs.existsSync(filePath))
        return undefined;

      wordData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if( wordData ){
        if ( !wordData?.image_prompt?.example_image || wordData.image ){
          return wordData;
        }
      }
    }
    catch(err){
      console.error('load cache file failed',filePath,err);
      return undefined;
    }
  }
  else{
    wordData = await genNoteDataFromAI(inputString);
    wordData.unit = unit;
    wordData.audio = await generateAudio(
      wordData.word,
      `${wordData.word}.mp3`
    );
    wordData.audio_example = await generateAudio(
      wordData.example_en,
      `${wordData.word}_example.mp3`
    );
    filePath = path.join(__dirname,`../${config.JSON_DIR}`, `${wordData.word}.json`);
  }

  let saveImage = async () => {
    const imageFile = await queryImage(wordData.image_taskid,wordData.word);
    if( imageFile !== undefined){
      wordData.image_taskid = undefined;
      if( imageFile !== '')
        wordData.image = imageFile;
    }
  }
  if( wordData.image_taskid ){
    await saveImage();
    _waitRetryCount ++;
  }
  else if( wordData?.image_prompt?.example_image ){
    let ack = await generateImage(wordData?.image_prompt?.example_image);
    wordData.image_taskid = ack.output.task_id;
    await new Promise(resolve => setTimeout(resolve, 5 *1000));
    await saveImage();
    _waitRetryCount ++;
  }
  // @ts-ignore
  fs.writeFileSync(filePath, JSON.stringify(wordData, null, 2));

  return wordData;
}

/**
 * 
 * @param {string[]} wordList - word list or json file list
 * @returns 
 */
async function processWordList(wordList) {
  let currentUnit = 1;
  const wordDataList = [];
  _waitRetryCount = 0;

  for (const line of wordList) {
    if (line.startsWith("Unit")) {
      currentUnit = parseInt(line.split(" ")[1], 10);
      continue;
    }
    console.log(`Processing word: ${line.trim()}`);
    try {
      const wordData = await generateWordData(line.trim(), currentUnit);
      wordDataList.push(wordData);
      console.log(`Completed processing: ${line.trim()}`);
    } catch (error) {
      console.error(`Error processing word ${line.trim()}:`, error.message);
      fs.appendFileSync('errorlist.txt', `Error processing word ${line.trim()}: ${error.message}\n`);
    }
  }

  if( _waitRetryCount > 0){
    console.log(`===== NEED TO WAIT FOR DOWNLOAD IMAGE COUNT: ${_waitRetryCount} =====`);
  }

  return wordDataList;
}

/**
 * 
 * @param {string|undefined} filename - if set filename, will load word list from file,
 *                                      else load word json file list from output dirs 
 * @returns 
 */
async function genFromWordList(filename)
{
  let wordList;
  if( filename) {
    const wordListText = fs.readFileSync(filename, 'utf-8');
    wordList = wordListText.split('\n').filter(line => line.trim());
  }
  else{
    const jsonDir = path.join(__dirname, `../${config.JSON_DIR}`);
    const files = fs.readdirSync(jsonDir);
    const jsonFiles = files.filter((file) => path.extname(file) === ".json");
    wordList = jsonFiles;
  }

  return processWordList(wordList);
}

module.exports = { ensureDirectories,genFromWordList };