import ZeroFrame from 'zeroframe-ws-client'

class ZeroApp extends ZeroFrame {
  onRequest (cmd, message) {
    if (cmd === 'helloWorld') {
      this.log('Hello World')
    }
  }
}

const zeroapp = new ZeroApp('1HeLLo4uzjaLetFx6NH3PMwFP3qbRbTf3D')

zeroapp.cmdp('siteInfo').then((result) => {
  console.log(result)
})
