const puppeteer = require('puppeteer')
const notifier = require('node-notifier')

// 引数を型キャストしておく
const argOpts = {
  string: ['user', 'pass'],
  boolean: ['out', 'debug']
}
const argv = require('minimist')(process.argv.slice(2), argOpts)

// 引数と設定など
const user = argv.user
const pass = argv.pass
const out = argv.out
const debug = argv.debug
const flags = debug
  ? []
  : ['--disable-gpu', '--headless']
const loginUrl = 'http://192.168.1.58/XGweb/login.asp'
const punchUrl = `http://192.168.1.58/XGweb/page/XgwTopMenuClockUpd.asp?PunchKind=${out?2:1}`
let log = `${out ? '退勤' : '出勤'}しました😉`

;(async() => {
  const browser = await puppeteer.launch({
    headless: !debug
  })
  const page = await browser.newPage()

  // ページのクラッシュを捕捉
  page.on('error', err => {
    console.log(err)
    browser.close()
    notify(err)
  })
  // ページでのエラーを捕捉
  page.on('pageerror', exception => {
    cosole.log(exception)
    browser.close()
    notify(exception)
  })
  // ダイアログの無視、捕捉されればログにメッセージ足し込み
  page.on('dialog', dialog => {
    /**
     * @see https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#dialogmessage
     * @todo 返却される String がマルチバイトだと文字化けする
     */
    // log += dialog.message()
    log += 'おそらくパスワード変更の警告が出てるくさい💩'
    dialog.dismiss()
  })

  await page.goto(loginUrl, { waitUntil: 'load' })
  await page.focus('input[name=LoginID]')
  await page.type(user)
  await page.focus('input[name=PassWord]')
  await page.type(pass)
  await page.click('input[name=btnLogin]')
  await page.waitForNavigation({ waitUntil: 'load' })
  await page.goto(punchUrl, { waitUntil: 'load' })  
  browser.close()

  console.log(log)
  notify(log)
})()

/**
 * @param {string} message 
 */
function notify (message) {
  notifier.notify({
    'title': '出退勤スクリプト',
    'message': message
  })
}
