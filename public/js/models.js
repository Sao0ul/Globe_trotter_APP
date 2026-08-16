// model.js
// Gère l'état de l'app (auth, route courante) et communique avec l'API.

const API_BASE = '/api';

export class AppModel {
  constructor() {
    this.token = localStorage.getItem('token');
    this.pseudo = localStorage.getItem('pseudo');
    this.currentRoute = 'dashboard';
  }

  isAuthenticated() {
    return !!this.token;
  }

  async login({ email, password }) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: password })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.erreur || 'Échec de connexion');
    }

    const data = await res.json();
    this.token = data.token;
    this.pseudo = data.username;  // ← corrigé, c'était data.pseudo
    localStorage.setItem('token', this.token);
    localStorage.setItem('pseudo', this.pseudo);
  }
  
  async loginWithGoogle(credential) {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Échec de connexion Google');
    }

    const data = await res.json();
    this.token = data.token;
    this.pseudo = data.username;
    localStorage.setItem('token', this.token);
    localStorage.setItem('pseudo', this.pseudo);
  }

  logout() {
    this.token = null;
    this.pseudo = null;
    localStorage.removeItem('token');
    localStorage.removeItem('pseudo');
  }

  async fetchAvecAuth(url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    if (res.status === 401) {
      this.logout();
      throw new Error('session expirée');
    }

    return res.json();
  }

  async getProfile() {
    return this.fetchAvecAuth(`${API_BASE}/users/me`);
  }

  async getSites() {
    return this.fetchAvecAuth(`${API_BASE}/sites`);
  }

  async getDashboardData() {
    const sites = await this.getSites();
    const mesSites = sites.filter(s => s.auteur === this.pseudo);

    return {
      welcomeMessage: `Bienvenue, ${this.pseudo} !`,
      stats: [
        { label: 'Total des sites', value: sites.length },
        { label: 'Mes contributions', value: mesSites.length },
        { label: 'Note moyenne globale', value: sites.length ? (sites.reduce((a, s) => a + s.moyenne, 0) / sites.length).toFixed(1) : '—' }
      ]
    };
  }

  async getVisites() {
    const sites = await this.getSites();
    return sites.map(s => ({
      name: s.titre,
      country: s.localisation,
      description: s.description,
      imageUrl: s.imageUrl
    }));
  }
}
