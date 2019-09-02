import recursiveAssign from 'recursive-object-assign'
import WebSocket from 'isomorphic-ws'
import fetch from 'cross-fetch'

const CMD_RESPONSE = 'response'
const CMD_PING = 'ping'
const CMD_PONG = 'pong'

/**
 * Client class for ZeroFrame WebSocket.
 */
class ZeroFrame {
  // Initialization & Connection

  /**
   * Construct the class and set up a connection to the WebSocket server.
   *
   * @param {string}                       site                                   - Target ZeroNet site address
   * @param {ZeroFrame#constructorOptions} [options=ZeroFrame#constructorOptions] - Client options
   */
  constructor (site, options = {}) {
    options = recursiveAssign(ZeroFrame.constructorOptions, options)

    if (!site) {
      throw new Error('Site address is not specified')
    }

    this.masterAddress = options.multiuser.masterAddress
    this.masterSeed = options.multiuser.masterSeed

    this.show = options.show
    this.reconnect = options.reconnect

    this.site = site
    this.host = options.instance.host
    this.port = options.instance.port
    this.secure = options.instance.secure

    this.url = 'http' + (this.secure ? 's' : '') + '://' + this.host + ':' + this.port + '/' + this.site

    this.websocketConnected = false
    this.waitingCallbacks = {}
    this.waitingMessages = []
    this.nextMessageId = 1
    this.nextAttemptId = 1

    /**
     * Proxy for accessing ZeroFrame commands.
     *
     * Command name is accepted as an object's property and parameters are accepted as
     * a method's arguments. Command returns `Promise` with the result.
     *
     * * Command with no arguments can be accessed with `zeroframe.proxy.cmdName()`.
     * * Command with keyword arguments can be accessed with `zeroframe.proxy.cmdName({key1: value1, key2: value2})`.
     * * Command with normal arguments can be accessed with `zeroframe.proxy.cmdName(value1, value2)`.
     *
     * @name ZeroFrame#proxy
     * @type Proxy
     */
    this.proxy = new Proxy(this, {
      get: function get (target, name) {
        return function () {
          if (arguments.length === 0) {
            return target.cmdp(name)
          }

          if (arguments.length === 1 && typeof arguments[0] === 'object' && arguments[0] !== null) {
            return target.cmdp(name, arguments[0])
          }

          const params = Array.prototype.slice.call(arguments)
          return target.cmdp(name, params)
        }
      }
    })

    this._connect()
  }

  /**
   * User-based initialization code.
   *
   * @return {ZeroFrame}
   */
  init () {
    return this
  }

  /**
   * Get wrapper key and connect to WebSocket.
   *
   * @return {ZeroFrame}
   *
   * @private
   */
  async _connect () {
    this.wrapperKey = await this._getWrapperKey()
    this.websocket = await this._getWebsocket()

    return this.init()
  }

  /**
   * Get and return wrapper key
   *
   * @return {string} - Wrapper key
   *
   * @private
   */
  async _getWrapperKey () {
    const wrapperRequest = await fetch(this.url, { headers: { Accept: 'text/html' } })
    const wrapperBody = await wrapperRequest.text()

    const wrapperKey = wrapperBody.match(/wrapper_key = "(.*?)"/)[1]

    return wrapperKey
  }

  /**
   * Connect and return WebSocket
   *
   * @return {object} - WebSocket connection
   *
   * @private
   */
  async _getWebsocket () {
    const wsUrl = 'ws' + (this.secure ? 's' : '') + '://' + this.host + ':' + this.port + '/Websocket?wrapper_key=' + this.wrapperKey
    let wsClient

    if (!this.masterAddress) {
      wsClient = new WebSocket(wsUrl)
    } else {
      wsClient = new WebSocket(wsUrl, [], { headers: { Cookie: 'master_address=' + this.masterAddress } })
    }

    wsClient.onmessage = this._onRequest.bind(this)
    wsClient.onopen = this._onOpenWebsocket.bind(this)
    wsClient.onerror = this._onErrorWebsocket.bind(this)
    wsClient.onclose = this._onCloseWebsocket.bind(this)

    return wsClient
  }

  // Internal handlers

