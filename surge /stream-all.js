/*
 * 由@LucaLin233编写
 * 原脚本地址：https://raw.githubusercontent.com/LucaLin233/Luca_Conf/main/Surge/JS/stream-all.js
 * 由@Rabbit-Spec修改
 * 更新日期：2024.06.01
 * 版本：3.3 (优化 ChatGPT 地区显示)
 */

const REQUEST_HEADERS = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
}

const STATUS_COMING = 2
const STATUS_AVAILABLE = 1
const STATUS_NOT_AVAILABLE = 0
const STATUS_TIMEOUT = -1
const STATUS_ERROR = -2

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36'

;(async () => {
    let panel_result = {
      title: '流媒体解锁检测',
      content: '',
      icon: 'play.tv.fill',
      'icon-color': '#FF2D55',
    }
    
    let [{ region, status }] = await Promise.all([testDisneyPlus()])
    
    // 并发检测 YT, Netflix, ChatGPT
    await Promise.all([check_youtube_premium(), check_netflix(), check_chatgpt()])
      .then((result) => { 
        let disney_result = ""
        if (status == STATUS_COMING) {
            disney_result = "Disney+: 即将登陆 ➟ " + region.toUpperCase()
        } else if (status == STATUS_AVAILABLE) {
            disney_result = "Disney+: 已解锁 ➟ " + region.toUpperCase()
        } else if (status == STATUS_NOT_AVAILABLE) {
            disney_result = "Disney+: 未支持 🚫"
        } else if (status == STATUS_TIMEOUT) {
            disney_result = "Disney+: 检测超时 🚦"
        }

        result.push(disney_result)
        let content = result.join('\n')
        panel_result['content'] = content
      })
      .finally(() => {
        $done(panel_result)
      })
})()

// --- 优化后的 ChatGPT 检测 (支持显示地区代码) ---
async function check_chatgpt() {
    let inner_check = () => {
        return new Promise((resolve, reject) => {
            let option = {
                url: 'https://chat.openai.com/cdn-cgi/trace',
                headers: REQUEST_HEADERS,
            }
            $httpClient.get(option, function (error, response, data) {
                if (error != null) {
                    reject('Error')
                    return
                }
                // 解析 Cloudflare trace 信息获取地区
                let lines = data.split('\n')
                let kv = {}
                lines.forEach(line => {
                    let parts = line.split('=')
                    if (parts[1]) kv[parts[0]] = parts[1]
                })
                
                let region = kv['loc'] ? kv['loc'].toUpperCase() : ''
                
                // 再次验证是否真的允许访问
                let check_url = {
                    url: 'https://ios.chat.openai.com/public-api/mobile/server_status/v1',
                    headers: REQUEST_HEADERS,
                }
                $httpClient.get(check_url, function (err, res, dat) {
                    if (res && res.status === 200) {
                        resolve(region || 'YES')
                    } else {
                        resolve('Not Available')
                    }
                })
            })
        })
    }

    let res = 'ChatGPT: '
    await inner_check()
        .then((code) => {
            if (code === 'Not Available') {
                res += '不支持解锁 🚫'
            } else {
                res += '已解锁 ➟ ' + code
            }
        })
        .catch(() => {
            res += '检测失败 🛠️'
        })
    return res
}

// --- 其余函数保持不变 ---
async function check_youtube_premium() {
    let inner_check = () => {
      return new Promise((resolve, reject) => {
        let option = {
          url: 'https://www.youtube.com/premium',
          headers: REQUEST_HEADERS,
        }
        $httpClient.get(option, function (error, response, data) {
          if (error != null || response.status !== 200) {
            reject('Error'); return
          }
          if (data.indexOf('Premium is not available in your country') !== -1) {
            resolve('Not Available'); return
          }
          let re = new RegExp('"countryCode":"(.*?)"', 'gm')
          let result = re.exec(data)
          let region = (result && result.length === 2) ? result[1] : (data.indexOf('www.google.cn') !== -1 ? 'CN' : 'US')
          resolve(region)
        })
      })
    }
    let res = 'YouTube: '
    await inner_check().then(code => {
        res += (code === 'Not Available' ? '不支持解锁' : '已解锁 ➟ ' + code.toUpperCase())
    }).catch(() => { res += '检测失败' })
    return res
}

