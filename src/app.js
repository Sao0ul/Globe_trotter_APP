const express = require('express');
const cors = require('cors');
const path = require('path');

// middlewares
const errorHandler = require('./middlewares/errorHandler');

// routes
const authRoutes = require('./routes/authRoutes');
const sitesRoutes = require('./routes/sitesRoutes');
const userRoutes = require('./routes/userRoutes');
const itineraireRoutes = require('./routes/itineraireRoutes');
const sitedetailsRoutes = require('./routes/sites-detailsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

// Sert le frontend
app.use(express.static(path.join(__dirname, '../public')));

// Racine → login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.use('/api/sites', sitesRoutes);
app.use('/api/sites/details', sitedetailsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/itineraire', itineraireRoutes);

// Gestion des erreurs
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
}

module.exports = app;