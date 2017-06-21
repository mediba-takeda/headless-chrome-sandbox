const { ChromeLauncher } = require('lighthouse/lighthouse-cli/chrome-launcher')
const chrome = require('chrome-remote-interface')
const notifier = require('node-notifier')

// 引数を型キャストしておく
const argOpts = {
  string: ['user', 'pass'],
  boolean: ['out', 'debug']
}
const argv = require('minimist')(process.argv.slice(2), argOpts)

// 引数と設定など
const user  = argv.user
const pass  = argv.pass
const out   = argv.out
const debug = argv.debug
const flags = debug
  ? []
  : ['--disable-gpu', '--headless']
const loginUrl = 'http://192.168.1.58/XGweb/login.asp'
const punchUrl = `http://192.168.1.58/XGweb/page/XgwTopMenuClockUpd.asp?PunchKind=${out?2:1}`

console.log(user, pass, out, debug, flags)
console.log(typeof user, typeof pass, typeof out, typeof debug)

// if required param isn't filled, process exit.
if (!user || !pass) console.error('user & pass must be in arguments.'), process.exit()

/**
 * デバッグ用の Chrome インスタンスをポート 9222 で起動する
 * 
 * @param {Boolean} canary - lighthouse 使うとデフォルトが Canary なので false で通常 Chrome が起動
 * @returns {Promise<ChromeLauncher>}
 */
function launchChrome (canary) {
  const launcher = new ChromeLauncher({
    port: 9222,
    autoSelectChrome: canary || true,
    additionalFlags: flags
  })
  return launcher.run().then(() => launcher)
    .catch(err => {
      return launcher.kill().then(() => { // エラーな場合 Chrome を終了
        throw err
      }, console.error)
    })
}

/**
 * sleep 関数
 * 
 * @param {Number} time
 * @returns {Promise}
 */
async function sleep (time) {
  return new Promise( resolve => {
    setTimeout(async ()=> {
      resolve()
    }, time)
  })
}

/** @type {String} - ログインのため、インジェクトする JavaScript */
const loginScript = `document.querySelector('input[name=LoginID]').value = "${user}";
document.querySelector('input[name=PassWord]').value = "${pass}";
document.querySelector('input[name=btnLogin]').click();`

/** @desc Headless Chrome をデバッグプロトコルで起動 */
launchChrome().then( launcher => {
  chrome( async (client) => {

    // DevTools Protocol Domains を展開
    /** @see https://chromedevtools.github.io/devtools-protocol/ */
    const { DOM, Emulation, Network, Page, Runtime } = client

    // 有効にしたいイベントを待ち受け
    await Page.enable()

    // ログイン画面へ遷移
    await Page.navigate({url: loginUrl})

    // ログイン画面ロード完了
    await Page.loadEventFired(()=>{
      // ログイン
      Runtime.evaluate({expression: loginScript})
    })

    await sleep(1000)

    // ログイン後画面ロード完了
    await Page.loadEventFired(()=>{
      console.log('login success.')
    })

    // 勤怠画面へ遷移
    await Page.navigate({url: punchUrl})

    // ロード完了
    await Page.loadEventFired(()=>{
      console.log(`headless chrome click ${out ? '退勤' : '出勤'}.`)
      console.log('exit.')
      notifier.notify({
        'title': '出退勤スクリプト',
        'message': `${out ? '退勤' : '出勤'}しました 😉`
      })
      // Chrome の終了
      client.close()
      launcher.kill()
    })

  })
  .on('error', err => {
    notifier.notify({
      'title': '出退勤スクリプト',
      'message': `${err}というエラー`
    })
    launcher.kill()
    throw Error('Cannot connect to Chrome:' + err)
  })
})
