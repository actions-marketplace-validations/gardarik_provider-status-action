const httpm = require('@actions/http-client')
const cheerio = require('cheerio');

module.exports.checkStatus = async (providerStatusIdentifier) => {
    const [prov, pid] = providerStatusIdentifier.split('.')

    const statusResponse = {
        service: pid,
        status: 1,
        message: "UNKNOWN: ",
    }

    const response = await getHttp(`https://status.aws.amazon.com/rss/${pid}.rss`);
    
    const $ = cheerio.load(response,{ ignoreWhitespace : true, xmlMode : true});
    const [lastItem] = $('item') || null
    statusResponse.service = $('channel > title').text().replace(' Service Status','').replace('Amazon ','')
    if (lastItem) {
        const title = $('title', lastItem).text()
        const pubDate = $('pubDate', lastItem).text()
        statusResponse.message += ` [${pubDate}] ${title}` // default for UNKNOWN
        
        if (title.indexOf('Service is operating normally') === 0) {
            statusResponse.status = 0
            statusResponse.message = `Service is operating normally`
        }

        if (title.indexOf('Informational message') === 0 || title.indexOf('Performance issues') === 0 ) {
            statusResponse.status = 1
            statusResponse.message = `WARNING: [${pubDate}] ${title}`
        }
        
        if (title.indexOf('Service disruption') === 0) {
            statusResponse.status = 2
            statusResponse.message = `CRITICAL: [${pubDate}] ${title}`
        }        
    } else {
        statusResponse.status = 0
        statusResponse.message = `OK: No status events`
    }
    return Promise.resolve({provider: prov, pid, ...statusResponse});
}

const getHttp = async (url) => {
    const http = new httpm.HttpClient(url);
    return (await http.get(url)).readBody()
}