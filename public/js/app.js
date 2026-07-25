// app.js
import { AppModel } from './model.js';
import { AppView } from './view.js';

const model = new AppModel();
const view = new AppView();

async function afficherRoute(route) {
  if (!model.isAuthenticated()) {
    view.setLoginHandler(handleLogin);
    view.updateNavigation(false, route);
    return;
  }

  model.currentRoute = route;
  view.updateNavigation(true, route);

  try {
    switch (route) {
      case 'dashboard': {
        const data = await model.getDashboardData();
        view.renderDashboardPage(data);
        break;
      }
      case 'profile': {
        const data = await model.getProfile();
        view.renderProfilePage(data);
        break;
      }
      case 'visites': {
        const data = await model.getVisites();
        view.renderVisitesPage(data);
        break;
      }
      case 'about':
        view.renderAboutPage();
        break;
      default:
        view.renderNotFound();
    }
  } catch (err) {
    if (!model.isAuthenticated()) {
      afficherRoute('dashboard'); // redirige vers login
    }
  }
}

async function handleLogin({ email, password }) {
  try {
    await model.login({ email, password });
    window.location.hash = '#dashboard';
    afficherRoute('dashboard');
  } catch (err) {
    view.showMessage(err.message, 'error');
  }
}

function handleLogout() {
  model.logout();
  window.location.hash = '';
  afficherRoute('dashboard');
}

function handleNavigation(route) {
  window.location.hash = `#${route}`;
  afficherRoute(route);
}

view.setLogoutHandler(handleLogout);
view.setNavigationHandler(handleNavigation);
view.setSidebarToggleHandler(() => view.toggleSidebar());

window.addEventListener('hashchange', () => {
  const route = window.location.hash.replace('#', '') || 'dashboard';
  afficherRoute(route);
});

// démarrage
const routeInitiale = window.location.hash.replace('#', '') || 'dashboard';
afficherRoute(routeInitiale);