// The picture library (@vercel/og) is an ES module, and Vercel runs this site's functions as CommonJS, where require()
// cannot load an ES module: importing it at the top of api/booking-card.ts stopped that function on every request
// (fix for D1). A dynamic import() loads it from CommonJS on any Node version, and is traced into the function.
module.exports = () => import('@vercel/og');
