const Path = require('path')
const Fs = require('fs')
const inquirer = require("inquirer")

const start = async () => {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '欢迎使用【NeteaseCloudMusic 歌单工具】，请选择一个操作：',
      choices: [
        {
          name: '用户登录（可选）',
          value: 'login.js',
        },
        {
          name: '下载用户歌单',
          value: 'downloader.js',
        },
        {
          name: '整理已下载的歌单',
          value: 'tracks-arrange.js',
        },
      ],
    }
  ])

  const {action} = answers
  console.log(action)
  require('child_process').fork(action)

}
start()
