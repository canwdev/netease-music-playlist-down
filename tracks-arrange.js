/**
 * 自动整理网易云音乐下载的歌曲
 * 根据歌单序号自动排序
 */
const config = {
  fromDir: 'D:\\CloudMusic\\', // 网易云音乐PC客户端下载文件夹
  toDir: 'D:\\CloudMusicArranged\\', // 目标文件夹
  playlistID: '4978272073' // 歌单ID，从 https://github.com/Binaryify/NeteaseCloudMusicApi 获取的歌单详情json
}
const {apiBaseUrl} = require('./config')

const fs = require('fs')
const path = require('path')
const shell = require('shelljs')
const axios = require('axios')
const {inquireYesOrNo} = require('./utils')

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

const distDir = path.join(config.toDir, config.playlistID)
const metaDataPath = path.join(distDir, 'index.json')

async function getPlaylistTracks() {
  // 如果已保存元数据，则不请求接口
  if (fs.existsSync(metaDataPath)) {
    const data = require(metaDataPath)
    const {songDetailListData: {songs: tracks}} = data

    console.log('从本地读取歌单成功')
    return {
      tracks,
      data
    }
  }

  console.log('获取歌单详情...')
  const {data: playListData} = await axios.get(`${apiBaseUrl}/playlist/detail?id=${config.playlistID}`)
  const {playlist: {trackIds}} = playListData
  console.log('成功')

  console.log('获取歌曲列表...')
  const {data: songDetailListData} = await axios.get(`${apiBaseUrl}/song/detail?ids=${trackIds.map(item => item.id).join(',')}`)
  const {songs: tracks} = songDetailListData
  console.log('成功')

  return {
    tracks,
    data: {
      playListData,
      songDetailListData
    }
  }

}

async function initFS(data) {
  if (!fs.existsSync(distDir)) {
    shell.mkdir('-p', distDir)
  }

  // 保存 meta 信息
  if (!fs.existsSync(metaDataPath)) {
    fs.writeFileSync(metaDataPath, JSON.stringify(data), {
      encoding: 'utf8'
    })
  }
}

async function arrangeFile(tracks) {
  console.log(`源目录：${config.fromDir}\n目标目录：${distDir}\n开始操作...`)
  const copiedFiles = {}
  const copyFailedItems = []

  shell.cd(config.fromDir)
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
      // 如果已复制则不选中，避免重复
      if (copiedFiles[item]) {
        return false
      }

      // 去除后缀
      item = item.slice(0, item.lastIndexOf('.'))
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
    })

    const fromName = filteredFiles[0]
    const targetName = `${num}. ${fromName}`

    if (!fromName) {
      const failedName = `【i=${i}】${num}. ${ar.map(item => item.name).join(',')} - ${name}`
      console.log(`歌曲匹配失败：${failedName}`)
      copyFailedItems.push(failedName)
      debugger
    } else {
      copiedFiles[fromName] = true
      const targetPath = path.join(distDir, targetName)
      if (!fs.existsSync(targetPath)) {
        console.log(`复制：【${fromName}】 -> 【${targetName}】`)
        shell.cp(path.join(config.fromDir, fromName), targetPath)
      } else {
        console.log(`跳过：【${fromName}】 -> 【${targetName}】`)
      }
    }


  }

  console.log('----------------------')
  if (copyFailedItems.length > 0) {
    console.log(`警告：有 ${copyFailedItems.length} 个匹配失败，请尝试手动复制或修改源码 :)`)
    console.log(copyFailedItems)
  } else {
    console.log(`全部歌曲复制成功！`)
    let isDelete = await inquireYesOrNo(`要删除 ${config.fromDir} 里的原文件吗？`)
    if (isDelete) {
      isDelete = await inquireYesOrNo(`再次确认是否要删除？此操作不可撤销，删除前请退出网易云音乐`)
      // console.log(Object.keys(copiedFiles))
      isDelete && shell.rm(Object.keys(copiedFiles))
    }
    if (!isDelete) {
      console.log('没有删除')
    }
  }
}

async function main() {
  const {tracks, data} = await getPlaylistTracks()

  await initFS(data)

  await arrangeFile(tracks)

  console.log('Bye.')
}

main()




