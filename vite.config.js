import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'local-weather-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const names = { '/api/forecast': 'forecast', '/api/satellite': 'satellite', '/api/satellite-image': 'satellite-image' };
        if (!names[url.pathname]) return next();
        res.status = code => { res.statusCode = code; return res; };
        res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
        res.send = data => res.end(data);
        req.query = Object.fromEntries(url.searchParams);
        try {
          const { default: handler } = await import(`./api/${names[url.pathname]}.js`);
          await handler(req, res);
        } catch (error) {
          res.status(503).json({ error: error.message || 'Weather data is temporarily unavailable.' });
        }
      });
    }
  }]
});