  /**
   * Internal on request handler.
   *
   * It is triggered on every message from the WebSocket server.
   * It handles built-in commands and forwards others
   * to the user-based handler.
   *
   * @see ZeroFrame#onRequest
   *
   * @param {MessageEvent} event - Message event from the WebSocket library
   *
   * @return {void}
   *
   * @private
   */
  _onRequest (event) {
    const message = JSON.parse(event.data)
    const cmd = message.cmd

    if (cmd === CMD_RESPONSE) {
      if (this.waitingCallbacks[message.to] !== undefined) {
        this.waitingCallbacks[message.to](message.result)
        delete this.waitingCallbacks[message.to]
      }
    } else if (cmd === CMD_PING) {
      this.response(message.id, CMD_PONG)
    } else {
      this.onRequest(cmd, message)
    }
  }

  /**
   * Internal on open websocket handler.
   *
   * It is triggered when the WebSocket connection is opened.
   * It sends waiting message and calls the user-based handler.
   *
   * @see ZeroFrame#onOpenWebsocket
   *
   * @param {OpenEvent} event - Open event from the WebSocket library
   *
   * @return {void}
   *
   * @private
   */
  _onOpenWebsocket (event) {
    this.websocketConnected = true

    this.waitingMessages.forEach((message) => {
      if (!message.processed) {
        this.websocket.send(JSON.stringify(message))
        message.processed = true
      }
    })

    this.onOpenWebsocket(event)
  }

  /**
   * Internal on error websocket handler.
   *
   * It is triggered on the WebSocket error. It calls the user-based client.
   *
   * @see ZeroFrame#onErrorWebsocket
   *
   * @param {ErrorEvent} event - Error event from the WebSocket library
   *
   * @return {void}
   *
   * @private
   */
  _onErrorWebsocket (event) {
    this.onErrorWebsocket(event)
  }

  /**
   * Internal on close websocket handler.
   *
   * It is triggered when the WebSocket connection is closed.
   * It tries to reconnect if enabled and calls the user-based handler.
   *
   * @see ZeroFrame#onCloseWebsocket
   *
   * @param {CloseEvent} event - Close event from the WebSocket library
   *
   * @return {void}
   *
   * @private
   */
  _onCloseWebsocket (event) {
    this.websocketConnected = false

    this.onCloseWebsocket(event)

    if (this.reconnect.attempts === 0) {
      return
    }

    if (this.reconnect.attempts !== -1 && this.nextAttemptId > this.reconnect.attempts) {
      return
    }

    setTimeout(async () => {
      this.websocket = await this._getWebsocket()
    }, this.reconnect.delay)
  }

  // External handlers

  /**
   * User-based on request handler.
   *
   * It is triggered on every message from the WebSocket server.
   * It can be used to add additional functionalities to
   * the client or handle received messages.
   *
   * @param {string} cmd     - Name of received command
   * @param {object} message - Message of received command
   *
   * @return {void}
   */
  onRequest (cmd, message) {
    this.log('Unknown request', message)
  }

  /**
   * User-based on open websocket handler.
   *
   * It is triggered when the WebSocket connection is opened.
   * It can be used to notify user or check for server details.
   *
   * @param {OpenEvent} event - Open event from the WebSocket library
   *
   * @return {void}
   */
  onOpenWebsocket (event) {
    this.log('Websocket open')
  }

  /**
   * User-based on error websocket handler.
   *
   * It is triggered on the WebSocket error.
   * It can be used to notify user or display errors.
   *
   * @param {ErrorEvent} event - Error event from the WebSocket library
   */
  onErrorWebsocket (event) {
    this.error('Websocket error')
  }

  /**
   * User-based on close websocket handler.
   *
   * It is triggered when the WebSocket connection is closed.
   * It can be used to notify user or display connection error.
   *
   * @param {CloseEvent} event - Close event from the WebSocket library
   */
  onCloseWebsocket (event) {
    this.log('Websocket close')
  }

  // Logging functions

  /**
   * Add log to console if enabled.
   *
   * @param {...*} args Logs to add to console
   *
   * @return {void}
   */
  log (...args) {
    if (this.show.log) {
      console.log.apply(console, ['[ZeroFrame]'].concat(args))
    }
  }

  /**
   * Add error to console if enabled.
   *
   * @param {...*} args Errors to add to console
   *
   * @return {void}
   */
  error (...args) {
    if (this.show.error) {
      console.error.apply(console, ['[ZeroFrame]'].concat(args))
    }
  }

  // Command functions

