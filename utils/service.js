const axios = require('axios')
const {apiBaseUrl, downloadCustomerConfigPath} = require('../config')
const {initCustomerConfig} = require('./index')

const customerConfig = initCustomerConfig(downloadCustomerConfigPath)

const {cookie} = customerConfig
let withCredentials = false
const headers = {} // 请求头部
if (cookie) {
  withCredentials = true
  headers.Cookie = cookie
}

const service = axios.create({
  baseURL: apiBaseUrl,
  withCredentials, // send cookies when cross-domain requests
  headers
})


// 请求 拦截器
service.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => Promise.reject(error)
)

// 响应 拦截器
service.interceptors.response.use(
  (response) => {
    if (response.data) {
      const {code, msg, message} = response.data
      // 错误处理
      // 800 为二维码过期,801 为等待扫码,802 为待确认,803 为授权登录成功(803 状态码下会返回 cookies)
      const QrWaitStatus = {
        801: true,
        802: true,
        803: true
      }
      if (code && code !== 200 && !QrWaitStatus[code]) {
        console.log(response.data)
        return Promise.reject(new Error(msg || message))
      }
    }
    return response.data
  },
  (error) => {
    let emitError = error
    const {response} = error
    if (response && response.data) {
      if (response.data.message) {
        console.error(response.data)
        emitError = new Error(response.data.message)
      }
    }
    return Promise.reject(emitError)
  }
)

module.exports = service
