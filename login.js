const {userLogin, getLoginStatus} = require('./utils/user')
const {inquireInputString, initCustomerConfig, writeTextSync} = require('./utils')
const {downloadCustomerConfigPath} = require('./config')

const run = async () => {
  const customerConfig = initCustomerConfig(downloadCustomerConfigPath)

  if (customerConfig.cookie) {
    await getLoginStatus()
    console.log(`用户信息已存在！配置文件位于：${downloadCustomerConfigPath} ，如需重新登录，请删除 cookie`)
    return
  }

  const phone = await inquireInputString('请输入手机号', '')
  if (!phone) {
    console.log('手机号不能为空')
    return
  }
  const password = await inquireInputString('请输入密码', '')
  if (!password) {
    console.log('密码不能为空')
    return
  }

  const res = await userLogin({phone, password})
  customerConfig.cookie = res.data.cookie

  writeTextSync(downloadCustomerConfigPath, JSON.stringify(customerConfig))
  console.log(`Cookie 信息已保存！配置文件位于：${downloadCustomerConfigPath}`)
  console.log('登录成功！您的昵称为：', res.data.profile.nickname)
}
run()