async function check_netflix() {
    let inner_check = (filmId) => {
      return new Promise((resolve, reject) => {
        let option = { url: 'https://www.netflix.com/title/' + filmId, headers: REQUEST_HEADERS }
        $httpClient.get(option, function (error, response, data) {
          if (error != null) { reject('Error'); return }
          if (response.status === 403) { reject('Not Available'); return }
          if (response.status === 404) { resolve('Not Found'); return }
          if (response.status === 200) {
            let url = response.headers['x-originating-url'] || ''
            let region = url.split('/')[3] ? url.split('/')[3].split('-')[0] : 'US'
            resolve(region === 'title' ? 'US' : region)
            return
          }
          reject('Error')
        })
      })
    }
    let res = 'Netflix: '
    await inner_check(81280792)
      .then(code => {
          if (code === 'Not Found') return inner_check(80018499).then(c => {
              if (c === 'Not Found') throw 'Not Available'
              res += '仅解锁自制剧 ➟ ' + c.toUpperCase()
          })
          res += '已完整解锁 ➟ ' + code.toUpperCase()
      })
      .catch(err => { res += (err === 'Not Available' ? '该节点不支持解锁' : '检测失败') })
    return res
}

async function testDisneyPlus() {
    try {
        let { region, cnbl } = await Promise.race([testHomePage(), timeout(7000)])
        let { countryCode, inSupportedLocation } = await Promise.race([getLocationInfo(), timeout(7000)])
        region = countryCode ?? region
        return { region, status: (inSupportedLocation === false || inSupportedLocation === 'false') ? STATUS_COMING : STATUS_AVAILABLE }
    } catch (e) {
        if (e === 'Not Available') return { status: STATUS_NOT_AVAILABLE }
        return { status: STATUS_TIMEOUT }
    }
}

function getLocationInfo() {
    return new Promise((resolve, reject) => {
        let opts = {
            url: 'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql',
            headers: {
                'Accept-Language': 'en',
                Authorization: 'ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84',
                'Content-Type': 'application/json',
                'User-Agent': UA,
            },
            body: JSON.stringify({
                query: 'mutation registerDevice($input: RegisterDeviceInput!) { registerDevice(registerDevice: $input) { grant { grantType assertion } } }',
                variables: {
                    input: {
                        applicationRuntime: 'chrome',
                        attributes: {
                            browserName: 'chrome',
                            browserVersion: '94.0.4606',
                            manufacturer: 'apple',
                            model: null,
                            operatingSystem: 'macintosh',
                            operatingSystemVersion: '10.15.7',
                            osDeviceIds: [],
                        },
                        deviceFamily: 'browser',
                        deviceLanguage: 'en',
                        deviceProfile: 'macosx',
                    },
                },
            }),
        }
        $httpClient.post(opts, (error, response, data) => {
            if (error || response.status !== 200) { reject('Not Available'); return }
            let res = JSON.parse(data)
            if(res?.errors) { reject('Not Available'); return }
            resolve({ 
                inSupportedLocation: res.extensions.sdk.session.inSupportedLocation, 
                countryCode: res.extensions.sdk.session.location.countryCode 
            })
        })
    })
}

function testHomePage() {
    return new Promise((resolve, reject) => {
        $httpClient.get({ url: 'https://www.disneyplus.com/', headers: { 'Accept-Language': 'en', 'User-Agent': UA } }, (error, response, data) => {
            if (error || response.status !== 200 || data.indexOf('not available') !== -1) { reject('Not Available'); return }
            let match = data.match(/Region: ([A-Za-z]{2})/)
            resolve({ region: match ? match[1] : '' })
        })
    })
}

function timeout(delay = 5000) {
    return new Promise((_, reject) => { setTimeout(() => { reject('Timeout') }, delay) })
}
