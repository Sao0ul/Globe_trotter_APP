const express = require('express');

//middlewares
const errorHandler = require('./middlewares/errorHandler');


//routes created 
const authRoutes = require('./routes/authRoutes');
const sitesRoutes = require('./routes/sitesRoutes');



const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));//servir du contenu statique

app.use('/api/sites', sitesRoutes);
app.use('/api/auth', authRoutes);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
