# 云音乐歌单下载工具

- 批量下载网易云音乐歌单中的音乐，并按照顺序排序文件
- 基于 Node.js 和 [NeteaseCloudMusicApi](https://binaryify.github.io/NeteaseCloudMusicApi)
- 只要在云音乐可以直接播放的歌曲，就可以下载（码率较低）
- **版权限制的音乐无法下载**

## 歌单下载

0. 安装 Node.js
1. 打开 [index.js](./index.js)，修改参数：
    - `apiBaseUrl`：你自己搭建的 NeteaseCloudMusicApi 服务地址。
    - `playlistID`：歌单id，可以从云音乐分享链接中获取，如 `https://music.163.com/#/playlist?id=385283496`，id 为 `385283496`。
2. `npm install` 安装依赖。
3. `npm start` 开始下载。

> 也可以尝试 liumingye.js 提供更高级的下载方式

## 自动整理PC客户端下载的歌曲

> 根据歌单序号自动排序

1. 打开 tracks-arrange.js，修改参数：

   ```
   fromDir: 'D:\\CloudMusic\\', // 网易云音乐PC客户端下载文件夹
   toDir: 'D:\\CloudMusicArranged\\', // 目标文件夹
   playlistID: '4978272073' // 歌单ID
   ```

2. `node tracks-arrange.js`