  /**
   * Callback with command result.
   *
   * Result will depend on called command.
   *
   * In most cases, the result will be object which contains data.
   * Some commands don't have any result. In this case, the result
   * will probably be string `ok`.
   *
   * @see {@link https://zeronet.io/docs/site_development/zeroframe_api_reference/|ZeroFrame API Reference}
   *
   * @typedef {function((object|string))} ZeroFrame#cmdCallback
   * @callback ZeroFrame#cmdCallback
   *
   * @param {object|string} [result] - Result from command
   *
   * @return {void}
   */

  /**
   * Internally send raw message to ZeroFrame server and call callback.
   *
   * If the connection is available, it directly sends a message. If the
   * connection is not available, it adds message to waiting message queue.
   *
   * @see ZeroFrame#cmd
   * @see ZeroFrame#cmdp
   * @see ZeroFrame#response
   *
   * @param {object}                message - Message to send
   * @param {ZeroFrame#cmdCallback} [cb]    - Message callback
   *
   * @return {void}
   *
   * @private
   */
  _send (message, cb = null) {
    if (!message.id) {
      message.id = this.nextMessageId
      this.nextMessageId++
    }

    if (this.websocketConnected) {
      this.websocket.send(JSON.stringify(message))
    } else {
      this.waitingMessages.push(message)
    }

    if (cb) {
      this.waitingCallbacks[message.id] = cb
    }
  }

  /**
   * Send command to ZeroFrame server and call callback.
   *
   * @param {string}                cmd      - Name of command to send
   * @param {object}                [params] - Parameters of command to send
   * @param {ZeroFrame#cmdCallback} [cb]     - Command callback
   *
   * @return {void}
   */
  cmd (cmd, params = {}, cb = null) {
    this._send({
      cmd: cmd,
      params: params
    }, cb)
  }

  /**
   * Send command to ZeroFrame server and return the result as promise.
   *
   * In most cases, the result will be object which contains data.
   * Some commands don't have any result. In this case, the result
   * will probably be string `ok`.
   *
   * @see {@link https://zeronet.io/docs/site_development/zeroframe_api_reference/|ZeroFrame API Reference}
   *
   * @param {string} cmd      - Name of command to send
   * @param {object} [params] - Parameters of command to send
   *
   * @return {Promise<(object|string)>} Command response
   */
  cmdp (cmd, params = {}) {
    return new Promise((resolve, reject) => {
      this.cmd(cmd, params, (response) => {
        if (response && response.error) {
          reject(response.error)
        } else {
          resolve(response)
        }
      })
    })
  }

  /**
   * Response to ZeroFrame message.
   *
   * @param {number} cmd    - Message ID to response
   * @param {object} result - Result to send
   *
   * @return {void}
   */
  response (to, result) {
    this._send({
      cmd: CMD_RESPONSE,
      to: to,
      result: result
    })
  }
}

/**
 * Constructor's options structure with default values.
 *
 * @typedef {object} ZeroFrame#constructorOptions
 * @name ZeroFrame#constructorOptions
 *
 * @property {object}  [multiuser]                    - Multiuser options
 * @property {string}  [multiuser.masterAddress=null] - Master address for multiuser ZeroNet instance
 * @property {string}  [multiuser.masterSeed=null]    - Master seed for multiuser ZeroNet instance
 *
 * @property {object}  [instance]                     - Instance options
 * @property {string}  [instance.host=127.0.0.1]      - Host of ZeroNet instance
 * @property {number}  [instance.port=43110]          - Port of ZeroNet instance
 * @property {boolean} [instance.secure=false]        - Secure connection of ZeroNet instance
 *
 * @property {object}  [show]                         - Showing options
 * @property {boolean} [show.log=false]               - Show log messages in console
 * @property {boolean} [show.error=false]             - Show error messages in console
 *
 * @property {object}  [reconnect]                    - Reconnecting options
 * @property {number}  [reconnect.attempts=-1]        - Number of attempts (no limit with `-1` & no reconnect with `0`)
 * @property {number}  [reconnect.delay=5000]         - Number of delay in milliseconds
 */
ZeroFrame.constructorOptions = {
  multiuser: {
    masterAddress: null,
    masterSeed: null
  },
  instance: {
    host: '127.0.0.1',
    port: 43110,
    secure: false
  },
  show: {
    log: false,
    error: false
  },
  reconnect: {
    attempts: -1,
    delay: 5000
  }
}

try { module.exports = ZeroFrame } catch (err) { }

export default ZeroFrame
