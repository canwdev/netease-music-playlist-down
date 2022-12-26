const Path = require('path')

const downloadDir = Path.join(__dirname, 'download')
const downloadCustomerConfigPath = Path.join(downloadDir, 'customer.json')

module.exports = {
  downloadDir,
  downloadCustomerConfigPath,
  apiBaseUrl: "http://localhost:3000", // 请先设置：https://github.com/Binaryify/NeteaseCloudMusicApi
  playlistID: "", // 歌单ID，可以是链接（字符串）或id（数值）(如：4978272073)
  isNumbering: true, // 是否在文件名添加序号
  metaFileName: 'meta.json',
  isDebug: false,
}
