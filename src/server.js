const app = require('./app');
const { initialize } = require('./db/database');

// Initialize database tables
initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Library API server running on http://localhost:${PORT}`);
});
