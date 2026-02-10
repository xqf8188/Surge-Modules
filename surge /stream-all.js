/*
 * 由@LucaLin233编写
 * 原脚本地址：https://raw.githubusercontent.com/LucaLin233/Luca_Conf/main/Surge/JS/stream-all.js
 * 由@Rabbit-Spec修改
 * 增加 ChatGPT 检测支持
 * 更新日期：2024.06.01
 * 版本：3.2
 */

const REQUEST_HEADERS = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
}

// 状态常量
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
    
    // 同时运行 Disney+ 和其他流媒体检测
    let [{ region, status }] = await Promise.all([testDisneyPlus()])
    
    // 在这里添加了 check_chatgpt()
    await Promise.all([check_youtube_premium(), check_netflix(), check_chatgpt()])
      .then((result) => { 
        let disney_result = ""
        if (status == STATUS_COMING) {
            disney_result = "Disney+: 即将登陆~" + region.toUpperCase()
        } else if (status == STATUS_AVAILABLE) {
            disney_result = "Disney+: 已解锁 ➟ " + region.toUpperCase()
        } else if (status == STATUS_NOT_AVAILABLE) {
            disney_result = "Disney+: 未支持 🚫 "
        } else if (status == STATUS_TIMEOUT) {
            disney_result = "Disney+: 检测超时 🚦"
        } else {
            disney_result = "Disney+: 检测失败 🛠️"
        }

        result.push(disney_result)
        let content = result.join('\n')
        panel_result['content'] = content
      })
      .finally(() => {
        $done(panel_result)
      })
})()

// --- ChatGPT 检测函数 ---
async function check_chatgpt() {
    let inner_check = () => {
        return new Promise((resolve, reject) => {
            let option = {
                url: 'https://ios.chat.openai.com/public-api/mobile/server_status/v1',
                headers: REQUEST_HEADERS,
            }
            $httpClient.get(option, function (error, response, data) {
                if (error != null) {
                    reject('Error')
                    return
                }
                if (response.status === 200) {
                    // 也可以通过检查 CF-Ray 响应头获取更准确的地区，这里简化处理
                    resolve('Available')
                } else if (response.status === 403) {
                    resolve('Not Available')
                } else {
                    reject('Error')
                }
            })
        })
    }

    let res = 'ChatGPT: '
    await inner_check()
        .then((status) => {
            if (status === 'Available') {
                res += '已解锁 ➟ 支持'
            } else {
                res += '不支持解锁 🚫'
            }
        })
        .catch(() => {
            res += '检测失败 🛠️'
        })
    return res
}

// --- 原有 YouTube 检测 ---
async function check_youtube_premium() {
    let inner_check = () => {
      return new Promise((resolve, reject) => {
        let option = {
          url: 'https://www.youtube.com/premium',
          headers: REQUEST_HEADERS,
        }
        $httpClient.get(option, function (error, response, data) {
          if (error != null || response.status !== 200) {
            reject('Error')
            return
          }
          if (data.indexOf('Premium is not available in your country') !== -1) {
            resolve('Not Available')
            return
          }
          let region = ''
          let re = new RegExp('"countryCode":"(.*?)"', 'gm')
          let result = re.exec(data)
          if (result != null && result.length === 2) {
            region = result[1]
          } else if (data.indexOf('www.google.cn') !== -1) {
            region = 'CN'
          } else {
            region = 'US'
          }
          resolve(region)
        })
      })
    }
    let youtube_check_result = 'YouTube: '
    await inner_check()
      .then((code) => {
        if (code === 'Not Available') {
          youtube_check_result += '不支持解锁'
        } else {
          youtube_check_result += '已解锁 ➟ ' + code.toUpperCase()
        }
      })
      .catch((error) => {
        youtube_check_result += '检测失败，请刷新面板'
      })
    return youtube_check_result
}

// --- 原有 Netflix 检测 ---
async function check_netflix() {
    let inner_check = (filmId) => {
      return new Promise((resolve, reject) => {
        let option = {
          url: 'https://www.netflix.com/title/' + filmId,
          headers: REQUEST_HEADERS,
        }
        $httpClient.get(option, function (error, response, data) {
          if (error != null) {
            reject('Error')
            return
          }
          if (response.status === 403) {
            reject('Not Available')
            return
          }
          if (response.status === 404) {
            resolve('Not Found')
            return
          }
          if (response.status === 200) {
            let url = response.headers['x-originating-url'] || response.headers['Location'] || ''
            let region = 'US' 
            if (url.includes('/')) {
                region = url.split('/')[3].split('-')[0]
                if (region === 'title') region = 'US'
            }
            resolve(region)
            return
          }
          reject('Error')
        })
      })
    }
    let netflix_check_result = 'Netflix: '
    await inner_check(81280792)
      .then((code) => {
        if (code === 'Not Found') return inner_check(80018499)
        netflix_check_result += '已完整解锁 ➟ ' + code.toUpperCase()
        return Promise.reject('BreakSignal')
      })
      .then((code) => {
        if (code === 'Not Found') return Promise.reject('Not Available')
        netflix_check_result += '仅解锁自制剧 ➟ ' + code.toUpperCase()
        return Promise.reject('BreakSignal')
      })
      .catch((error) => {
        if (error === 'BreakSignal') return
        if (error === 'Not Available') {
          netflix_check_result += '该节点不支持解锁'
          return
        }
        netflix_check_result += '检测失败'
      })
    return netflix_check_result
}

// --- 原有 Disney+ 检测函数 (保持不变) ---
async function testDisneyPlus() {
    try {
        let { region, cnbl } = await Promise.race([testHomePage(), timeout(7000)])
        let { countryCode, inSupportedLocation } = await Promise.race([getLocationInfo(), timeout(7000)])
        region = countryCode ?? region
        if (inSupportedLocation === false || inSupportedLocation === 'false') {
          return { region, status: STATUS_COMING }
        } else {
          return { region, status: STATUS_AVAILABLE }
        }
      } catch (error) {
        if (error === 'Not Available') return { status: STATUS_NOT_AVAILABLE }
        if (error === 'Timeout') return { status: STATUS_TIMEOUT }
        return { status: STATUS_ERROR }
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
        $httpClient.post(opts, function (error, response, data) {
            if (error || response.status !== 200) {
                reject('Not Available')
                return
            }
            data = JSON.parse(data)
            if(data?.errors) {
                reject('Not Available')
                return
            }
            let {
                session: {
                    inSupportedLocation,
                    location: { countryCode },
                },
            } = data?.extensions?.sdk
            resolve({ inSupportedLocation, countryCode })
        })
    })
}

function testHomePage() {
    return new Promise((resolve, reject) => {
        let opts = {
            url: 'https://www.disneyplus.com/',
            headers: { 'Accept-Language': 'en', 'User-Agent': UA },
        }
        $httpClient.get(opts, function (error, response, data) {
            if (error || response.status !== 200 || data.indexOf('not available in your region') !== -1) {
                reject('Not Available')
                return
            }
            let match = data.match(/Region: ([A-Za-z]{2})[\s\S]*?CNBL: ([12])/)
            if (!match) {
                resolve({ region: '', cnbl: '' })
                return
            }
            resolve({ region: match[1], cnbl: match[2] })
        })
    })
}

function timeout(delay = 5000) {
    return new Promise((resolve, reject) => {
        setTimeout(() => { reject('Timeout') }, delay)
    })
}
