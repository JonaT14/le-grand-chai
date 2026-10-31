# Le Grand Chai

Application React / Vite de gestion de cave (vin, cidre et spiritueux).

## Développement et vérifications

Node.js 22 ou supérieur.

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Les tests de navigateur simulent Google et les images externes. Aucune clé réelle n'est requise, aucune requête Google payante n'est exécutée et aucune donnée de cave personnelle n'est utilisée. Pour les tests sur Linux, installer les dépendances Chromium avec `npx playwright install --with-deps chromium`.

## Google IA

Dans **Comptes, Drive Kava 20 & Clé IA → Clé API Gemini**, saisir une clé Google AI Studio autorisée pour la Gemini API. Le modèle par défaut est `gemini-3.8-flash`. Les modèles alternatifs peuvent être sélectionnés dans ce même écran ; `gemini-2.5-flash` est réservé aux projets auxquels Google en permet encore l'accès.

La clé précédemment enregistrée sous `kava20_gemini_key` reste reconnue. Elle est envoyée à Google dans l'en-tête `x-goog-api-key`, jamais dans l'adresse de la requête. L'application conserve le fonctionnement existant avec une clé personnelle dans le navigateur : aucune clé n'est incluse dans les sources ou le build. Ne pas ajouter de clé partagée à ce dépôt public.

- **Scanner** : photographie → réduction de taille / conversion JPEG → lecture Gemini → fiche à vérifier. Les informations illisibles restent vides. En cas d'erreur, l'utilisateur peut réessayer ou conserver la photo et saisir les informations manuellement. Les dates de garde du formulaire sont des valeurs à adapter, pas des informations lues sur l'étiquette.
- **Sommelier IA** : suggestions de plats ou recherche libre → analyse Google de l'inventaire → explication, service et alternative cliquable. Les identifiants de bouteilles absentes de la cave sont refusés. Aucun résultat local simulant une réponse IA n'est affiché.
- **Recréer avec Google IA** : Google décrit le style connu, puis une illustration est dessinée localement. C'est une reconstitution, pas la photographie d'une étiquette officielle.
- **Chercher une vraie photo** : recherche Google avec sources lorsque la clé est disponible ; à défaut de résultat, recherche Open Food Facts / Wikimedia Commons. L'utilisateur vérifie la cuvée et le millésime puis sélectionne l'image. Si aucune photo n'est trouvée, l'étiquette existante est conservée. Une photo personnelle ou une adresse directe d'image peut aussi être importée.

La sélection de photos exactes dépend des sources disponibles. Les images distantes passent par le service wsrv.nl pour être affichées puis sauvegardées dans la cave. Une image interdite d'accès ou une page Web à la place d'une image produit un message d'erreur.

## Murs, notes et données existantes

- Ajout, renommage et dimensionnement des murs (1 à 12 lignes / colonnes).
- Suppression après confirmation : les bouteilles sont déplacées vers les places libres du mur choisi. La suppression est refusée si la place manque ou si c'est le dernier mur.
- Une réduction ne peut pas masquer des bouteilles encore présentes dans les casiers retirés.
- Une cave pleine refuse l'ajout ; si le mur préféré est plein, un autre mur disponible est utilisé.
- Les notes personnelles de 0 à 5, par demi-point, sont modifiables avant et après dégustation. « Non noté » est distinct de 0/5.
- Les anciennes sauvegardes `kava20_walls_*`, `kava20_wines_*`, `kava20_history_*` sont récupérées par compte si aucune sauvegarde du nouveau format n'existe. Les clés originales sont conservées.
- Les anciennes étiquettes PNG sont conservées ; leurs dimensions ne suffisent pas à les considérer comme défectueuses.

Les données restent liées au navigateur et à l'adresse du site. Le bouton d'export JSON permet de les sauvegarder. Les modifications de cette branche ne migrent pas automatiquement des données vers une autre adresse de site.

## Origine des régressions corrigées

Comparaison entre `6ba9799` et `d5ecb6a` :

1. La clé Google a changé de nom dans le stockage sans migration.
2. Les appels sont passés de Gemini 2.5 Flash à Gemini 2.0 Flash, un modèle retiré par Google.
3. Le sommelier a été remplacé par quelques mots-clés avec un délai fixe de 450 ms. L'alternative calculée n'était plus affichée.
4. Le scanner masquait les erreurs et, sans clé, ouvrait une fiche sans reconnaissance. Certaines erreurs d'image pouvaient laisser l'interface bloquée. La version antérieure pouvait aussi remplir arbitrairement une fiche Pichon-Longueville Baron après un échec : ce comportement n'est pas repris.
5. La recherche de photo créait une illustration locale faute de résultat et l'annonçait comme « officielle ». La reconstitution est désormais identifiée comme telle ; les photos ne sont plus appliquées sans choix.
6. Les trois murs étaient figés ; réduire leurs dimensions pouvait masquer des bouteilles et un ajout dans un mur plein pouvait superposer des bouteilles.
7. La note personnelle était affichée sans contrôle de modification et une note de 0 était remplacée par 4,5 lors de l'archivage.

Références Google consultées le 31 octobre 2026 : [modèles retirés](https://ai.google.dev/gemini-api/docs/deprecations), [API generateContent](https://ai.google.dev/api/generate-content), [recherche Google](https://ai.google.dev/gemini-api/docs/google-search).

## Limites de validation

Les tests vérifient les requêtes, le traitement des réponses, les erreurs et les parcours d'interface avec des réponses simulées. Une vérification avec une vraie clé Google et une vraie photo reste nécessaire pour confirmer les droits, le quota, la disponibilité du modèle dans le projet et la précision de lecture sur les bouteilles de l'utilisateur. Aucun déploiement ni fusion sur `main` n'est effectué par ces tests.
