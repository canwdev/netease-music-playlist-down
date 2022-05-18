/**
 批量下载NeteaseCloudMusic歌单中的音乐
 */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
const axios = require('axios')
const fs = require('fs')
const Path = require('path')

const {
  createDownloadDir,
  getSongBufferWithTags,
  padZero,
  formatArtist,
  inquireInputString,
  parseNcmPlaylistId,
  initCustomerConfig,
  sanitize,
  writeTextSync,
} = require('./utils/index')

let {
  isDebug,
  downloadDir,
  downloadCustomerConfigPath,
  apiBaseUrl,
  playlistID,
  isNumbering,
  metaFileName,
} = require('./config')
const path = require('path')

async function batchDownload(tracks, config = {}) {
  const {
    distDir
  } = config
  // 开始批量下载
  console.log(`🪂 开始下载歌单，共 ${tracks.length} 首歌曲\n`)
  const succeed = []
  const errored = []

  for (let i = 0; i < tracks.length; i++) {
    const index = padZero((i + 1), (tracks.length).toString().length)
    const statusText = `[${index}/${tracks.length}] `

    const song = tracks[i]
    song._index = index
    const {name, id, ar} = song
    const saveName = formatArtist(ar, ', ') + ' - ' + name + '.mp3'
    const number = isNumbering ? `${index}. ` : ''
    const songSavePath = Path.join(distDir, sanitize(`${number}${saveName}`, {replacement: '_'}))
    const songErroredPath = songSavePath + '.errored.json'

    try {
      if (fs.existsSync(songSavePath)) {
        if (fs.existsSync(songErroredPath)) {
          fs.unlinkSync(songErroredPath)
        }
        isDebug && console.log(`${statusText}已存在同名文件，跳过（${songSavePath}）`)
      } else {

        // 获取下载地址
        console.log(`\n🛸 ${statusText}正在获取歌曲《${name}》信息，id=${id}`)
        const downInfo = await getSongDownloadInfo(song.id)

        // 下载
        console.log('🚀 开始下载', downInfo.url)

        const {songArrayBuffer: buffer} = await getSongBufferWithTags({
          downloadUrl: downInfo.url,
          id,
          name,
          ar
        })
        fs.writeFileSync(songSavePath, Buffer.from(buffer))
        console.log('✅ 已下载', songSavePath)
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
  console.log(`\n\n🆗 执行结束！有 ${succeed.length} 个音乐下载成功。`)

  if (errored.length > 0) {
    console.log(`\n\n⚠ 其中，${errored.length} 个音乐下载失败：`)
    errored.forEach(song => {
      const {_index, name, id} = song
      console.log(`${_index}.《${name}》, id=${id}`)
    })
  }
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
    console.error('[getSongDownloadInfo] Error!' + err.message)
  }
}

async function run() {
  console.log('欢迎使用NeteaseCloudMusic下载脚本！')
  const customerConfig = initCustomerConfig(downloadCustomerConfigPath)

  const urlOrId = await inquireInputString('请输入歌单链接或id（歌单->分享->复制链接）', customerConfig.playlistID || playlistID)
  const playlistIDNumber = parseNcmPlaylistId(urlOrId)
  if (!playlistIDNumber) {
    console.log('Exit')
    return
  }

  try {
    const {data: playListData} = await axios.get(`${apiBaseUrl}/playlist/detail?id=${playlistIDNumber}`)

    // 歌单名称
    const {name: playlistName, tracks} = playListData.playlist
    console.log(`✅ 歌单获取成功！《${playlistName}》\n`)

    // 创建下载文件夹和meta
    const distDir = createDownloadDir({
      distDirBase: downloadDir,
      playlistName: `${playlistName}__${playlistIDNumber}`,
    })

    // 保存 meta 信息
    writeTextSync(path.join(distDir, metaFileName), JSON.stringify(playListData))
    // 保存自定义设置
    writeTextSync(downloadCustomerConfigPath, JSON.stringify({
      ...customerConfig,
      playlistID: playlistIDNumber
    }))

    await batchDownload(tracks, {distDir})

  } catch (e) {
    console.error('获取歌单失败！', e.message)
  }

}


run()
