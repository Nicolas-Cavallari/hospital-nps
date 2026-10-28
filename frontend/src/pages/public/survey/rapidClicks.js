/**
 * Detecta cliques em excesso: mais de `limit` cliques dentro de `windowMs`.
 * Só serve para exibir um aviso; nunca bloqueia nada. Depois de avisar, a contagem recomeça.
 */
export function createRapidClickDetector({ limit = 5, windowMs = 3000 } = {}) {
  let times = [];

  return {
    register(now = Date.now()) {
      times = times.filter((time) => now - time < windowMs);
      times.push(now);
      if (times.length > limit) {
        times = [];
        return true;
      }
      return false;
    },
  };
}
