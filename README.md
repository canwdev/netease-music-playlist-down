# 网易云音乐歌单下载工具

- 批量下载网易云音乐歌单，并按照歌单顺序排序文件。
- 基于 Node.js 和 [NeteaseCloudMusicApi](https://binaryify.github.io/NeteaseCloudMusicApi)。
- 在云音乐可直接播放但要付费下载的歌曲，通过此工具可以下载（码率较低）。
- 版权限制的音乐无法下载。

## 使用方式

0. 安装 Node.js
1. 打开 [index.js](./index.js)，修改参数：
    - `apiBaseUrl`：你自己搭建的 NeteaseCloudMusicApi 服务地址。
    - `playlistID`：歌单id，可以从云音乐分享链接中获取，如 `https://music.163.com/#/playlist?id=385283496`，id 为 `385283496`。
2. `npm install` 安装依赖。
3. `npm start` 开始下载。
