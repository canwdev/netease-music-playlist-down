const axios = require('axios')
const fs = require('fs')
const path = require('path')
var sanitize = require("sanitize-filename");
const ID3Writer = require('browser-id3-writer');

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

// https://binaryify.github.io/NeteaseCloudMusicApi
const apiBaseUrl = 'https://zencode.top:9001'
// 歌单 ID
const playlistID = '385283496'

async function run() {
  axios.get(`${apiBaseUrl}/playlist/detail?id=${playlistID}`).then(async res => {
    const data = res.data

    // 歌单名称
    const playlistName = data.playlist.name
    const playlist = data.playlist.tracks
    console.log('>>> 歌单获取成功！', playlistName)

    // 创建下载目录
    const distDir = path.join(__dirname, 'dist', sanitize(playlistName))
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir);
    }

    // 保存 meta 信息
    fs.writeFileSync(path.join(distDir, 'index.json'), JSON.stringify(res.data), {
      encoding: 'utf8'
    })

    // 开始批量下载
    console.log(`>>> 开始下载歌单，共 ${playlist.length} 首歌曲`)
    for (let i = 0; i < playlist.length; i++) {
      const index = padZero((i+1), (playlist.length).toString().length)

      try {
        const song = playlist[i]
        const {name, id} = song

        // 获取下载地址
        console.log(`>>> [${index}] 正在获取歌曲《${name}》信息，id=${id}`)
        const downInfo = await getSongDownloadInfo(song.id)

        // 下载
        console.log('>>> 开始下载', downInfo.url)
        const {buffer, saveName} = await getSongBufferWithTags(downInfo.url, song)
        const songSavePath = path.join(distDir, sanitize(`${index}. ${saveName}`, {replacement: '_'}))
        fs.writeFileSync(songSavePath, Buffer.from(buffer))
        console.log('>>> 已下载', songSavePath)

      } catch (e) {
        console.log(`>>> [${index}] Error!`, e)
      }
      // break
    }
    console.log('>>> 执行结束！')

  }).catch(e => {
    console.error('>>> 获取歌单失败！', e.message)
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
    console.error(err)
  }
}

/**
 * 下载音乐为Buffer，填充ID3标签
 */
async function getSongBufferWithTags(url, {id, name, ar}) {
  const artists = ar
  const saveName = formatArtist(artists, ', ')
    + ' - ' + name + '.mp3'

  try {
    const musicDetail = await axios.get(apiBaseUrl + '/song/detail?ids=' + id)
    const detail = musicDetail.data.songs[0]
    // console.log(detail)

    const musicRes = await axios.get(url, {
      responseType: 'arraybuffer'
    })
    const arrayBuffer = musicRes.data

    const writer = new ID3Writer(arrayBuffer);
    writer.setFrame('TIT2', detail.name)  // song title
      .setFrame('TPE1', formatArtist(artists, ';').split(';')) // song artists
      .setFrame('TALB', detail.al.name) // album title
      .setFrame('TYER', new Date(detail.publishTime).getFullYear()) // album release year
      .setFrame('TRCK', detail.no)   // song number in album
      .setFrame('TPOS', detail.cd)   // album disc number
      .setFrame('TCON', [])   // song genres

    if (detail.al.picUrl) {
      // 获取封面图
      const coverRes = await axios.get(detail.al.picUrl, {
        responseType: 'arraybuffer'
      })
      const coverArrayBuffer = coverRes.data
      writer.setFrame('APIC', {
        type: 3,
        data: coverArrayBuffer,
        description: ''
      })  // attached picture
    }

    writer.addTag();

    const buffer = writer.arrayBuffer;
    // const blob = writer.getBlob();
    // const newUrl = writer.getURL();

    return {buffer, saveName}

  } catch (err) {
    console.error('下载失败！', err.message)
  }
}

function formatArtist(arr, separator = ' / ') {
  var nameArr = []
  arr.forEach(v => {
    nameArr.push(v.name)
  })

  return nameArr.join(separator)
}

function padZero(num, len=2) {
  return num.toString().padStart(len, '0')
}

run()
