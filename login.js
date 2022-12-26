const {userLogin, getLoginStatus, getPhoneCaptcha, getLoginQrCode} = require('./utils/user')
const {inquireInputString, initCustomerConfig, writeTextSync, inquireYesOrNo} = require('./utils')
const {downloadCustomerConfigPath} = require('./config')
const inquirer = require('inquirer')

const LoginMethodType = {
  PHONE_PWD: 'PHONE_PWD',
  EMAIL_PWD: 'EMAIL_PWD',
  QR_CODE: 'QR_CODE',
}

const saveCookie = (options = {}) => {
  const {
    customerConfig,
    cookie
  } = options

  customerConfig.cookie = cookie
  writeTextSync(downloadCustomerConfigPath, JSON.stringify(customerConfig))
  console.log(`登录成功！Cookie 信息已保存！配置文件位于：${downloadCustomerConfigPath}`)
}

const loginWithPassword = async (options = {}) => {
  const {
    isPhone = false,
    isEmail = false,
    customerConfig
  } = options

  let phone
  let email

  if (isPhone) {
    phone = await inquireInputString('请输入手机号', '')
    if (!phone) {
      console.log('手机号不能为空')
      return
    }
  } else if (isEmail) {
    email = await inquireInputString('请输入Email', '')
    if (!email) {
      console.log('Email不能为空')
      return
    }
  }

  let isCaptcha
  if (isPhone) {
    isCaptcha = await inquireYesOrNo('是否使用验证码登录？')
  }

  let password, captcha
  if (isCaptcha) {
    // const res = await getPhoneCaptcha({phone})
    // console.log(res)
    // TODO: 处理验证码

    captcha = await inquireInputString('请输入验证码', '')
    if (!captcha) {
      console.log('验证码不能为空')
      return
    }
  } else {
    password = await inquireInputString('请输入密码', '')
    if (!password) {
      console.log('密码不能为空')
      return
    }
  }

  const {cookie} = await userLogin({phone, email, password, captcha})
  saveCookie({
    cookie,
    customerConfig
  })
}

const loginWithQrCode = async (options = {}) => {
  const {
    customerConfig,
  } = options
  const {cookie} = await getLoginQrCode()
  saveCookie({
    cookie,
    customerConfig
  })
}

const run = async () => {
  const customerConfig = initCustomerConfig(downloadCustomerConfigPath)

  if (customerConfig.cookie) {
    await getLoginStatus()
    console.log(`用户信息已存在！配置文件位于：${downloadCustomerConfigPath}\n如需重新登录，请删除 cookie`)
    return
  }


  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择登录方式：\n因网易增加了网易云盾验证,密码登录暂时不要使用,\n尽量使用短信验证码登录和二维码登录,\n否则调用某些接口会触发需要验证的错误',
      choices: [
        {
          name: '扫码登录(推荐)',
          value: LoginMethodType.QR_CODE,
        },
        {
          name: '手机+密码登录',
          value: LoginMethodType.PHONE_PWD,
        },
        {
          name: '邮箱+密码登录',
          value: LoginMethodType.EMAIL_PWD,
        },
      ],
    }
  ])
  const {action} = answers

  if (action === LoginMethodType.PHONE_PWD) {
    await loginWithPassword({isPhone: true, customerConfig})
  } else if (action === LoginMethodType.EMAIL_PWD) {
    await loginWithPassword({isEmail: true, customerConfig})
  } else if (action === LoginMethodType.QR_CODE) {
    await loginWithQrCode({customerConfig})
  }

}
run()
