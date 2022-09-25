const service = require('./service')

const getLoginStatus = async () => {
  const res = await service.get('/login/status')
  // console.log(res)
  // debugger

  const data = res.data.data

  const {code} = data
  if (code !== 200) {
    console.error(res.data)
    throw new Error('用户未登录')
  }
  console.log('已登录：用户名为：', data.account.userName)

  return res
}

const userLogin = async ({phone, password}) => {
  const res = await service.get('/login/cellphone', {
    params: {
      phone,
      password
    }
  })

  // console.log(res)
  // debugger

  const data = res.data.data
  const {code} = data
  if (code !== 200) {
    console.error(res.data)
    throw new Error('登录失败，请检查手机号和密码，以及控制台输出')
  }
  return res
}

module.exports = {
  userLogin,
  getLoginStatus
}
