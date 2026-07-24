// Évite de répéter try/catch dans chaque controller async.
// Toute erreur (y compris une erreur SQL) est transmise à next(),
// qui la fait remonter jusqu'au middleware d'erreur global.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;