/**
 * Configuration for transporters
 * Configuration by transporter :
 * @param {Integer} enabled
 * @param {Object|String} endpoints sended as first arg with connect() method
 */
module.exports = {
  transporters: {
    axon: {
      enabled: process.env.AGENT_TRANSPORT_AXON || true,
      endpoints: {
        push: process.env.AGENT_PUSH_ENDPOINT || 'push',
        pull: process.env.AGENT_REVERSE_ENDPOINT || 'reverse'
      }
    },
    websocket: {
      enabled: process.env.AGENT_TRANSPORT_WEBSOCKET || false,
      endpoints: process.env.AGENT_WEBSOCKET_ENDPOINT || 'websocket'
    }
  }
}
