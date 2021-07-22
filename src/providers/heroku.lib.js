const httpm = require('@actions/http-client');
const status = require('../const');

module.exports.checkStatus = async (providerStatusIdentifier) => {
  const [prov, pid] = providerStatusIdentifier.split('.');

  const HerokuPidMap = {
    apps: 'Apps',
    data: 'Data',
    tools: 'Tools',
  };

  const serviceName = pid
    ? HerokuPidMap[pid]
    : Object.values(HerokuPidMap).join('/');
  console.debug('SERV NAME[%s] = ', pid, serviceName);
  const statusResponse = {
    service: serviceName,
    status: status.STATUS_WARNING,
    message: 'UNKNOWN: ',
  };

  try {
    const httpResponse = await getHttp(
      `https://status.heroku.com/api/v4/incidents`
    );
    const data = JSON.parse(httpResponse);

    if (data && data.length) {
      let icon = null;
      let title = null;
      let date = null;

      let incidents = data;
      if (pid) {
        statusResponse.service = HerokuPidMap[pid];
        incidents = data.filter((el) =>
          el.systems.map((x) => x.name).includes(HerokuPidMap[pid])
        );
      }

      const unresolved = incidents.filter((el) => el.state !== 'resolved');
      if (unresolved.length) {
        //check for red
        const red = incidents.filter((el) => el.systems.status === 'red');
        if (red && red.length) {
          icon = 'red';
          title = red[0].title;
          date = red[0].updated_at || red[0].created_at || null;
        } else {
          // check for yellow
          const yellow = incidents.filter(
            (el) => el.systems.status === 'yellow'
          );
          if (yellow && yellow.length) {
            icon = 'yellow';
            title = yellow[0].title;
            date = yellow[0].updated_at || yellow[0].created_at || null;
          }
        }
      } else {
        icon = 'green';
      }

      switch (icon) {
        case 'green':
          statusResponse.status = status.STATUS_OK;
          statusResponse.message = `No known issues at this time`;
          break;

        case 'red': 
          statusResponse.status = status.STATUS_ERROR;
          statusResponse.message = `[${date}] ${title}`;
          break;

        default:
        case 'yellow':
          statusResponse.status = status.STATUS_WARNING;
          statusResponse.message = `[${date}] ${title}`;
          break;
      }
    } else {
      statusResponse.status = status.STATUS_WARNING;
      statusResponse.message = `Couldn't retrive status`;
    }
    return Promise.resolve({ provider: prov, pid, ...statusResponse });
  } catch (e) {
    statusResponse.message = e.message;
    statusResponse.status = status.STATUS_WARNING;
    return Promise.resolve({ provider: prov, pid, ...statusResponse });
  }
};

const getHttp = async (url) => {
  const http = new httpm.HttpClient(url);
  const response = await http.get(url);
  if (response.message.statusCode != 200) {
    throw new Error(
      `${response.message.statusCode} ${response.message.statusMessage}`
    );
  }
  return response.readBody();
};
