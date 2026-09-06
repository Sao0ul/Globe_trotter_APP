const express = require('express');
const cors = require('cors');
const http = require('http');

// middlewares
const errorHandler = require('./middlewares/errorHandler');

// routes
const authRoutes = require('./routes/authRoutes');
const sitesRoutes = require('./routes/sitesRoutes');
const userRoutes = require('./routes/userRoutes');
const itineraireRoutes = require('./routes/itineraireRoutes');
const sitedetailsRoutes = require('./routes/sites-detailsRoutes');
const messageRoutes = require('./routes/messageRoutes');
const commentsRoutes = require('./routes/comments.routes');

const app = express();
const PORT = process.env.PORT;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.use('/api/sites', sitesRoutes);
app.use('/api/sites/details', sitedetailsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/itineraire', itineraireRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/conversations', require('./routes/mediaRoutes'));
app.use('/api', commentsRoutes);

//gestion des erreurs doit être après toutes les routes, sinon elles ne seront pas interceptées
app.use(errorHandler);

// ---- NOUVEAU : serveur HTTP explicite + Socket.io greffé dessus ----
const server = http.createServer(app);
require('./services/socketServer')(server);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
}

module.exports = app;