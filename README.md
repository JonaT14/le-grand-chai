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

Le site utilise un service Google Apps Script distinct pour partager l’accès à Gemini entre tous les appareils. Dans **Comptes, Drive Kava 20 & Clé IA → 3. Google IA**, le bouton **Vérifier la connexion IA** contrôle sa configuration. Aucune saisie de clé n’est nécessaire sur un nouveau navigateur. Le choix du modèle reste propre à chaque appareil ; le modèle par défaut est `gemini-3.8-flash`.

La clé est une propriété privée `GEMINI_API_KEY` du projet Apps Script, jamais une variable Vite, une valeur du dépôt, un paramètre d’URL ni une réponse au navigateur. Le service possède uniquement l’autorisation `script.external_request` et n’accède pas à Drive. Les sauvegardes existantes et leur adresse sont indépendantes et inchangées. Voir [la procédure de maintenance](google-apps-script/README.md).

L’adresse du service IA est configurée dans `src/ai-config.js` ; `VITE_AI_PROXY_URL` peut la remplacer lors du build. Une valeur explicitement vide conserve le mode historique avec clé locale, y compris la migration de `kava20_gemini_key`. Ce mode permet les tests de régression et les installations autonomes. Une ancienne clé locale n’est jamais transmise au service partagé.

- **Scanner** : photographie → réduction de taille / conversion JPEG → lecture Gemini → fiche à vérifier. Les informations illisibles restent vides. En cas d'erreur, l'utilisateur peut réessayer ou conserver la photo et saisir les informations manuellement. Les dates de garde du formulaire sont des valeurs à adapter, pas des informations lues sur l'étiquette.
- **Sommelier IA** : suggestions de plats ou recherche libre → analyse Google de l'inventaire → explication, service et alternative cliquable. Les identifiants de bouteilles absentes de la cave sont refusés. Aucun résultat local simulant une réponse IA n'est affiché.
- **Recréer avec Google IA** (vins uniquement) : Google décrit le style connu, puis une illustration est dessinée localement. C'est une reconstitution, pas la photographie d'une étiquette officielle.
- **Chercher une vraie photo** (vins uniquement) : les adresses proviennent des sources réellement retournées par Google Image Search, pas d’un texte JSON généré. La recherche utilise `gemini-3.1-flash-image` et `googleSearch.searchTypes.imageSearch`. Les images générées éventuelles ne sont jamais utilisées. Les droits et quotas du modèle image sont nécessaires. À défaut de résultat, recherche Open Food Facts / Wikimedia Commons avec filtrage du nom et du millésime. Les photos renvoient directement à leur page source ; un bouton séparé ouvre la vérification et le recadrage.
- **Vérifier et recadrer** : lecture visuelle par Gemini, comparaison du domaine, de la cuvée et de l’année, proposition de cadre autour de l’étiquette, ajustement manuel et confirmation avant application. En cas de doute ou d’échec Google, la photo peut être vérifiée manuellement. Un mode « bouteille entière » conserve les sérigraphies et les formes particulières. Les photographies sont chargées directement quand le site autorise leur lecture, puis via wsrv.nl en secours.
- **Château Margaux 2015** : référence photographique vérifiée, utilisable sans clé de recherche. Ce millésime porte une sérigraphie sur verre, différente de l’étiquette papier habituelle. La référence ne correspond ni au troisième vin « Margaux du Château Margaux » ni aux autres millésimes. [Photo et fiche source](https://www.wine.com/product/chateau-margaux-2015/153459), [description du producteur](https://chateau-margaux.com/en/vins/grand-vin-du-chateau-margaux).
- **Cidres, poirés et spiritueux** : aucun bouton de recherche ou reconstitution IA d’étiquette. Les photos personnelles et le recadrage manuel restent disponibles. Le scanner de fiche et le sommelier gardent leurs fonctions existantes.

La sélection de photos exactes dépend des sources disponibles. Les photos distantes sont chargées directement lorsque le site l’autorise, avec wsrv.nl comme solution de secours, puis enregistrées dans la cave. Une image interdite d'accès ou une page Web à la place d'une image produit un message d'erreur.

## Scanner d’étiquettes, codes-barres et import en masse

Le bouton **Scanner** propose trois modes, pour les vins, cidres / poirés et spiritueux :

- **Étiquette** : photo prise avec le téléphone ou choisie dans la galerie, lecture Google IA puis fiche éditable avec domaine / cuvée, appellation, millésime, région et cépages. Aucun ajout automatique avant validation. Une photo illisible reste récupérable pour une saisie manuelle.
- **Code-barres** : photo d’un EAN / UPC (8, 12, 13 ou 14 chiffres avec chiffre de contrôle valide), ou saisie de ses chiffres. Le décodage se fait sur l’appareil avec le lecteur natif et ZXing en secours ; un lecteur natif qui ne répond pas laisse la place au secours après 1,5 seconde. Les métadonnées proviennent de l’API v3 Open Food Facts, sans appel Google IA. Le catalogue peut être incomplet ou erroné : la fiche reste à vérifier. **Le code-barres ne garantit pas le millésime : ce champ reste vide**, même si le nom du produit contient une année. Les produits qui ne sont pas identifiés comme des vins, cidres ou spiritueux sont refusés. Un code inconnu et sa photo peuvent être conservés dans une fiche manuelle.
- **Import en masse** : jusqu’à **20 photos par lot**, étiquettes IA ou codes-barres. L’analyse démarre sur demande, une photo après l’autre, avec au moins 6,5 secondes entre les départs pour respecter les limites des services. Les quotas Google partagés restent applicables. Un échec de clé, de connexion ou de quota arrête les appels suivants et conserve les fiches déjà analysées. L’analyse peut être arrêtée puis reprise sans relire les fiches terminées.

Chaque fiche du lot peut être corrigée, exclue ou retirée avant l’ajout : nom, appellation, millésime, région, catégorie, type et quantité. Les doublons potentiels dans le lot sont signalés. Une référence déjà en cave peut être réapprovisionnée explicitement ; sa photo, sa note personnelle (y compris zéro), ses notes et son casier sont conservés. Par défaut, une nouvelle fiche est créée dans un casier libre.

L’ajout du lot est atomique : toutes les fiches sélectionnées sont validées et leurs emplacements planifiés avant une unique écriture locale. Une cave pleine, un champ invalide ou une mémoire pleine ne peut pas enregistrer un lot partiel. Les fiches restent à l’écran pour corriger la sélection ou réessayer. La fermeture / annulation et un changement de cave empêchent toute réponse tardive de remplir une autre cave.

La photo garde son cadrage complet, sans cadre ni ombrage ajoutés ; elle est réduite à 720 pixels sur son côté le plus long et enregistrée en JPEG pour limiter la mémoire utilisée. Elle accompagne la fiche dans la cave et les sauvegardes. Le code-barres et le lien source catalogue sont également conservés dans les sauvegardes et exports. Les photos de codes-barres ne sont pas envoyées à Open Food Facts : seul le numéro décodé est recherché. Le lecteur ZXing est chargé uniquement quand une photo de code-barres l’exige.

Source catalogue : [Open Food Facts](https://world.openfoodfacts.org), sous [licence ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Le lien vers la référence source est affiché dans les fiches identifiées. Documentation : [API v3](https://openfoodfacts.github.io/openfoodfacts-server/api/) et [lecteur ZXing](https://github.com/zxing-js/browser).

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

Les tests vérifient les requêtes, le traitement des réponses, les erreurs et les parcours d'interface avec des réponses simulées. Le service partagé, une requête Gemini et un accord du sommelier sur la cave de démonstration ont aussi été vérifiés en réel depuis un navigateur sans clé locale. La précision de lecture sur les photographies personnelles et les droits des modèles de recherche d’images restent dépendants du projet Google. Aucun déploiement ni fusion sur `main` n'est effectué par ces tests.

## Formats, bouchages et service

- Toutes les boissons ont une contenance modifiable (cl, stockée en ml) et un bouchage dans la fiche et lors de l'ajout. Le vin reçoit 75 cl par défaut ; les anciennes références de cidre et de spiritueux restent de contenance inconnue. Les grands formats sont nommés avec leur volume, car « jéroboam » varie selon la région.
- Le scan lit la contenance uniquement si visible. Le catalogue de codes-barres fournit la quantité par bouteille lorsqu'elle est explicite ; le total d'un lot n'est pas utilisé comme taille de bouteille. Toujours vérifier avant validation. Les formats différents ne sont pas proposés pour un même réapprovisionnement.
- Le plan affiche la contenance et permet de filtrer par volume et par capacité pour un événement (stock × portions entières par bouteille). La portion par convive est modifiable ; il s'agit d'un calcul de capacité. Les contenances inconnues sont exclues de ce calcul.
- Les conseils de température, d'aération et de décantation apparaissent automatiquement par style et millésime. Un horaire de repas permet de préparer l'ouverture et, si un dépôt est suspecté, le redressement de la bouteille. Les repères généraux sont indicatifs et ne remplacent pas les consignes du producteur ni une vérification à l'ouverture.
- « Affiner avec Google IA » produit un conseil adapté aux métadonnées de la cuvée et le conserve dans la sauvegarde. Une modification du format, du bouchage ou des données de la cuvée invalide ce conseil ; les repères généraux restent disponibles. Aucun appel IA n'est lancé à l'ouverture d'une fiche. Les anciennes notes de dégustation et dates de garde sont conservées.
- L'effet du format sur la garde est décrit qualitativement : aucun multiplicateur d'années n'est appliqué. La cire ne permet pas de connaître la nature du bouchon sous-jacent.

## Aperçu des capteurs par mur

Le haut du plan affiche une température et une hygrométrie **simulées** pour le mur sélectionné dans la cave active. Le nom du mur et de la cave identifient la zone concernée ; changer de mur actualise cet aperçu. Aucun indicateur n'est affiché sous les bouteilles. La case « Afficher la démo des capteurs » masque l'aperçu. Aucun matériel n'est connecté, aucune date de mesure ou alerte réelle n'est fabriquée. Ces valeurs sont associées au mur de la cave et ne sont pas enregistrées dans les stocks, les sauvegardes, le carnet ou les requêtes IA. Le raccordement réel sera défini avec le matériel choisi.

## Présentation des murs en bois

Chaque mur est présenté comme un meuble de cave en chêne clair : corniche portant son nom, montants et étagères continus, fond en bois, séparations droites ou croisées et étiquettes façon caisses de vin. Le veinage est un SVG local, sans chargement de photographie externe. Les séparations décoratives restent liées aux coordonnées du casier et n'affectent ni les emplacements ni la capacité enregistrée. Les noms, formats, stocks, repères et pastilles d'apogée restent visibles. Sur téléphone, le meuble défile horizontalement dans son cadre ; les casiers s'ouvrent aussi au clavier avec Entrée ou Espace.
