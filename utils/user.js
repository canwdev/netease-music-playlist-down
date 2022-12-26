const service = require('./service')
const md5 = require('crypto-js/md5')
const {doSleep} = require('./index')
const express = require('express')

const getLoginStatus = async () => {
  console.log('检查登录状态...')
  const res = await service.get('/login/status')
  // console.log(res)
  // debugger

  const data = res.data

  const {code} = data
  if (code !== 200) {
    console.error(res.data)
    throw new Error('用户未登录！')
  }
  console.log('已登录！用户名为', data.account.userName)

  return res
}

const userLogin = async ({phone, email, password, captcha}) => {
  let data
  const md5_password = md5(password).toString()

  if (phone) {
    console.log('正在请求登录，请稍候...', {phone, md5_password})
    data = await service.get('/login/cellphone', {
      params: {
        phone,
        captcha,
        md5_password
      }
    })

    // data.cookie
    return data
  } else {
    console.log('正在请求登录，请稍候...', {email, md5_password})
    data = await service.get('/login', {
      params: {
        email,
        password
      }
    })
  }

  console.log(res)
  debugger
  return data
}

const getPhoneCaptcha = (params) => {
  return service.get('/captcha/sent', {params})
}

const getLoginQrCode = async () => {
  console.log('正在生成二维码...')
  const res1 = await service.get('/login/qr/key', {
    params: {timerstamp: Date.now()}
  })
  console.log(res1)
  const res2 = await service.get('/login/qr/create', {
    params: {key: res1.data.unikey, qrimg: true, timerstamp: Date.now()}
  })
  console.log(res2)

  // 启动一个服务器用于展示二维码
  const port = 12345
  const app = express()
  app.get('/', (req, res) => {
    const base64Data = res2.data.qrimg.replace(/^data:image\/png;base64,/, '')
    const img = Buffer.from(base64Data, 'base64')

    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length
    });
    res.end(img);
  })
  app.listen(port, () => {
    console.log('请点击链接后，使用网易云手机客户端扫描二维码：')
    console.log(`http://127.0.0.1:${port}`)
    console.log('扫码完成后请返回控制台查看结果 :)')
  })

  for (let i = 0; i < 100; i++) {
    await doSleep(3000)
    console.log(`第${i + 1}次轮询中...`)
    const res3 = await service.get('/login/qr/check', {
      params: {key: res1.data.unikey, timerstamp: Date.now()}
    })
    console.log(res3)
    if (res3 && res3.code === 803) {
      app.close()
      return res3
    }
  }

  return res2
}

module.exports = {
  userLogin,
  getLoginStatus,
  getPhoneCaptcha,
  getLoginQrCode
}
