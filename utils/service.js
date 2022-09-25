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

module.exports = service
