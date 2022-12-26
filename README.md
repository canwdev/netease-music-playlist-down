# NeteaseCloudMusic 歌单工具

- 基于 Node.js 和 [NeteaseCloudMusicApi](https://binaryify.github.io/NeteaseCloudMusicApi)
- 仅供学习使用，严禁商业用途
- 注意：版权限制的音乐无法下载（

## 1. CLI交互程序

1. 安装 Node.js
2. 在 server 目录下载 [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) 并启动
3. 打开 [config.js](./config.js)，修改参数：
   - `apiBaseUrl`：你自己搭建的 NeteaseCloudMusicApi 服务地址。
4. `yarn` 安装依赖。
5. `node index.js` 开始命令行下载交互程序。

## 2. 自动排序PC客户端下载的歌单

1. 一次只能对一个歌单进行排序

2. 打开 tracks-arrange.js，修改参数：

   ```
   fromDir: 'D:\\CloudMusic\\', // NeteaseCloudMusicPC客户端下载文件夹
   toDir: 'D:\\CloudMusicArranged\\', // 目标文件夹
   ```

3. `node tracks-arrange.js`

4. [效果截图](./tracks-arrange-demo.gif)

---

- 提示：使用客户端下载后的加密音乐文件可以通过 [.ncm unlock](https://demo.unlock-music.dev/) 工具解密
