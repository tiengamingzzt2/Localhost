const { handleRequest } = require('../server.js');

module.exports = async function handler(req, res) {
  return handleRequest(req, res);
};

