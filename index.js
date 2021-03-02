/**

- 批量下载163Music歌单中的音乐，并按照顺序排序文件
- 基于 Node.js 和 [NeteaseCloudMusicApi](https://binaryify.github.io/NeteaseCloudMusicApi)
- 只要在163Music可以直接播放的歌曲，就可以下载（码率较低）
- **版权限制的音乐无法下载**

## 歌单下载

0. 安装 Node.js
1. 打开 [index.js](./index.js)，修改参数：
    - `apiBaseUrl`：你自己搭建的 NeteaseCloudMusicApi 服务地址。
    - `playlistID`：歌单id，可以从163Music分享链接中获取，如 `https://music.163.com/#/playlist?id=385283496`，id 为 `385283496`。
2. `npm install` 安装依赖。
3. `npm start` 开始下载。

*/

const axios = require('axios')
const fs = require('fs')
const path = require('path')
var sanitize = require("sanitize-filename");

const {
  createDownloadDir,
  getSongBufferWithTags,
  padZero,
  formatArtist,
  inquireInputString,
  parseNcmPlaylistId,
} = require('./utils')

let {
  apiBaseUrl,
  playlistID,
  numbering,
} = require('./config')

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

async function run() {
  console.log('欢迎使用163Music下载脚本！')

  const urlOrId = await inquireInputString('请输入163Music歌单链接或id', playlistID)
  if (!urlOrId) {
    console.log('退出')
    return
  }
  playlistID = parseNcmPlaylistId(urlOrId)

  axios.get(`${apiBaseUrl}/playlist/detail?id=${playlistID}`).then(async res => {
    const data = res.data

    // 歌单名称
    const playlistName = data.playlist.name
    const playlist = data.playlist.tracks
    console.log(`歌单获取成功！《${playlistName}》`)

    // 创建下载文件夹和meta
    const distDir = createDownloadDir({
      playlistName: playlistID + '_' + playlistName,
      data
    })

    // 开始批量下载
    console.log(`开始下载歌单，共 ${playlist.length} 首歌曲`)
    const succeed = []
    const errored = []

    for (let i = 0; i < playlist.length; i++) {
      const index = padZero((i + 1), (playlist.length).toString().length)
      const statusText = `[${index}/${playlist.length}] `

      const song = playlist[i]
      song._index = index
      const {name, id, ar} = song
      const saveName = formatArtist(ar, ', ') + ' - ' + name + '.mp3'
      const number = numbering ? `${index}. ` : ''
      const songSavePath = path.join(distDir, sanitize(`${number}${saveName}`, {replacement: '_'}))
      const songErroredPath = songSavePath + '.errored.json'

      try {
        if (fs.existsSync(songSavePath)) {
          if (fs.existsSync(songErroredPath)) {
            fs.unlinkSync(songErroredPath)
          }
          // console.log(`${statusText}已存在同名文件，跳过（${songSavePath}）`)
        } else {

          // 获取下载地址
          console.log(`${statusText}正在获取歌曲《${name}》信息，id=${id}`)
          const downInfo = await getSongDownloadInfo(song.id)

          // 下载
          console.log('开始下载', downInfo.url)

          const {songArrayBuffer: buffer} = await getSongBufferWithTags({
            downloadUrl: downInfo.url,
            id,
            name,
            ar
          })
          fs.writeFileSync(songSavePath, Buffer.from(buffer))
          console.log('已下载', songSavePath)
        }
        succeed.push(song)

      } catch (e) {
        console.log(`${statusText}Error!`, e)
        // 下载出错时，保存信息以便查看
        fs.writeFileSync(songErroredPath, JSON.stringify(song), {encoding: 'utf8'})
        errored.push(song)
      }
      // break
    }
    console.log(`执行结束！有 ${succeed.length} 个音乐下载成功。`)

    if (errored.length > 0) {
      console.log(`${errored.length} 个音乐下载失败：`)
      errored.forEach(song => {
        const {_index, name, id} = song
        console.log(`${_index}.《${name}》, id=${id}`)
      })
    }

  }).catch(e => {
    console.error('获取歌单失败！', e.message)
  })
}

/**
 * 获取音乐下载信息
 * @param id
 * @returns {Promise<{url}|*>}
 */
async function getSongDownloadInfo(id) {
  try {
    const musicAvailableRes = await axios.get(apiBaseUrl + '/check/music?id=' + id)
    const requestLinkUrl = '/song/url?br=320000&id=' + id // 最高320kbps MP3

    const songUrlRes = await axios.get(apiBaseUrl + requestLinkUrl)

    const available = musicAvailableRes.data
    const musicUrl = songUrlRes.data.data[0]
    // console.log({
    //   available,
    //   musicUrl
    // })

    if (!available.success) {
      console.error(available.message)
      throw new Error(available.message)
    }
    if (!musicUrl.url) {
      console.error('版权限制')
      throw new Error('版权限制')
    }

    return musicUrl
  } catch (err) {
    console.error('[getSongDownloadInfo] Error!', err.message)
  }
}

run()
