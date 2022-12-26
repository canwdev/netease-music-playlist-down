/**
 批量下载NeteaseCloudMusic歌单中的音乐
 */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
const Fs = require('fs')
const Path = require('path')
const service = require('./utils/service')

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
const {savePlaylistMeta} = require('./utils/meta')

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
      if (Fs.existsSync(songSavePath)) {
        if (Fs.existsSync(songErroredPath)) {
          Fs.unlinkSync(songErroredPath)
        }
        isDebug && console.log(`${statusText}已存在同名文件，跳过（${songSavePath}）`)
      } else {

        // 获取下载地址
        console.log(`\n🛸 ${statusText}正在获取歌曲《${name}》，id=${id}`)
        const downInfo = await getSongDownloadInfo(song.id)

        // 下载
        console.log('🚀 开始下载', downInfo.url)

        const {songArrayBuffer: buffer} = await getSongBufferWithTags({
          downloadUrl: downInfo.url,
          id,
          name,
          ar
        })
        Fs.writeFileSync(songSavePath, Buffer.from(buffer))
        console.log('✅ 已下载', songSavePath)
      }
      succeed.push(song)

    } catch (e) {
      console.log(`${statusText}Error!`, e)
      // 下载出错时，保存信息以便查看
      Fs.writeFileSync(songErroredPath, JSON.stringify(song), {encoding: 'utf8'})
      errored.push(song)
    }
    // break
  }
  console.log(`\n\n🆗 执行结束！${succeed.length} 个音乐下载成功。`)

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
    const available = await service.get('/check/music?id=' + id)
    const requestLinkUrl = '/song/url?br=320000&id=' + id // 最高320kbps MP3

    const musicUrlData = await service.get(requestLinkUrl)

    const musicUrl = musicUrlData.data[0]
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
    // const {
    //   playListData,
    //   songDetailListData,
    // } = await getPlaylistData(playlistIDNumber, {
    //   metaDataPath,
    // })

    // 说明 : 歌单能看到歌单名字, 但看不到具体歌单内容 , 调用此接口 , 传入歌单 id, 可 以获取对应歌单内的所有的音乐(未登录状态只能获取不完整的歌单,登录后是完整的)，但是返回的 trackIds 是完整的，tracks 则是不完整的
    const playListData = await service.get(`/playlist/detail?id=${playlistIDNumber}`)

    // 歌单名称
    const {name: playlistName} = playListData.playlist
    console.log(`✅ 歌单获取成功！《${playlistName}》\n`)

    // 说明 : 由于网易云接口限制，歌单详情只会提供 10 首歌，通过调用此接口，传入对应的歌单id，即可获得对应的所有歌曲
    const {songs} = await service.get(`/playlist/track/all?id=${playlistIDNumber}`)

    // 创建下载文件夹和meta
    const distDir = createDownloadDir({
      distDirBase: downloadDir,
      playlistName: `${playlistName}__${playlistIDNumber}`,
    })

    // 保存 meta 信息
    await savePlaylistMeta({
      playListData,
      songs,
    }, {
      arrangeDistDir: path.join(distDir),
      metaFileName,
    })

    // 保存自定义设置
    customerConfig.playlistID = playlistIDNumber
    writeTextSync(downloadCustomerConfigPath, JSON.stringify(customerConfig))


    await batchDownload(songs, {distDir})

  } catch (e) {
    console.error('获取歌单失败！', e.message)
  }

}


run()
