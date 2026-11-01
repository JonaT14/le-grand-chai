# Service Google IA du Grand Chai

Ce projet est distinct du script de sauvegarde Drive. **Ne jamais remplacer le code ou l’adresse du script de sauvegarde par ceux du service IA.** Le client vérifie la signature du service par GET avant chaque POST afin de ne pas écrire accidentellement une requête IA dans une sauvegarde.

## Installation

1. Créer un projet Google Apps Script privé, copier `Code.gs` et `appsscript.json`.
2. Dans les paramètres du projet, ajouter la propriété de script `GEMINI_API_KEY` avec la clé autorisée pour Gemini. Ne pas mettre cette valeur dans le code, le manifeste, le dépôt ou une variable commençant par `VITE_`.
3. Déployer une application web s’exécutant comme le propriétaire, accessible à « Tout le monde » si cet accès public est autorisé. Autoriser uniquement les requêtes externes ; ce projet n’a besoin d’aucun accès Drive.
4. Copier l’adresse `/exec` de ce nouveau déploiement dans `src/ai-config.js`, puis reconstruire et publier le site.
5. Vérifier le statut et une vraie analyse depuis un navigateur sans clé locale. Ne jamais publier les requêtes contenant des données privées dans les journaux.

Le service est accessible sans authentification pour permettre l’usage immédiat sur tous les appareils. Toute personne connaissant son adresse peut utiliser le quota partagé. **CORS n’est pas une authentification.** Les limites globales persistantes sont de 100 appels par jour UTC et 10 par minute UTC, avec verrou pour les appels concurrents. Les appels refusés par Google comptent aussi. Ces limites plafonnent le nombre de requêtes, pas un montant financier ; les quotas et la facturation du projet Google restent applicables. Un usage privé nécessiterait un système de connexion.

Le serveur impose une liste de modèles, une destination Google fixe, la validation des tailles des textes et photos, un maximum de 4 096 jetons de sortie et une liste limitée d’outils. Il reconstruit les instructions système et ignore les paramètres supplémentaires. Il ne renvoie ni les erreurs brutes Google, ni les images générées, ni le raisonnement interne. Les données de cave et photographies nécessaires à la demande sont envoyées au service puis à Gemini ; elles ne sont pas sauvegardées par ce code.

## Remplacement de la clé

Changer uniquement la propriété `GEMINI_API_KEY` dans les paramètres du projet privé. Cela prend effet immédiatement sur tous les appareils, sans nouveau build du site ni nouveau déploiement du script. Les éditeurs du projet Apps Script peuvent lire ses propriétés : ne pas partager le projet avec des tiers.

## Mise à jour du service

Modifier les sources, lancer `npm test`, puis modifier le déploiement existant pour publier une nouvelle version en conservant son adresse. Tester `doGet` (service `le-grand-chai-ai`, version `1`, `configured: true`) et un POST valide. Les tests locaux évaluent le même fichier `Code.gs` avec des doubles des services Google, sans clé réelle.

Les tests navigateur classiques désactivent le service via une variable de build vide et vérifient le mode historique. Les tests `playwright.ai.config.js` simulent le service partagé sur un téléphone neuf, sans clé locale. Les deux suites font partie de `npm run test:e2e`.
