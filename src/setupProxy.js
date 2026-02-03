const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy authentication requests to backend
  app.use(
    '/auth',
    createProxyMiddleware({
      target: process.env.REACT_APP_AUTH_URL || 'http://localhost:5000',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying auth request:', req.method, req.path);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Auth response status:', proxyRes.statusCode);
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).send('Proxy error occurred');
      }
    })
  );

  // Proxy API requests if needed
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 'http://localhost:5000',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug'
    })
  );
};
