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
- **Recréer avec Google IA** (vins uniquement) : Google décrit le style connu, puis une illustration est dessinée localement. C'est une reconstitution, pas la photographie d'une étiquette officielle.
- **Chercher une vraie photo** (vins uniquement) : les adresses proviennent des sources réellement retournées par Google Image Search, pas d’un texte JSON généré. La recherche utilise `gemini-3.1-flash-image` et `googleSearch.searchTypes.imageSearch`. Les images générées éventuelles ne sont jamais utilisées. Les droits et quotas du modèle image sont nécessaires. À défaut de résultat, recherche Open Food Facts / Wikimedia Commons avec filtrage du nom et du millésime. Les photos renvoient directement à leur page source ; un bouton séparé ouvre la vérification et le recadrage.
- **Vérifier et recadrer** : lecture visuelle par Gemini, comparaison du domaine, de la cuvée et de l’année, proposition de cadre autour de l’étiquette, ajustement manuel et confirmation avant application. En cas de doute ou d’échec Google, la photo peut être vérifiée manuellement. Un mode « bouteille entière » conserve les sérigraphies et les formes particulières. Les photographies sont chargées directement quand le site autorise leur lecture, puis via wsrv.nl en secours.
- **Château Margaux 2015** : référence photographique vérifiée, utilisable sans clé de recherche. Ce millésime porte une sérigraphie sur verre, différente de l’étiquette papier habituelle. La référence ne correspond ni au troisième vin « Margaux du Château Margaux » ni aux autres millésimes. [Photo et fiche source](https://www.wine.com/product/chateau-margaux-2015/153459), [description du producteur](https://chateau-margaux.com/en/vins/grand-vin-du-chateau-margaux).
- **Cidres, poirés et spiritueux** : aucun bouton de recherche ou reconstitution IA d’étiquette. Les photos personnelles et le recadrage manuel restent disponibles. Le scanner de fiche et le sommelier gardent leurs fonctions existantes.

La sélection de photos exactes dépend des sources disponibles. Les photos distantes sont chargées directement lorsque le site l’autorise, avec wsrv.nl comme solution de secours, puis enregistrées dans la cave. Une image interdite d'accès ou une page Web à la place d'une image produit un message d'erreur.

## Caves indépendantes et échange de sauvegardes

Dans **Comptes → Caves Familiales**, « Ajouter une cave » crée une cave vide avec son nom, son propriétaire facultatif et un premier mur. Il n’y a pas de limite arbitraire au nombre de caves ; la capacité de stockage du navigateur reste la limite réelle. Chaque cave a un identifiant distinct et sa propre sauvegarde. Les caves existantes sont conservées.

Pour transmettre une cave à d’autres personnes :

1. Sélectionner la cave à transmettre.
2. Télécharger sa sauvegarde JSON et transmettre le fichier aux personnes choisies.
3. Chaque destinataire ouvre le site puis utilise « Importer une cave ».

L’import crée une nouvelle cave sans remplacer les caves existantes. Le nom, les murs, les bouteilles, les photographies et le carnet de dégustation sont inclus. Les anciennes sauvegardes JSON restent acceptées. Les clés Google et les paramètres Drive ne sont jamais inclus dans le fichier. Les copies évoluent indépendamment : **pas de synchronisation automatique entre appareils**, conformément au fonctionnement demandé. Aucun nouveau service d’hébergement n’est requis.

Le logo utilise l’image fournie dans `public/images/cave-grand-chai.jpeg`, à 88 × 88 pixels (contre 44 × 44 auparavant), sur ordinateur et téléphone.

## Quantités de bouteilles

Une fiche peut représenter un lot de bouteilles identiques, pour toutes les boissons : vin, cidre, poiré, spiritueux et autres alcools.

- Le formulaire d’ajout propose un nombre entier de bouteilles, égal à 1 par défaut.
- La fiche de chaque référence permet de corriger son stock ou d’utiliser les boutons − / +. Une correction de stock n’ajoute pas de dégustation au carnet.
- « Boire une bouteille » retire exactement une unité et ajoute une entrée au carnet. Le reste du lot, ses photos, ses notes et son emplacement sont conservés.
- À zéro, la fiche affiche « Stock épuisé », reste disponible pour être réapprovisionnée et ne peut plus être consommée ni recommandée par le sommelier. On peut aussi retirer cette fiche du casier après confirmation, en conservant le carnet.
- Les anciennes fiches et sauvegardes sans quantité comptent pour une bouteille. Les imports et exports conservent les quantités, y compris zéro.
- Les casiers affichent la quantité par référence et la cave affiche le total en bouteilles. Les compteurs de capacité des murs restent des compteurs de casiers occupés : un lot de 30 bouteilles est une seule référence dans un casier. Les compteurs de la carte totalisent les bouteilles.

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
