ZeroFrameJS
===========

[![version][icon-version]][link-npm]
[![downloads][icon-downloads]][link-npm]
[![license][icon-license]][link-license]
[![node][icon-nodejs]][link-nodejs]
[![build][icon-travis]][link-travis]

ZeroFrame WebSocket API for JavaScript.

## Description

This is JavaScript WebSocket client for [ZeroFrame API][link-zeroframe]. It supports (almost) same features as default ZeroFrame that is included in ZeroNet sites, but it is using WebSocket client so it can be used in local programs, such as Node.js and Electron. It can't be used in browsers because of CORS restrictions.

## Installation

### Requirements

ZeroFrameJS requires Node.js 8 or higher.

### With Yarn

The recommended way to install ZeroFrameJS is with Yarn.

```bash
yarn add zeroframe-ws-client
```

### With NPM

Alternatively, you can also install it with NPM but it won't respect `yarn.lock` file.

```bash
npm install --save zeroframe-ws-client
```

## Usage

### Importing Package

You can import ZeroFrameJS with CJS or ESM.

```js
const ZeroFrame = require('zeroframe-ws-client') // Using CJS
import ZeroFrame from 'zeroframe-ws-client' // Using ESM
```

### Creating Connection

To create a connection, you need to specify the ZeroNet site address.

```js
const zeroframe = ZeroFrame('1HeLLo4uzjaLetFx6NH3PMwFP3qbRbTf3D')
```

If ZeroNet instance is using `Multiuser` plugin, you need to specify a master address of the account you want to use. Account must already exist on the instance.

```js
const zeroframe = ZeroFrame(
  '1HeLLo4uzjaLetFx6NH3PMwFP3qbRbTf3D', {
    multiuser: {
      masterAddress: '1Hxki73XprDRedUdA3Remm3kBX5FZxhFR3'
    }
})
```

If you want to create a new account, you also need to specify a master seed of it. Note that this feature is unsafe on the untrusted proxy. Also, it is currently not implemented yet.

```js
const zeroframe = ZeroFrame(
  '1HeLLo4uzjaLetFx6NH3PMwFP3qbRbTf3D', {
    multiuser: {
      masterAddress: '1KAtuzxwbD1QuMHMuXWcUdoo5ppc5wnot9',
      masterSeed: 'fdbaf75427ba69a3d4aa8e19372e05879e9e2d866e579dd30be25e6fab7e3fb2'
    }
})
```

If needed, you can also specify protocol, host and port of ZeroNet instance.

```js
const zeroframe = ZeroFrame(
  '1HeLLo4uzjaLetFx6NH3PMwFP3qbRbTf3D', {
    instance: {
      host: '192.168.1.1`,
      port: 8080,
      secure: true
    }
})
```

Log and error message from `zeroframe.log` and `zeroframe.error` will not be displayed by default. If you want to, you can also display them as debug info.

```js
const zeroframe = ZeroFrame(
  '1HeLLo4uzjaLetFx6NH3PMwFP3qbRbTf3D', {
    show: {
      log: true,
      error: true
    }
})
```

By default, the client will try to reconnect WebSocket if the connection was closed every 5 seconds. You can also configure time delay and total attempts. Delay is specified in milliseconds. The number of attempts `-1` means infinity and `0` means zero (disabled reconnecting).

```js
const zeroframe = ZeroFrame(
  '1HeLLo4uzjaLetFx6NH3PMwFP3qbRbTf3D', {
      reconnect: {
        attempts: 10,
        delay: 1000
      }
})
```

The client will then obtain wrapper key to the site and connect to WebSocket using it.

You can now normally use ZeroFrame API. Just remember that there is no wrapper, so wrapper commands are not available. The client is connected directly to the WebSocket server, so you need to use its commands.

Note that the WebSocket server sometimes sends commands (`notification`, `progress`, `error`, `prompt`, `confirm`, `setSiteInfo`, `setAnnouncerInfo`, `updating`, `redirect`, `injectHtml`, `injectScript`) that are normally handled by the wrapper. Because there is no wrapper, you need to handle those commands yourself if needed. Commands `response` and `ping` are already handled by this client so you don't need to handle them.

### Sending Command

You can use the `cmd` method to issue commands.

```js
zeroframe.cmd(
  'siteInfo',
  {},
  (result) => {
    console.log(result)
  }
)
```

You can also use the `cmdp` method to get results as JavaScript promises.

```js
let result = await zeroframe.cmd('siteInfo', {})
```

### Sending Response

To submit responses, you need to use `response` command.

```js
zeroframe.response(10, 'Hello World')
```

### Logging Information

There are also `log` and `error` methods which are available for logging. They will display output to console if enabled.

```js
zeroframe.log('Connected')
zeroframe.error('Connection failed')
```

### Handling Connection

There are also public handler methods which you can overwrite to add your own logic to ZeroFrame.

```js
class ZeroApp extends ZeroFrame {
  onRequest (cmd, message) {
    if (cmd === 'helloWorld') {
      this.log('Hello World')
    }
  }

  onOpenWebsocket (event) {
    this.log('Connected to WebSocket')
  }

  onErrorWebsocket (event) {
    this.error('WebSocket connection error')
  }

  onCloseWebsocket (event) {
    this.error('WebSocket connection closed')
  }
}
```

### Calling Commands Directly

You can also directly call commands via `Proxy` object. Command name is accepted as an object's property and parameters are accepted as a method's arguments. Command returns `Promise` with the result.

 * Command with no arguments can be accessed with `zeroframe.proxy.cmdName()`.
 * Command with keyword arguments can be accessed with `zeroframe.proxy.cmdName({key1: value1, key2: value2})`.
 * Command with normal arguments can be accessed with `zeroframe.proxy.cmdName(value1, value2)`.

```js
let siteInfo = await zeroframe.proxy.siteInfo()
```

### Other Examples

You could also look to [`example.js`][link-example] or [API documentation][link-documentation].

## Versioning

This library uses [SemVer][link-semver] for versioning. For the versions available, see [the tags][link-tags] on this repository.

## License

This library is licensed under the MIT license. See the [LICENSE][link-license-file] file for details.

[icon-version]: https://img.shields.io/npm/v/zeroframe-ws-client.svg?style=flat-square&label=version
[icon-downloads]: https://img.shields.io/npm/dt/zeroframe-ws-client.svg?style=flat-square&label=downloads
[icon-license]: https://img.shields.io/npm/l/zeroframe-ws-client.svg?style=flat-square&label=license
[icon-nodejs]: https://img.shields.io/node/v/zeroframe-ws-client.svg?style=flat-square&label=node
[icon-travis]: https://img.shields.io/travis/com/filips123/ZeroFrameJS.svg?style=flat-square&labelbuild

[link-npm]: https://www.npmjs.com/package/zeroframe-ws-client/
[link-license]: https://choosealicense.com/licenses/mit/
[link-nodejs]: https://nodejs.org/
[link-travis]: https://travis-ci.com/filips123/ZeroFrameJS/
[link-semver]: https://semver.org/

[link-tags]: https://github.com/filips123/ZeroFrameJS/tags/
[link-license-file]: https://github.com/filips123/ZeroFrameJS/blob/master/LICENSE
[link-example]: https://github.com/filips123/ZeroFrameJS/blob/master/example.js
[link-documentation]: https://zeroframe.js.org/

[link-zeroframe]: https://zeronet.io/
