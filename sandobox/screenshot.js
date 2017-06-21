const { ChromeLauncher } = require('lighthouse/lighthouse-cli/chrome-launcher')
const chrome = require('chrome-remote-interface')
const argv = require('minimist')(process.argv.slice(2))
const file = require('fs')

const url = 'https://google.com'
const userAgent = argv.userAgent
const format = argv.format === 'jpeg' ? 'jpeg' : 'png'
const viewportWidth = argv.viewportWidth || 1440
const viewportHeight = argv.viewportHeight || 900
const delay = argv.delay || 0
const fullPage = argv.full

/**
 * デバッグ用の Chrome インスタンスをポート 9222 で起動する
 * 
 * @param {Boolean} headless 
 * @returns {Promise<ChromeLauncher>}
 */
function launchChrome(headless) {
  const launcher = new ChromeLauncher({
    port: 9222,
    autoSelectChrome: headless,
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

/** @desc Headless Chrome をデバッグプロトコルで起動 */
launchChrome(true).then( launcher => {
  chrome( async function(client) {
    // DevTools Protocol Domains を展開
    /** @see https://chromedevtools.github.io/devtools-protocol/ */
    const { DOM, Emulation, Network, Page, Runtime } = client

    // 有効にしたいイベントを待ち受け
    await Page.enable()
    await DOM.enable()
    await Network.enable()

    // cli に userAgent 指定されていたらオーバーライドする 
    if (userAgent) {
      await Network.setUserAgentOverride({userAgent})
    }

    // Set up viewport resolution, etc.
    const deviceMetrics = {
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 0,
      mobile: false,
      fitWindow: false,
    }
    await Emulation.setDeviceMetricsOverride(deviceMetrics)
    await Emulation.setVisibleSize({width: viewportWidth, height: viewportHeight})

    // Navigate to target page
    await Page.navigate({url})

    // Wait for page load event to take screenshot
    Page.loadEventFired(async () => {
      // If the `full` CLI option was passed, we need to measure the height of
      // the rendered page and use Emulation.setVisibleSize
      if (fullPage) {
        const {root: {nodeId: documentNodeId}} = await DOM.getDocument()
        const {nodeId: bodyNodeId} = await DOM.querySelector({
          selector: 'body',
          nodeId: documentNodeId,
        })
        const {model: {height}} = await DOM.getBoxModel({nodeId: bodyNodeId})

        await Emulation.setVisibleSize({width: viewportWidth, height: height})
        // This forceViewport call ensures that content outside the viewport is
        // rendered, otherwise it shows up as grey. Possibly a bug?
        await Emulation.forceViewport({x: 0, y: 0, scale: 1})
      }

      setTimeout(async function() {
        const screenshot = await Page.captureScreenshot({format})
        const buffer = new Buffer(screenshot.data, 'base64')
        file.writeFile('output.png', buffer, 'base64', function(err) {
          if (err) {
            console.error(err)
          } else {
            console.log('Screenshot saved')
          }
          client.close()
        })
      }, delay)
    })
  })
  .on('error', err => {
    throw Error('Cannot connect to Chrome:' + err)
  })
})
