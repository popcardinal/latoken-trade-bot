const crypto = require('crypto');
const axios = require('axios');

let WEB_BASE = 'https://api.latoken.com'; 
let config = {
  'apiKey': '',
  'secret_key': '',
};
let log = {};

function sign_api(path, data, type = 'get') {

  const nonce = Date.now();
  let url = `${WEB_BASE}${path}`;
  const pars = [];
  for (const key in data) {
    const v = data[key];
    pars.push(key + '=' + v);
  }
  const queryString = pars.join('&');
  if (queryString && type !== 'post') {
    url = url + '?' + queryString;
  }

  const bodyString = JSON.stringify(data);
  const signPayload = type === 'get' ? queryString : bodyString;
  const sign = setSign(config.secret_key, `${signPayload}_${nonce}_${path}`);

  return new Promise((resolve, reject) => {
    try {

      const httpOptions = {
        url: url,
        method: type,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'Token': config.apiKey,
          'Nonce': nonce + '',
          'Signature': sign,
          'Type': 'api',
        },
        data: type === 'get' ? undefined : bodyString,
      };

      axios(httpOptions)
          .then(function(response) {
            try {
              const data = response.data;
              if (data) {
                if (data.status === 'error' && data.code === 429) { // 'API Call limit rate, please try again later
                  log.log(`Request to ${url} with data ${bodyString} failed. Got error message: ${data.msg}.`);
                  reject(`Got error message: ${data.msg}`);
                } else {
                  resolve(data);
                }
              } else {
                log.log(`Request to ${url} with data ${bodyString} failed. Unable to parse data: ${data}.`);
                reject(`Unable to parse data: ${data}`);
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                log.log(`Request to ${url} with data ${bodyString} failed. Unable to parse data: ${data}. Exception: ${e}`);
                reject(`Unable to parse data: ${data}`);
              } else {
                log.warn(`Error while processing response of request to ${url} with data ${bodyString}: ${e}. Data object I've got: ${data}.`);
                reject(`Unable to process data: ${data}`);
              }
            }
          })
          .catch(function(error) {
            // 'Order not found' goes here as it returns 404
            if (error.response && typeof error.response.data === 'object' && Object.keys(error.response.data).length !== 0) {
              resolve(error.response.data);
            } else {
              log.log(`Request to ${url} with data ${pars} failed. ${error}.`);
              reject(error);
            }
          }); // axios

    } catch (err) {
      log.log(`Processing of request to ${url} with data ${bodyString} failed. ${err}.`);
      reject(null);
    }
  });
}

function public_api(path, data, type = 'get') {

  let url = `${WEB_BASE}${path}`;
  const pars = [];
  for (const key in data) {
    const v = data[key];
    pars.push(key + '=' + v);
  }
  const queryString = pars.join('&');
  if (queryString && type !== 'post') {
    url = url + '?' + queryString;
  }

  return new Promise((resolve, reject) => {
    try {
      const httpOptions = {
        url: url,
        method: type,
        timeout: 10000,
      };

      axios(httpOptions)
          .then(function(response) {
            try {
              const data = response.data;
              if (data) {
                if (data.status === 'error' && data.code === 429) { // 'API Call limit rate, please try again later
                  // console.log(response);
                  log.log(`Request to ${url} with data ${queryString} failed. Got error message: ${data.msg}.`);
                  reject(`Got error message: ${data.msg}`);
                } else {
                  resolve(data);
                }
              } else {
                log.log(`Request to ${url} with data ${queryString} failed. Unable to parse data: ${data}.`);
                reject(`Unable to parse data: ${data}`);
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                log.log(`Request to ${url} with data ${queryString} failed. Unable to parse data: ${data}. Exception: ${e}`);
                reject(`Unable to parse data: ${data}`);
              } else {
                log.warn(`Error while processing response of request to ${url} with data ${queryString}: ${e}. Data object I've got: ${data}.`);
                reject(`Unable to process data: ${data}`);
              }
            };
          })
          .catch(function(error) {
            // We can get 404 with data
            if (error.response && typeof error.response.data === 'object' && Object.keys(error.response.data).length !== 0) {
              resolve(error.response.data);
            } else {
              log.log(`Request to ${url} with data ${queryString} failed. ${error}.`);
              reject(error);
            }
          }); // axios

    } catch (err) {
      log.log(`Request to ${url} with data ${queryString} failed. ${err}.`);
      reject(null);
    }
  });
}

function setSign(secret, str) {
  const sign = crypto
      .createHmac('sha512', secret)
      .update(`${str}`)
      .digest('hex');
  return sign;
}

const EXCHANGE_API = {

  setConfig: function(apiServer, apiKey, secretKey, tradePwd, logger, publicOnly = false) {

    if (apiServer) {
      WEB_BASE = apiServer;
    }

    if (logger) {
      log = logger;
    }

    if (!publicOnly) {
      config = {
        'apiKey': apiKey,
        'secret_key': secretKey,
      };
    }

  },

  /**
   * List of user balances for all currencies
   * @return {Object}
   */
   
  getBalances: function() {
    const data = {};
    return protectedRequest('/account/balances', data);
  },

  /**
   * Query account active orders
   * @param {String} pair required
   * @param {Number} limit min 1, default 50, max 100
   * @param {Number} offset min 0, default 0, max 10000
   * @return {Object}
   */
  getOrders: function(pair, offset = 0, limit = 100) {
    const data = {};
    if (pair) data.market = pair;
    if (offset) data.offset = offset;
    if (limit) data.limit = limit;

    return protectedRequest('/orders', data);
  },

  /**
   * Places a Limit order
   * @param {String} pair
   * @param {String} amount
   * @param {String} price
   * @param {String} side 'buy' or 'sell'
   */
  addOrder: function(pair, amount, price, side) {
    const data = {};
    data.market = pair;
    data.price = price;
    data.amount = amount;
    data.side = side;
    return protectedRequest('/order/new', data);
  },

  /**
   * Cancel an order
   * @param {String} orderId
   * @param {String} pair
   * @return {Object}
   */
  cancelOrder: function(orderId, pair) {
    const data = {};
    data.orderId = orderId;
    data.market = pair;
    return protectedRequest('/order/cancel', data);
  },

  /**
   * Get trade details for a ticker (market rates)
   * @param {String} pair
   * @return {Object}
   */
  ticker: function(pair) {
    const data = {};
    data.market = pair;
    return publicRequest('/public/ticker', data);
  },

  /**
   * Get market depth
   * @param pair
   * @param {Number} limit min 1, default 50, max 100
   * @return {Object}
   */
  orderBook: function(pair, limit = 100, interval = 0) {
    const data = {};
    data.market = pair;
    if (limit) data.limit = limit;
    if (interval) data.interval = interval;
    return publicRequest('/public/depth/result', data);
  },

  /**
   * Get info on all markets
   * @return string
   */
  markets: function() {
    const data = {};
    return publicRequest('/public/markets', data);
  },

};


module.exports = EXCHANGE_API;
