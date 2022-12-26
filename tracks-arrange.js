/**
 * 自动整理 NeteaseCloudMusic PC客户端下载的歌曲
 * 根据歌单序号自动排序
 * 下载封面，自动输出到目标文件夹
 * 从 https://github.com/Binaryify/NeteaseCloudMusicApi 获取的歌单详情json
 */
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0
const fs = require('fs')
const Path = require('path')
const shell = require('shelljs')
const {
  sanitize,
  padZero,
  writeTextSync,
  parseNcmPlaylistId,
  inquireInputString,
  initCustomerConfig,
} = require('./utils/index')

const {
  downloadCustomerConfigPath,
  playlistID,
  metaFileName,
  isDebug,
} = require('./config')
const {savePlaylistMeta, getPlaylistData} = require('./utils/meta')

const localConfig = {
  fromDir: 'D:\\CloudMusic\\VipSongsDownload', //  NeteaseCloudMusic PC客户端下载文件夹
  toDir: 'D:\\CloudMusicArranged', // 目标文件夹
  metaFileName,
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

  }
}

async function arrangeFile(songs) {
  console.log(`\n源目录：${localConfig.fromDir}\n输出目录：${localConfig.arrangeDistDir}\n\n开始操作...`)
  const copiedFiles = {}
  const copySucceedItems = []
  const copyFailedItems = []

  shell.cd(localConfig.fromDir)
  const files = shell.ls()

  for (let i = 0; i < songs.length; i++) {
    const num = Number(i) + 1
    let {name, ar} = songs[i]
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
        isDebug && console.log(`WARNING: ${e.message} 【${item}】`)
        return false
      }

    })

    const fromName = filteredFiles[0]
    const index = padZero((i + 1), (songs.length).toString().length)
    const targetName = `${index}. ${fromName}`

    if (!fromName) {
      const failedName = `【i=${i}】${index}. ${ar.map(item => item.name).join(',')} - ${name}`
      console.log(`歌曲匹配失败：${failedName}`)
      copyFailedItems.push(failedName)
      debugger
    } else {
      copiedFiles[fromName] = true
      const targetPath = Path.join(localConfig.arrangeDistDir, targetName)
      if (!fs.existsSync(targetPath)) {
        console.log(`移动：【${fromName}】 -> 【${targetName}】`)
        shell.mv(Path.join(localConfig.fromDir, fromName), targetPath)
        copySucceedItems.push(fromName)
      } else {
        isDebug && console.log(`跳过：【${fromName}】 -> 【${targetName}】`)
      }

    }


  }

  console.log('----------------------')
  if (copyFailedItems.length > 0) {
    console.log(`警告：${copyFailedItems.length} 个匹配失败，请尝试手动移动或修改源码 :)`)
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
    const erroredFile = Path.join(localConfig.arrangeDistDir, 'errored.json')
    writeTextSync(erroredFile, JSON.stringify(copyFailedItems, null, 2))
    console.log(`失败文件列表已保存至`, erroredFile)
  }
}

async function main() {
  await initBasic()

  const {
    metaBasePath,
    playListData,
    songDetailListData,
  } = await getPlaylistData(localConfig.playlistIDNumber, {
    basePath: localConfig.toDir,
    isGetDetail: true
  })

  localConfig.arrangeDistDir = metaBasePath

  // 仅当文件夹不存在时执行初始化输出目录
  if (!fs.existsSync(localConfig.arrangeDistDir)) {
    const {playlist} = playListData
    const dirName = `${sanitize(playlist.name)}__${playlist.id}`
    localConfig.arrangeDistDir = Path.join(localConfig.toDir, dirName)
    fs.mkdirSync(localConfig.arrangeDistDir, {recursive: true})
    console.log('✅ 创建输出目录成功，目录名：', dirName)
  }

  const {songs} = songDetailListData
  await arrangeFile(songs)

  await savePlaylistMeta({
    playListData,
    songs: songDetailListData.songs,
  }, localConfig)

  console.log('Done')
}

main()




