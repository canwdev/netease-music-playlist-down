/**
 * 自动整理 NeteaseCloudMusic PC客户端下载的歌曲
 * 根据歌单序号自动排序
 * 下载封面，自动输出到目标文件夹
 * 从 https://github.com/Binaryify/NeteaseCloudMusicApi 获取的歌单详情json
 */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
const fs = require('fs')
const path = require('path')
const shell = require('shelljs')
const axios = require('axios')
const {
  sanitize,
  padZero,
  writeTextSync,
  parseNcmPlaylistId,
  inquireInputString,
  initCustomerConfig,
} = require('./utils')

const {
  downloadCustomerConfigPath,
  apiBaseUrl,
  playlistID
} = require('./config')

const localConfig = {
  isDebug: false,
  fromDir: 'D:\\CloudMusic', //  NeteaseCloudMusic PC客户端下载文件夹
  toDir: 'D:\\CloudMusicArranged', // 目标文件夹
  metaFileName: 'meta.json',
  arrangeDistDir: null,
  playlistIDNumber: null
}

async function initBasic() {
  console.log('欢迎使用 自动整理 NeteaseCloudMusic PC客户端下载的歌曲！')
  const customerConfig = initCustomerConfig(downloadCustomerConfigPath)
  const urlOrId = await inquireInputString('请输入歌单链接或id（歌单->分享->复制链接）', customerConfig.playlistID || playlistID)
  localConfig.playlistIDNumber = parseNcmPlaylistId(urlOrId)
  if (!localConfig.playlistIDNumber) {
    console.log('Exit')
    return
  }

  localConfig.arrangeDistDir = path.join(localConfig.toDir, localConfig.playlistIDNumber.toString())

  const toDir = localConfig.toDir
  if (!fs.existsSync(toDir)) {
    shell.mkdir('-p', toDir)
  }

  // 查找设置输出目录（如果存在）
  const folders = fs.readdirSync(toDir)
  const folder = folders.find(item => item.includes(localConfig.playlistIDNumber))
  if (folder) {
    localConfig.arrangeDistDir = path.join(localConfig.toDir, folder)
    console.log('使用已存在输出目录：', folder)
  }
}

async function getPlaylistTracks() {
  const metaDataPath = path.join(localConfig.arrangeDistDir, localConfig.metaFileName)

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

  const requestUrl = `${apiBaseUrl}/playlist/detail?id=${localConfig.playlistIDNumber}`
  console.log('🛸 获取歌单详情...', requestUrl)
  const {data: playListData} = await axios.get(requestUrl)
  const {playlist} = playListData || {}
  const {trackIds} = playlist || {}
  console.log('✅ 获取歌单详情成功！')

  // 仅当文件夹不存在时执行初始化输出目录
  if (!fs.existsSync(localConfig.arrangeDistDir)) {
    const dirName = `${sanitize(playlist.name)}__${playlist.id}`
    localConfig.arrangeDistDir = path.join(localConfig.toDir, dirName)
    shell.mkdir('-p', localConfig.arrangeDistDir)
    console.log('创建输出目录成功：', dirName)
  }


  console.log('🛸 获取歌曲列表...')
  const {data: songDetailListData} = await axios.get(`${apiBaseUrl}/song/detail?ids=${trackIds.map(item => item.id).join(',')}`)
  const {songs: tracks} = songDetailListData
  console.log('✅ 获取歌曲列表成功！')

  return {
    tracks,
    data: {
      playListData,
      songDetailListData
    }
  }

}

