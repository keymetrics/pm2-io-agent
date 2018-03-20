/**
 * Configuration for transporters
 * Configuration by transporter :
 * @param {Integer} enabled
 * @param {Object|String} endpoints sended as first arg with connect() method
 */
module.exports = {
  transporters: {
    axon: {
      enabled: true,
      endpoints: {
        push: process.env.PM2_PUSH_ENDPOINT || 'push',
        pull: process.env.PM2_REVERSE_ENDPOINT || 'reverse'
      }
    },
    websocket: {
      enabled: false,
      endpoints: process.env.PM2_WEBSOCKET_ENDPOINT || 'websocket'
    }
  }
}
