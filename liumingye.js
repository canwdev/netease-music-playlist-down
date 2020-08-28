/**
 * 从 liumingye 大佬的接口下载歌单：http://tool.liumingye.cn/music/
 * 配合插件使用更佳：https://greasyfork.org/zh-CN/scripts/400423-qq%E7%BD%91%E6%98%93%E4%BA%91%E9%9F%B3%E4%B9%90%E4%BB%98%E8%B4%B9%E6%97%A0%E6%8D%9F%E9%9F%B3%E4%B9%90%E5%85%8D%E8%B4%B9%E4%B8%8B%E8%BD%BD
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
  replaceFileExtension,
  inquireConfigFile,
  inquireYesOrNo,
  inquireInputString,
  parseNcmPlaylistId,
  doSleep
} = require("./utils")

let {
  apiBaseUrl,
  playlistID,
  numbering,
} = require('./config')

async function run() {
  console.log('欢迎使用 liumingye-api 下载脚本！')

  const urlOrId = await inquireInputString('请输入网易云音乐歌单链接或id', playlistID)
  if (!urlOrId) {
    console.log('退出')
    return
  }
  playlistID = parseNcmPlaylistId(urlOrId)


  const configFilePath = await inquireConfigFile(
    '请选择一个 data 文件，可以从 http://tool.liumingye.cn/music/ F12控制台网络面板复制',
    path.join(__dirname, './liumingye-config')
  )

  const data = require(configFilePath)
  const tryFlac = await inquireYesOrNo('要尝试下载 FLAC 吗？注意：可能无法分辨 MP3 格式！')


  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

  let playlistData, playlistName, tracks
  try {
    const res = await axios.get(`${apiBaseUrl}/playlist/detail?id=${playlistID}`)
    playlistData = res.data
    playlistName = playlistData.playlist.name
    tracks = playlistData.playlist.tracks
    console.log(`歌单获取成功！《${playlistName}》`)
  } catch (e) {
    console.error('获取歌单信息失败！', e.message)
    return
  }

  const distDir = createDownloadDir({
    distDirName: 'dist/@liuminye',
    playlistName: playlistID + '_' + playlistName || 'undefined_' + Date.now(),
    data
  })
  fs.writeFileSync(path.join(distDir, 'playlist.json'), JSON.stringify(playlistData), {
    encoding: 'utf8'
  })

  const playlist = data.data.list

  // 开始批量下载
  console.log(`开始下载歌单，共 ${playlist.length} 首歌曲`)
  const succeed = []
  const errored = []

  for (let i = 0; i < playlist.length; i++) {
    const index = padZero((i + 1), (playlist.length).toString().length)
    const statusText = `[${index}/${playlist.length}] `
    const song = playlist[i]
    song._index = index

    // 旧版接口获取id
    // const id = song.lrc.substring(song.lrc.lastIndexOf('/') + 1)
    // 新版获取id
    const id = tracks[i].id
    song.id = id
    const {name, artist: ar} = song

    // 获取下载地址

    const {extension, downloadUrl, lrcUrl} = extractDownloadInfo(song, tryFlac)

    const saveName = formatArtist(ar, ', ') + ' - ' + name + '.' + extension
    const number = numbering ? `${index}. ` : ''
    const songSavePath = path.join(distDir, sanitize(`${number}${saveName}`, {replacement: '_'}))
    const songErroredPath = songSavePath + '.errored.json'

    try {
      if (fs.existsSync(songSavePath)) {
        if (fs.existsSync(songErroredPath)) fs.unlinkSync(songErroredPath)
        // console.log(`${statusText}已存在同名文件，跳过（${songSavePath}）`)
      } else {

        // 下载
        console.log(`${statusText}歌曲《${name}》，id=${id}`)
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
        if (fs.existsSync(songErroredPath)) fs.unlinkSync(songErroredPath)

        // 保存封面
        tryFlac && fs.writeFileSync(replaceFileExtension(songSavePath, 'jpg'), Buffer.from(coverArrayBuffer))

        // 保存信息
        tryFlac && fs.writeFileSync(replaceFileExtension(songSavePath, 'json'), JSON.stringify(detail, null, 2))

        // 保存歌词
        lrcText && fs.writeFileSync(replaceFileExtension(songSavePath, 'lrc'), lrcText)

        console.log('已下载', songSavePath)
        await doSleep()
      }
      succeed.push(song)

    } catch (e) {
      console.log(`${statusText}Error!`, e.message)
      // 下载出错时，保存信息以便查看
      fs.writeFileSync(songErroredPath, JSON.stringify(song), {encoding: 'utf8'})
       errored.push(song)
      debugger
    }
  }

  console.log(`执行结束！有 ${succeed.length} 个音乐下载成功。`)

  if (errored.length > 0) {
    console.log(`${errored.length} 个音乐下载失败：`)
    errored.forEach(song => {
      const {_index, name, id} = song
      console.log(`${_index}.《${name}》, id=${id}`)
    })
  }
}

run()

function extractDownloadInfo(song, tryFlac) {
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
