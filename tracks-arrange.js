/**
 * 自动整理网易云音乐下载的歌曲
 */
const config = {
  fromDir: 'D:\\CloudMusic\\', // 网易云音乐PC客户端下载文件夹
  toDir: 'D:\\CloudMusicArranged\\', // 目标文件夹
  playlistID: '36283027' // 从 https://github.com/Binaryify/NeteaseCloudMusicApi 获取的歌单详情json
}
const {apiBaseUrl} = require('./config')

const fs = require('fs')
const path = require('path')
const shell = require('shelljs')
const axios = require('axios')

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

const metaDataPath = path.join(config.toDir, 'index.json')

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
  if (!fs.existsSync(config.toDir)) {
    shell.mkdir('-p', config.toDir)
  }

  // 保存 meta 信息
  if (!fs.existsSync(metaDataPath)) {
    fs.writeFileSync(metaDataPath, JSON.stringify(data), {
      encoding: 'utf8'
    })
  }
}

async function arrangeFile(tracks) {
  console.log(`源目录：${config.fromDir}\n目标目录：${config.toDir}\n开始操作...`)
  const copiedFiles = {}

  shell.cd(config.fromDir)
  const files = shell.ls()

  for (const i in tracks) {
    const num = Number(i) + 1
    let {name, ar} = tracks[i]
    let {name: artist} = ar[0]

    name = name
      .replace(/\.$/, '') // 去除最后的 `.`
      .replace(/\?/g, '？')
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

      /*if (i == 184) { // for debug
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
      console.error(`歌曲匹配失败(i=${i})：\n${artist}\n${name}`)
      debugger
      break
    }

    copiedFiles[fromName] = true
    const targetPath = path.join(config.toDir, targetName)
    if (!fs.existsSync(targetPath)) {
      console.log(`复制：【${fromName}】 -> 【${targetName}】`)
      shell.cp(path.join(config.fromDir, fromName), targetPath)
    } else {
      console.log(`跳过：【${fromName}】 -> 【${targetName}】`)
    }
  }
}

async function main() {
  const {tracks, data} = await getPlaylistTracks()

  await initFS(data)

  await arrangeFile(tracks)

  console.log('执行结束')
}

main()




