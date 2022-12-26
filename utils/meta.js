const Fs = require('fs')
const Path = require('path')
const {
  writeTextSync
} = require('./index')
const axios = require('axios')
const service = require('./service')

async function getPlaylistData(playlistIDNumber, config = {}) {
  const {
    basePath,
    isGetDetail = false,
    metaFileName = 'meta.json'
  } = config
  if (!Fs.existsSync(basePath)) {
    Fs.mkdirSync(basePath, {recursive: true})
  }
  let metaBasePath = Path.join(basePath, playlistIDNumber.toString())

  // 查找设置输出目录（如果存在）
  const folders = Fs.readdirSync(basePath)
  const folder = folders.find(item => item.includes(playlistIDNumber))
  if (folder) {
    metaBasePath = Path.join(basePath, folder)
    console.log('使用已存在输出目录，目录名：', folder)
  }

  const metaFilePath = Path.join(metaBasePath, metaFileName)

  const retObj = {
    metaBasePath,
    metaFilePath,
  }

  // 如果已保存元数据，则不请求接口
  if (Fs.existsSync(metaFilePath)) {
    const data = require(metaFilePath)
    console.log('✅ 从本地读取歌单成功！')
    return {
      ...retObj,
      ...data,
    }
  }

  console.log('🛸 获取歌单...')
  const playListData = await service.get(`/playlist/detail?id=${playlistIDNumber}`)
  const {name: playlistName, trackIds} = playListData.playlist

  console.log(`✅ 歌单获取成功！《${playlistName}》\n`)

  retObj.playListData = playListData

  if (isGetDetail) {
    console.log('🛸 获取歌曲列表详情...')
    const songDetailListData = await service.get(`/song/detail?ids=${trackIds.map(item => item.id).join(',')}`)
    console.log('✅ 获取歌曲列表详情成功！')

    retObj.songDetailListData = songDetailListData
  }

  return retObj
}

async function savePlaylistMeta(data = {}, config = {}) {
  const {
    playListData = {},
    songs = [],
  } = data
  const {
    arrangeDistDir,
    metaFileName,
  } = config

  // 保存 meta 信息
  const metaDataPath = Path.join(arrangeDistDir, metaFileName)
  if (Fs.existsSync(metaDataPath)) {
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
      Fs.writeFileSync(coverPath, Buffer.from(data))
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
    coverText = `<img src="./${coverName}" alt="歌单封面" height="256"/>`
  }

  const {creator} = playlist
  let infoText = [
    `- 歌单名称：${playlist.name}`,
    `- 歌单ID：[${playlist.id}](https://music.163.com/#/playlist?id=${playlist.id})`,
    `- 创建者：[${creator.nickname}](https://music.163.com/#/user/home?id=${creator.userId})`,
    `- 标签：${(playlist.tags || []).join('，')}`,
    `- 数量：${playlist.trackCount}`
  ].join('\n')

  const songListText = songs.reduce((prev, item, currentIndex) => {
    const singers = (item.ar || []).map(v => v.name).join(',')
    return prev + `${currentIndex + 1}. [${singers} - ${item.name}](https://music.163.com/#/song?id=${item.id})\n`
  }, '')

  const readmeContents = [
    `# ${playlist.name}`,
    coverText,
    infoText,
    `## 歌单描述`,
    playlist.description,
    `## 歌曲列表`,
    songListText,
    ''
  ].join('\n\n')

  writeTextSync(readmePath, readmeContents)
  console.log('✅ 保存 README 成功！', readmePath)
}

module.exports = {
  getPlaylistData,
  savePlaylistMeta,
}
