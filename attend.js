const { ChromeLauncher } = require('lighthouse/lighthouse-cli/chrome-launcher')
const chrome = require('chrome-remote-interface')
const argOpts = {
  string: ['user', 'pass']
}
const argv = require('minimist')(process.argv.slice(2), argOpts)
const file = require('fs')

const url = 'http://192.168.1.58/XGweb/login.asp'
const user = argv.user || 'xxxxx'
const pass = argv.pass || 'xxxxx'

/**
 * デバッグ用の Chrome インスタンスをポート 9222 で起動する
 * 
 * @param {Boolean} canary 
 * @returns {Promise<ChromeLauncher>}
 */
function launchChrome (canary) {
  const launcher = new ChromeLauncher({
    port: 9222,
    autoSelectChrome: canary,
    additionalFlags: [
      '--disable-gpu',
      '--headless'
    ]
  })
  return launcher.run().then(() => launcher)
    .catch(err => {
      return launcher.kill().then(() => { // エラーな場合 Chrome を終了
        throw err
      }, console.error)
    })
}
const loginScript = `document.querySelector('input[name=LoginID]').value = "${user}";
document.querySelector('input[name=PassWord]').value = "${pass}";
document.querySelector('input[name=btnLogin]').click();`
function onPageLoadLogin (Runtime) {
  // ページ内で JS の式を評価する。
  return Runtime.evaluate({expression: loginScript}).then(()=>{})
}


/** @desc Headless Chrome をデバッグプロトコルで起動 */
launchChrome(true).then( launcher => {
  chrome( async (client) => {
    // DevTools Protocol Domains を展開
    /** @see https://chromedevtools.github.io/devtools-protocol/ */
    const { DOM, Emulation, Network, Page, Runtime } = client

    // 有効にしたいイベントを待ち受け
    await Page.enable()
    // 引数に指定したページへ遷移
    await Page.navigate({url})

    // page load のイベント完了後の振る舞い
    Page.loadEventFired(async () => {
      onPageLoadLogin(Runtime)
        .then(() => {
          // /** @desc Chrome を終了させる。 */
          client.close()
          launcher.kill()
        })
    })
  })
  .on('error', err => {
    throw Error('Cannot connect to Chrome:' + err)
  })
})
