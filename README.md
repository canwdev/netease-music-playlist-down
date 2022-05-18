# NeteaseCloudMusic 歌单工具

- 基于 Node.js 和 [NeteaseCloudMusicApi](https://binaryify.github.io/NeteaseCloudMusicApi)
- 仅供交流学习使用，严禁商业用途!!
- 版权限制的音乐无法下载（

## 歌单下载

0. 安装 Node.js
1. 打开 [index.js](./index.js)，修改参数：
   - `apiBaseUrl`：你自己搭建的 NeteaseCloudMusicApi 服务地址。
2. `yarn` 安装依赖。
3. `node index.js` 开始下载。

## 自动整理 NeteaseCloudMusic PC客户端下载的歌曲（根据歌单序号自动排序）

- [效果截图](./tracks-arrange-demo.gif)

1. 打开 tracks-arrange.js，修改参数：

   ```
   fromDir: 'D:\\CloudMusic\\', // NeteaseCloudMusicPC客户端下载文件夹
   toDir: 'D:\\CloudMusicArranged\\', // 目标文件夹
   ```

2. `node tracks-arrange.js`

## 备注

- [.ncm unlock](https://demo.unlock-music.dev/)
