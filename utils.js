const axios = require('axios')
const path = require('path')
const fs = require('fs')
const ID3Writer = require('browser-id3-writer');
var sanitize = require("sanitize-filename");

const {
  apiBaseUrl
} = require('./config')

/**
 * 创建下载文件夹和meta
 * @param playlistName 歌单名称
 * @param data 歌单列表数据
 */
function createDownloadDir(playlistName, data) {
  // 创建下载目录
  const distDir = path.join(__dirname, 'dist', sanitize(playlistName))
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 保存 meta 信息
  fs.writeFileSync(path.join(distDir, 'index.json'), JSON.stringify(data), {
    encoding: 'utf8'
  })

  return distDir
}

/**
 * 下载音乐为Buffer，填充ID3标签
 */
async function getSongBufferWithTags(url, {id, name, ar}) {
  const artists = ar

  try {
    const musicDetail = await axios.get(apiBaseUrl + '/song/detail?ids=' + id)
    const detail = musicDetail.data.songs[0]
    // console.log(detail)

    const musicRes = await axios.get(url, {
      responseType: 'arraybuffer'
    })
    const arrayBuffer = musicRes.data

    const writer = new ID3Writer(arrayBuffer);
    writer.setFrame('TIT2', detail.name)  // song title
      .setFrame('TPE1', formatArtist(artists, ';').split(';')) // song artists
      .setFrame('TALB', detail.al.name) // album title
      .setFrame('TYER', new Date(detail.publishTime).getFullYear()) // album release year
      .setFrame('TRCK', detail.no)   // song number in album
      .setFrame('TPOS', detail.cd)   // album disc number
      .setFrame('TCON', [])   // song genres

    if (detail.al.picUrl) {
      // 获取封面图
      const coverRes = await axios.get(detail.al.picUrl, {
        responseType: 'arraybuffer'
      })
      const coverArrayBuffer = coverRes.data
      writer.setFrame('APIC', {
        type: 3,
        data: coverArrayBuffer,
        description: ''
      })  // attached picture
    }

    writer.addTag();

    const buffer = writer.arrayBuffer;
    // const blob = writer.getBlob();
    // const newUrl = writer.getURL();

    return buffer

  } catch (err) {
    console.error('[getSongBufferWithTags] Error!', err.message)
  }
}

function padZero(num, len = 2) {
  return num.toString().padStart(len, '0')
}

function formatArtist(arr, separator = ' / ') {
  var nameArr = []
  arr.forEach(v => {
    nameArr.push(v.name)
  })

  return nameArr.join(separator)
}

module.exports = {
  createDownloadDir,
  getSongBufferWithTags,
  padZero,
  formatArtist
}