async function arrangeFile(tracks) {
  console.log(`源目录：${localConfig.fromDir}\n输出目录：${localConfig.arrangeDistDir}\n开始操作...`)
  const copiedFiles = {}
  const copySucceedItems = []
  const copyFailedItems = []

  shell.cd(localConfig.fromDir)
  const files = shell.ls()

  for (let i = 0; i < tracks.length; i++) {
    const num = Number(i) + 1
    let {name, ar} = tracks[i]
    let {name: artist} = ar[0]

    name = name
      .replace(/\.$/, '') // 去除最后的 `.`
      .replace(/\?/g, '？')
      .replace(/:/g, '：')
      .replace(/"/g, '＂')
      .replace(/\//g, '／')
      .replace(/\)|\(/g, matched => '\\' + matched)
      .trim()

    artist = artist.trim()


    // 简单匹配歌曲名，item 格式如 `Молчат Дома - Тоска.mp3`
    const filteredFiles = files.filter(item => {
      // 如果已移动则不选中，避免重复
      if (copiedFiles[item]) {
        return false
      }

      // 去除后缀
      item = item.slice(0, item.lastIndexOf('.'))

      try {

        // 分割歌手名与歌曲名
        let [sArtists, sName] = item.split(/ - (.+)/) // 仅拆分第一个 ` - `

        sArtists = sArtists.trim()
        sName = sName.trim()

        // 匹配失败可根据此线索查找问题
        /*if (i == 67) {
          console.log(`【${name}】`, sName, new RegExp(`${name}$`).test(sName))
          console.log(`【${artist}】`, sArtists, new RegExp(`^${artist}`).test(sArtists))
          console.log('---')
        }*/

        return (
          new RegExp(`${name}$`).test(sName) // 歌曲名匹配
          && new RegExp(`^${artist}`).test(sArtists) // 第一位歌手匹配
        )
      } catch (e) {
        localConfig.isDebug && console.log(`WARNING: ${e.message} 【${item}】`)
        return false
      }

    })

    const fromName = filteredFiles[0]
    const index = padZero((i + 1), (tracks.length).toString().length)
    const targetName = `${index}. ${fromName}`

    if (!fromName) {
      const failedName = `【i=${i}】${index}. ${ar.map(item => item.name).join(',')} - ${name}`
      console.log(`歌曲匹配失败：${failedName}`)
      copyFailedItems.push(failedName)
      debugger
    } else {
      copiedFiles[fromName] = true
      const targetPath = path.join(localConfig.arrangeDistDir, targetName)
      if (!fs.existsSync(targetPath)) {
        console.log(`移动：【${fromName}】 -> 【${targetName}】`)
        shell.mv(path.join(localConfig.fromDir, fromName), targetPath)
        copySucceedItems.push(fromName)
      } else {
        localConfig.isDebug && console.log(`跳过：【${fromName}】 -> 【${targetName}】`)
      }

    }


  }

  console.log('----------------------')
  if (copyFailedItems.length > 0) {
    console.log(`警告：有 ${copyFailedItems.length} 个匹配失败，请尝试手动移动或修改源码 :)`)
    console.log(copyFailedItems)
  } else {
    console.log(`全部歌曲移动成功！`)
  }


  // if (copySucceedItems.length > 0) {
  //   let isDelete = await inquireYesOrNo(`要删除 ${localConfig.fromDir} 里复制成功的原文件吗？（共 ${copySucceedItems.length} 个文件，删除前请退出云音乐客户端以免删除失败）`)
  //   if (isDelete) {
  //     shell.rm(Object.keys(copiedFiles))
  //
  //
  //   }
  //   if (!isDelete) {
  //     console.log('没有删除')
  //   }
  // }

  if (copyFailedItems.length > 0) {
    // 防止重复运行找不到错误的列表，将列表保存至文件
    const erroredFile = path.join(localConfig.arrangeDistDir, 'errored.json')
    writeTextSync(erroredFile, JSON.stringify(copyFailedItems, null, 2))
    console.log(`失败文件列表已保存至`, erroredFile)
  }
}

async function saveMeta(data, tracks) {
  // 保存 meta 信息
  const metaDataPath = path.join(localConfig.arrangeDistDir, localConfig.metaFileName)
  if (fs.existsSync(metaDataPath)) {
    console.log('meta 数据已存在，跳过保存！')
    return
  }

  const {playListData, songDetailListData} = data
  const {playlist} = playListData || {}

  // ncm 原始数据
  writeTextSync(metaDataPath, JSON.stringify(data))

  let hasCover = false
  const coverName = 'Cover.jpg'
  try {
    // 封面
    const coverUrl = playlist.coverImgUrl
    if (coverUrl) {
      console.log('下载封面图...', coverUrl)
      const coverPath = path.join(localConfig.arrangeDistDir, coverName)
      const {data} = await axios.get(coverUrl, {
        responseType: 'arraybuffer'
      })
      fs.writeFileSync(coverPath, Buffer.from(data))
    }
    hasCover = true
    console.log('✅ 下载成功！')
  } catch (e) {
    console.error('获取封面失败', e)
  }

  // 自述文件
  const readmePath = path.join(localConfig.arrangeDistDir, 'README.md')
  let coverText = ``
  if (hasCover) {
    coverText = `<img src="./${coverName}" height="256"/>\n\n`
  }
  const {creator} = playlist || {}
  const info = `歌单id：[${playlist.id}](https://music.163.com/#/playlist?id=${playlist.id})\n创建者：[${creator.nickname}](https://music.163.com/#/user/home?id=${creator.userId})\n标签：「${(playlist.tags || []).join('、')}」\n数量：${playlist.trackCount}\n`
  const songListText = (tracks || []).reduce((prev, item) => {
    const singers = (item.ar || []).map(v => v.name).join(',')
    return prev + `1. [${singers} - ${item.name}](https://music.163.com/#/song?id=${item.id})\n`
  }, '')
  const readmeContents = `# ${playlist.name}\n\n${coverText}${info}## 简介\n${playlist.description}\n\n## 播放列表\n${songListText}\n`
  writeTextSync(readmePath, readmeContents)

}

async function main() {
  await initBasic()

  const {tracks, data} = await getPlaylistTracks()

  await arrangeFile(tracks)

  await saveMeta(data, tracks)

  console.log('Done')
}

main()




