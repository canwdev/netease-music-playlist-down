const fs = require('fs')
const Path = require('path')
const {
  writeTextSync
} = require('./index')
const axios = require('axios')
const {apiBaseUrl} = require('../config')

async function getPlaylistData(playlistIDNumber, config = {}) {
  const {
    arrangeDistDir,
    metaFileName,
  } = config
  const metaDataPath = Path.join(arrangeDistDir, metaFileName)

  // 如果已保存元数据，则不请求接口
  if (fs.existsSync(metaDataPath)) {
    const data = require(metaDataPath)
    const {songDetailListData: {songs: tracks}} = data

    console.log('✅ 从本地读取歌单成功！')
    return {
      tracks,
      data
    }
  }

  const requestUrl = `${apiBaseUrl}/playlist/detail?id=${playlistIDNumber}`
  console.log('🛸 获取歌单详情...', requestUrl)
  const {data: playListData} = await axios.get(requestUrl)
  const {playlist} = playListData || {}
  const {trackIds} = playlist || {}
  console.log('✅ 获取歌单详情成功！')

  console.log('🛸 获取歌曲列表...')
  const {data: songDetailListData} = await axios.get(`${apiBaseUrl}/song/detail?ids=${trackIds.map(item => item.id).join(',')}`)
  const {songs: tracks} = songDetailListData
  console.log('✅ 获取歌曲列表成功！')

  return {
    playListData,
    songDetailListData,
    tracks,
  }

}

async function savePlaylistMeta(data = {}, config = {}) {
  const {
    playListData = {},
    songDetailListData = {},
    tracks = []
  } = data
  const {
    arrangeDistDir,
    metaFileName,
  } = config

  // 保存 meta 信息
  const metaDataPath = Path.join(arrangeDistDir, metaFileName)
  if (fs.existsSync(metaDataPath)) {
    console.log('meta 数据已存在，跳过保存！')
    return
  }

  const {playlist = {}} = playListData

  // ncm 原始数据
  writeTextSync(metaDataPath, JSON.stringify(data))

  let hasCover = false
  const coverName = 'Cover.jpg'
  try {
    // 封面
    const coverUrl = playlist.coverImgUrl
    if (coverUrl) {
      console.log('下载封面图...', coverUrl)
      const coverPath = Path.join(arrangeDistDir, coverName)
      const {data} = await axios.get(coverUrl, {
        responseType: 'arraybuffer'
      })
      fs.writeFileSync(coverPath, Buffer.from(data))
    }
    hasCover = true
    console.log('✅ 下载封面图成功！')
  } catch (e) {
    console.error('获取封面失败', e)
  }

  // README File
  const readmePath = Path.join(arrangeDistDir, 'README.md')
  let coverText = ``
  if (hasCover) {
    coverText = `<img src="./${coverName}" height="256"/>\n\n`
  }
  const {creator} = playlist
  const infoText = `歌单id：[${playlist.id}](https://music.163.com/#/playlist?id=${playlist.id})\n创建者：[${creator.nickname}](https://music.163.com/#/user/home?id=${creator.userId})\n标签：「${(playlist.tags || []).join('、')}」\n数量：${playlist.trackCount}\n`

  const songListText = tracks.reduce((prev, item) => {
    const singers = (item.ar || []).map(v => v.name).join(',')
    return prev + `1. [${singers} - ${item.name}](https://music.163.com/#/song?id=${item.id})\n`
  }, '')

  const readmeContents = `# ${playlist.name}\n\n${coverText}${infoText}## 简介\n${playlist.description}\n\n## 播放列表\n${songListText}\n`
  writeTextSync(readmePath, readmeContents)
}

module.exports = {
  getPlaylistData,
  savePlaylistMeta,
}
