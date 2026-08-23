const express = require('express');
const cors = require('cors');

// middlewares
const errorHandler = require('./middlewares/errorHandler');

// routes
const authRoutes = require('./routes/authRoutes');
const sitesRoutes = require('./routes/sitesRoutes');
const userRoutes = require('./routes/userRoutes');
const itineraireRoutes = require('./routes/itineraireRoutes');
const sitedetailsRoutes = require('./routes/sites-detailsRoutes');

const app = express();
const PORT = process.env.PORT;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.use('/api/sites', sitesRoutes);
app.use('/api/sites/details', sitedetailsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/itineraire', itineraireRoutes);

// Gestionnaire d'erreurs en dernier
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
}

module.exports = app;