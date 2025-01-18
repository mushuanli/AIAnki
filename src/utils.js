// @ts-check
"use strict"

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');
const OpenAI = require('openai');
const util = require('util');

const execPromise = util.promisify(exec);

const config = require('./config');
const { dir } = require('console');


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

async function AIChat(messages){
  const completion = await openai.chat.completions.create({
    model: config.OPENAI_MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 8000
  });

  return JSON.parse(completion.choices[0].message.content);
}

async function generateAudio(text, filename) {
  try {
    const aiffPath = filename.replace(/\.[^/.]+$/, '.aiff');
    await new Promise((resolve, reject) => {
      exec(`say ${config.AUDIO_PARAM}  -o "${aiffPath}" "${text}"`, (error) => {
        if (error) return reject(`Error generating AIFF file for "${text}": ${error.message}`);
        resolve(undefined);
      });
    });

    const mp3Path = filename;
    await new Promise((resolve, reject) => {
      exec(`lame "${aiffPath}" "${mp3Path}"`, (error) => {
        if (error) return reject(`Error converting AIFF to MP3 for "${text}": ${error.message}`);
        resolve(undefined);
      });
    });

    fs.unlinkSync(aiffPath);
    return `${path.basename(filename)}`;
  } catch (error) {
    console.error(`Error generating audio for "${text}":`, error.message);
    return null;
  }
}

async function generateAudio1(text, mp3FileName) {
  try {
    const venvPath = path.join(__dirname,'../'+config.EDGE_VENV_PATH);
    // 构建命令
    const command = `source ${venvPath}/bin/activate && edge-tts --write-media ${mp3FileName} --text "${text}" `;

    // 执行命令
    const { stdout, stderr } = await execPromise(command,{ shell: '/bin/bash' });

    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return null;
    } else {
      console.log(`Stdout: ${stdout}`);
      console.log(`MP3 file created: ${mp3FileName}`);
      return `${path.basename(mp3FileName)}`;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

function getFileExtensionFromUrl(url) {
  const fileName = url.split('/').pop(); // 获取 URL 的最后一部分
  const fileExtension = fileName.split('.').pop().split('?')[0]; // 去掉查询参数
  return fileExtension;
}

async function downloadFile(url, filePath) {
  try {
    // 从 URL 中解析文件扩展名
    const fileExtension = getFileExtensionFromUrl(url);
    if (!fileExtension) {
      throw new Error('无法从 URL 中解析文件扩展名');
    }

    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
    // 拼接新的扩展名
    filePath = path.join(path.dirname(filePath), `${fileNameWithoutExt}${fileExtension}`);

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
    return `${path.basename(filePath)}`;
  } catch (error) {
    console.error(`下载文件失败: ${error.message}`);
    return null;
  }
}

async function queryImage(taskId,filePath){
  const url = config.FLUX_API_QUERYURL + taskId;
  const headers = {
    Authorization: `Bearer ${config.FLUX_API_KEY}`,
  };
  try {
    const response = await axios.get(url, { headers });
    console.log("Image query request successful:", filePath, response.data?.output);
    if( !response.data.output?.results?.length || response.data.output?.results?.length < 1 )
      return response.data.output.task_status === 'FAILED' ? '' : undefined;
    return downloadFile(response.data.output?.results[0].url,filePath);
  } catch (error) {
    console.error(
      "Error generating image:",filePath,
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
      return response.data?.output?.task_id;
    } catch (error) {
      console.error(
        "Error generating image:",
        error.response ? error.response.data : error.message
      );
      throw error;
    }
}
    
/**
 * 
 * @param {*} obj 
 * @param {{audio?: {name,file,text}[],image?:{name,file,text,tmpId}[]}} mediaList 
 * @returns {Promise<number>} - gen media num >= 0 
 */
async function genMultimedia(obj, outdir,mediaList){
  let genNum = 0;
  if( mediaList?.audio ){
    for( let item of mediaList.audio ){
      const filePath = path.join(outdir, config.AUDIO_DIR, `${item.file}`);
      if( !item.text || (obj[item.name] && fs.existsSync(filePath)) )
        continue;
      genNum ++;
      obj[item.name]  = await generateAudio(item.text,filePath);
    }
  }

  if( mediaList?.image ){
    for( let item of mediaList.image ){
      const filePath = path.join(outdir, config.IMAGE_DIR, `${item.file}`);
      if( !item.text || (obj[item.name] && fs.existsSync(filePath)) )
        continue;

      genNum++;
      if( !obj[item.tmpId]){
        obj[item.tmpId] = await generateImage(item.text);
        await new Promise(resolve => setTimeout(resolve, config.IMAGE_GENDELAY));
      }

      let fname  = await queryImage(obj[item.tmpId],filePath);
      if( fname !== undefined ){
        obj[item.tmpId] = undefined;
        if( fname !== '')
          obj[item.name]  = fname;
      }
    }
  }

  return genNum;
}

module.exports = { ensureDirectories,AIChat,genMultimedia };