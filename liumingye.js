/*
基于 http://tool.liumingye.cn/music/ 开发
 */
const axios = require('axios')

const path = require('path')
const fs = require('fs')
var sanitize = require("sanitize-filename");

const {
  createDownloadDir,
  padZero,
  formatArtist,
  getSongBufferWithTags,
  replaceFileExtension
} = require("./utils")

const data = require('./liumingye-music-data.json')
const tryFlac = true // 尝试下载 FLAC，注意：可能无法分辨 MP3 格式！
const {
  apiBaseUrl,
  playlistID,
  numbering,
} = require('./config')

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

async function run() {
  let playlistName
  try {
    const res = await axios.get(`${apiBaseUrl}/playlist/detail?id=${playlistID}`)
    playlistName = res.data.playlist.name
  } catch (e) {
    console.error('获取歌单信息失败！', e.message)
  }

  const distDir = createDownloadDir({
    distDirName: 'dist/@liuminye',
    playlistName: playlistName || 'undefined_' + Date.now(),
    data
  })

  const playlist = data.data.list

  for (let i = 0; i < playlist.length; i++) {
    const index = padZero((i + 1), (playlist.length).toString().length)
    const statusText = `[${index}/${playlist.length}] `
    const song = playlist[i]
    song._index = index

    // 获取id
    const id = song.lrc.substring(song.lrc.lastIndexOf('/') + 1)
    const {name, artist: ar} = song

    // 获取下载地址
    console.log(`${statusText}正在获取歌曲《${name}》信息，id=${id}`)
    const {extension, downloadUrl, lrcUrl} = extractDownloadInfo(song)

    const saveName = formatArtist(ar, ', ') + ' - ' + name + '.' + extension
    const number = numbering ? `${index}. ` : ''
    const songSavePath = path.join(distDir, sanitize(`${number}${saveName}`, {replacement: '_'}))

    try {
      if (fs.existsSync(songSavePath)) {
        console.log(`${statusText}已存在同名文件，跳过（${songSavePath}）`)
      } else {

        // 下载
        console.log('开始下载', downloadUrl)
        const {
          songArrayBuffer: buffer,
          coverArrayBuffer,
          detail,
          lrcText,
        } = await getSongBufferWithTags({
          downloadUrl,
          lrcUrl,
          writeTag: extension === 'mp3',
          id, name, ar
        })
        fs.writeFileSync(songSavePath, Buffer.from(buffer))

        // 保存封面
        tryFlac && fs.writeFileSync(replaceFileExtension(songSavePath, 'jpg'), Buffer.from(coverArrayBuffer))

        // 保存信息
        tryFlac && fs.writeFileSync(replaceFileExtension(songSavePath, 'json'), JSON.stringify(detail, null, 2))

        // 保存歌词
        lrcText && fs.writeFileSync(replaceFileExtension(songSavePath, 'lrc'), lrcText)


        console.log('已下载', songSavePath)
      }

    } catch (e) {
      console.log(`${statusText}Error!`, e)
      // 下载出错时，保存信息以便查看
      fs.writeFileSync(songSavePath + '.errored.json', JSON.stringify(song), {encoding: 'utf8'})

      debugger
    }
  }
}

run()

function extractDownloadInfo(song) {
  let extension = 'mp3', downloadUrl

  if (tryFlac && song.url_flac) {
    extension = 'flac'
    downloadUrl = song.url_flac
  } else if (song.url_320) {
    downloadUrl = song.url_320
  } else if (song.url_128) {
    downloadUrl = song.url_128
  } else {
    downloadUrl = song.url
  }

  return {
    extension,
    downloadUrl,
    lrcUrl: song.lrc
  }
}
