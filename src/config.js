module.exports = {
    TTS_URL: 'http://localhost:5002',
    AUDIO_DIR: './audio',
    AUDIO_PARAM: '-v Tingting',
    IMAGE_DIR: './images',
    IMAGE_GENDELAY: 5*1000,
    MEDIA_DIR: './media',

    JSON_DIR: './json',
    ANKI_COLLECTION_FILE: 'collection.anki2',
    OPENAI_MODEL: "deepseek-chat",
    OPENAI_BASEURL: 'https://api.deepseek.com',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY??'',
    FLUX_API_GENURL: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    FLUX_API_QUERYURL: 'https://dashscope.aliyuncs.com/api/v1/tasks/',
    FLUX_API_MODEL: 'flux-schnell',
    FLUX_API_KEY: process.env.FLUX_API_KEY ?? ''
  };