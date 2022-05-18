const axios = require('axios')
const Path = require('path')
const fs = require('fs')
const ID3Writer = require('browser-id3-writer');
const inquirer = require("inquirer")
const {
  apiBaseUrl
} = require('../config')
const sanitizeFilename = require('sanitize-filename')

const sanitize = (input) => sanitizeFilename(input, {replacement: '_'})

/**
 * 创建下载文件夹
 * @param distDirName 下载目录名称
 * @param playlistName 歌单名称
 */
function createDownloadDir({distDirBase = __dirname, playlistName}) {
  // 创建下载目录
  const distDir = Path.join(distDirBase, sanitize(playlistName))
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, {recursive: true});
  }
  return distDir
}

/**
 * 下载音乐为Buffer，填充ID3标签
 */
async function getSongBufferWithTags({downloadUrl, lrcUrl, writeTag = true, id, name, ar}) {
  const artists = ar

  try {
    const musicDetail = await axios.get(apiBaseUrl + '/song/detail?ids=' + id)
    const detail = musicDetail.data.songs[0]
    // console.log(detail)

    const musicRes = await axios.get(downloadUrl, {
      responseType: 'arraybuffer'
    })
    let arrayBuffer = musicRes.data

    let coverArrayBuffer
    if (detail.al.picUrl) {
      // 获取封面图
      const coverRes = await axios.get(detail.al.picUrl, {
        responseType: 'arraybuffer'
      })
      coverArrayBuffer = coverRes.data
    }

    if (writeTag) {
      // 写入 ID3 标签
      const writer = new ID3Writer(arrayBuffer);
      writer.setFrame('TIT2', detail.name)  // song title
        .setFrame('TPE1', formatArtist(artists, ';').split(';')) // song artists
        .setFrame('TALB', detail.al.name) // album title
        .setFrame('TYER', new Date(detail.publishTime).getFullYear()) // album release year
        .setFrame('TRCK', detail.no)   // song number in album
        .setFrame('TPOS', detail.cd)   // album disc number
        .setFrame('TCON', [])   // song genres

      if (coverArrayBuffer) {
        writer.setFrame('APIC', {
          type: 3,
          data: coverArrayBuffer,
          description: ''
        })  // attached picture
      }

      writer.addTag();
      // const blob = writer.getBlob();
      // const newUrl = writer.getURL();
      arrayBuffer = writer.arrayBuffer;
    } else {
      // FLAC 格式不支持 ID3 标签
    }

    let lrcText
    if (lrcUrl) {
      const res = await axios.get(lrcUrl)
      lrcText = res.data

      if (lrcText.indexOf('暂无歌词') !== -1) {
        lrcText = undefined
      }
    }

    return {
      songArrayBuffer: arrayBuffer,
      coverArrayBuffer,
      detail,
      lrcText
    }
  } catch (err) {
    console.error('[getSongBufferWithTags] Error!', err.message)
  }
}

function padZero(num, len = 2) {
  return num.toString().padStart(len, '0')
}

function formatArtist(artists, separator = ' / ') {
  if (typeof artists === 'string') {
    return artists
  }
  var nameArr = []
  artists.forEach(v => {
    nameArr.push(v.name)
  })

  return nameArr.join(separator)
}

/**
 * 替换文件后缀名
 * @param oPath "Wisp X - Shatter.flac"
 * @param extension "lrc"
 * return "Wisp X - Shatter.lrc"
 */
function replaceFileExtension(oPath, extension) {
  oPath = oPath.substring(0, oPath.lastIndexOf('.') + 1)
  return oPath + extension
}


/**
 * 选择配置文件
 * @param message
 * @param baseDir
 * @returns {Promise<string>}
 */
async function inquireConfigFile(message = '选择一个配置文件', baseDir) {
  const files = fs.readdirSync(baseDir, {withFileTypes: true}).filter(dirent => dirent.isFile())
    .map(dirent => dirent.name)

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'configFile',
      message,
      choices: files,
    }
  ])

  return Path.join(baseDir, answers.configFile)
}

/**
 * 询问是否
 * @param message
 * @param defaultResult
 * @returns {Promise<*>}
 */
async function inquireYesOrNo(message = "确定？", defaultResult = true) {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'yesOrNo',
      message: message,
      default: defaultResult
    }
  ])
  return answers.yesOrNo
}

async function inquireInputString(message = '请输入：', defaultResult = '') {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'string',
      message: message,
      default: defaultResult
    }
  ])
  return answers.string
}

/**
 * 获取url query 对象
 * @param url
 */
function parseUrlQuery(url) {
  if (typeof url !== "string") return;
  var obj = {};
  url.split("?")[1].split("&").forEach(item => {
    var arr = [key, value] = item.split("=")
    obj[arr[0]] = arr[1];
  })
  return obj
}

function parseNcmPlaylistId(urlOrId) {
  if (!urlOrId) {
    return
  }
  var id = Number(urlOrId)

  if (!Number.isNaN(id)) {
    return id
  }

  var obj = parseUrlQuery(urlOrId)

  return obj.id
}

function doSleep(time = 300) {
  console.log('休息一下~ ', time)
  return new Promise(resolve => {
    setTimeout(resolve, time)
  })
}

function writeTextSync(pth, str) {
  return fs.writeFileSync(pth, str, {
    encoding: 'utf8'
  })
}


function initCustomerConfig(savePath) {
  const downloadDir = Path.dirname(savePath)
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, {recursive: true});
  }
  let customerConfig = {
    playlistID: null
  }
  if (!fs.existsSync(savePath)) {
    fs.writeFileSync(savePath, JSON.stringify(customerConfig), {encoding: 'utf8'})
  } else {
    customerConfig = require(savePath)
  }
  // console.log({customerConfig})
  return customerConfig
}

module.exports = {
  sanitize,
  createDownloadDir,
  getSongBufferWithTags,
  padZero,
  formatArtist,
  replaceFileExtension,
  inquireConfigFile,
  inquireYesOrNo,
  inquireInputString,
  parseUrlQuery,
  parseNcmPlaylistId,
  doSleep,
  writeTextSync,
  initCustomerConfig
}
