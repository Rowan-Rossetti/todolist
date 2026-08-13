# TaskFlow Pro 2.3.0

Application Todo Angular avec persistance locale via `localStorage`.

## Changements 2.3

- Une seule barre de recherche globale sous l'en-tête, sur toutes les pages.
- Suppression de la capture rapide et de la rangée de filtres sous la recherche.
- La recherche parcourt toutes les tâches, y compris les tâches terminées et archivées.
- Depuis le tableau de bord, saisir une recherche ouvre automatiquement la liste de résultats.
- Suppression des barres de progression de l'objectif quotidien ; le pourcentage démarre à 0 %.
- Correction d'une action « Archiver » dupliquée dans le menu des tâches.
- Les sous-tâches conservent leur propre progression, car elle décrit l'avancement interne d'une tâche.

## Lancer le projet

```bash
npm install
npm start
```

Puis ouvrir http://localhost:4200
