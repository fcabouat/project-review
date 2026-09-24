# Guide utilisateur

project-review fait tourner une revue mensuelle de projets à partir d'un seul
portefeuille. On saisit les projets une fois ; tout le diaporama — dashboards,
tableau récapitulatif, fiches projet, décisions, archives — est dérivé de ces
données. Les slides libres portent un récit complémentaire facultatif.

L'application est un seul fichier multilingue : elle démarre dans la langue
du navigateur (français si le navigateur l'annonce, anglais sinon) et change
de langue à tout moment. Le guide anglais est [user-guide.md](user-guide.md).

## Démarrer

Pour découvrir l'application ou utiliser votre portefeuille :

- **Démo en lecture seule.** [Découvrez l'éditeur avec des données fictives](https://fcabouat.github.io/project-review/demo/project-review.html?sample&lang=fr).
  Elle est en lecture seule, ne lit ni n'écrit le portefeuille du navigateur ;
  le menu de langue échange l'ensemble du jeu français/anglais.
- **Utiliser en ligne.** Consultez les [limites de sécurité](#online-security)
  avant de saisir vos propres données dans cet éditeur complet.
- **Version autonome, hors ligne.** Téléchargez `project-review.html` et double-cliquez
  dessus. L'application tourne en `file://` — pas de serveur, pas de réseau,
  pas de compte.

Le stockage dépend de l'origine et du profil du navigateur, pas d'un compte.
Exportez/importez le JSON pour passer de l'éditeur en ligne au fichier local ou
changer d'appareil : il n'y a pas de synchronisation automatique. Gardez des
copies dans les deux modes. Pour développer, suivez le [README](../README.md),
puis lancez `pnpm run dev`.

La langue d'affichage est détectée au premier lancement et se change à tout
moment par le menu de langue de la barre du haut (ou dans les
[Paramètres](#apparence)).

## Premier portefeuille

L'application démarre vide : aucun projet, et une identité vierge — au
premier lancement, renseignez votre organisation (nom, service, contact,
logo) dans **Paramètres**. La date de revue est celle du jour.

Pour voir un exemple complet, importez le jeu Projay Inc. : 20 projets
dans 8 catégories. L'application elle-même ne transporte aucun contenu — des
portefeuilles d'exemple accompagnent l'app (`sample-portfolio.fr.json` à côté
du fichier téléchargé) et le site du projet ; importez-en un par
**Importer…**, comme n'importe quel portefeuille. L'import est une seule
entrée d'historique — Ctrl+Z l'annule. Le lien facultatif « Découvrir avec un exemple »
(`?sample`) ouvre ce même jeu en lecture seule. **Remplacer le portefeuille**
restaure tout le fichier ; **Panacher — choisir quoi importer** affiche
d'abord un aperçu : choisissez les blocs revue/langue/identité (logo
compris)/thème/affichage, puis les catégories, projets et slides libres
individuellement. Une identité connue conserve la version locale : son remplacement
ou l'ajout d'une copie indépendante demande un choix explicite. Rien de
non sélectionné n'est supprimé. Un profil d'apparence ne contient que
paramètres et catégories et se mélange uniquement.

<!-- Toutes les captures de ce guide sont refaites par une seule commande,
     jamais à la main : `node scripts/stage-doc-images.mjs` — voir l'en-tête
     de ce script. -->
<img src="images/fr-review.png" width="720" alt="Vue Revue : titre, sous-titre, dates et slides libres">

Ensuite :

- **Revue** porte le cadre du diaporama : titre, sous-titre, dates de revue,
  et toutes les slides libres (ouverture, avant une catégorie ou clôture).
  Chacune a un titre, une position et des blocs de texte ; les flèches
  **Monter** / **Descendre** règlent l'ordre à une même position.
- **Projets** liste le portefeuille ; **+ Ajouter un projet** en crée un.
- **Paramètres** porte l'identité, l'apparence, les catégories, les slides
  d'agrégat et l'administration des données ; chaque
  projet appartient à une catégorie.

Chaque vue est une adresse : `#/review`, `#/projects`, `#/settings`,
`#/history` — et `#/sheet/<identifiant-technique>` pour une fiche projet. Les entrées de la barre
latérale sont de vrais liens, les boutons précédent/suivant du navigateur
retracent la navigation, et l'URL d'une fiche se met en favori ou se partage
comme lien profond, même en `file://`.

## Saisir

<img src="images/fr-projects.png" width="720" alt="Vue Projets : le portefeuille groupé par catégorie">

Cliquez une ligne de projet (ou son crayon) pour ouvrir sa fiche. L'éditeur de
fiche a cinq onglets : **Identité**, **Suivi**, **Décisions**,
**Jalons & dates**, **Options**.

<img src="images/fr-sheet.png" width="720" alt="Éditeur de fiche : identité et état d'un projet">

- Le crayon et le bouton **⋯** se trouvent en fin de ligne. Ce dernier ouvre le menu : **Monter**,
  **Descendre** et **Supprimer** (avec confirmation).
- Les changements sont enregistrés quand les champs perdent le focus. Le texte
  et la date d'une décision prise se valident ensemble. La fermeture ou le
  rechargement valide les brouillons complets et valides avant sauvegarde ;
  les brouillons bruts, même incomplets ou invalides, sont sauvegardés séparément
  après 1,5 seconde de pause, ou après 10 secondes de frappe continue, sans ajouter
  d'étape d'annulation. Après rechargement, retrouvez-les dans les mêmes champs.
  Le document et les diaporamas exportés changent seulement après validation.
  Les filtres de recherche et les dialogues de confirmation (comme la suppression)
  restent des états d'interface temporaires.
  Vérifiez l'état de sauvegarde et conservez des copies JSON.
- Annuler/rétablir conserve jusqu'à 500 actions, avec un plafond mémoire
  supplémentaire : **Ctrl+Z** / **Ctrl+Y**, ou les flèches de la barre du haut.
  Les entrées les plus anciennes sont abandonnées.
- La vue **Historique** liste les actions enregistrées en termes métier et
  montre la position courante ; on y remonte ou redescend le fil des
  changements.
- Le bouton **Aperçu de la slide** (œil) rend la slide qu'un projet ou une
  slide libre produira, sans générer tout le diaporama.

### Périmètre et actions groupées

Dans **Identité → Périmètre (tags)**, saisissez par exemple `#site-nord` ou
`#equipe-06`, puis **Entrée**, une virgule ou **Ajouter**. Après `#`, seuls `a–z`,
`0–9` et `-` sont acceptés : 63 caractères maximum, jusqu'à 32 tags par projet.
À la saisie, les majuscules deviennent des minuscules et les `_` deviennent des tirets.
Le préfixe `#` est ajouté si nécessaire et les doublons sont ignorés après normalisation. Les tags déjà
utilisés dans le portefeuille sont proposés pour réutiliser le même vocabulaire ;
la croix d'un tag le retire uniquement du projet courant. Le champ de précisions libres
n'est plus proposé. Les anciens fichiers peuvent encore contenir `scope` : cette donnée
reste lisible et conservée à l'export, sans conversion implicite lors d'un import.
Les tags figurent dans la liste et les synthèses, et la recherche les prend en compte.
Sur les slides, l'affichage des tags et des métadonnées est borné à deux lignes pour
préserver la mise en page ; leur texte complet reste disponible au survol et dans le JSON.

Dans **Projets**, activez **Sélectionner**, cochez les lignes souhaitées ou
**Tout sélectionner (visible)**, puis choisissez une **catégorie** ou une **étape**
et **Appliquer à la sélection**. Seuls les projets sélectionnés actuellement visibles
sont concernés : les résultats masqués par la recherche et les archives repliées ne
sont pas modifiés. Toute l'opération s'annule en une fois ; aucune suppression groupée
n'est proposée.

## Le diaporama dérivé

Sur le jeu d'exemple, le diaporama fait 34 slides : une slide libre
d'ouverture, la slide de titre, le dashboard du portefeuille, le dashboard de
santé, le tableau récapitulatif, un intercalaire par catégorie suivi des
fiches projet, les décisions attendues, les archives, et le relevé des
décisions précédentes. Tout est dérivé du portefeuille au moment de la
génération ; les slides ne s'éditent jamais directement — on change les
données.

Qu'un projet ait ou non une fiche se règle par son option **Affichage de la slide de détail**
(onglet Options, ou les raccourcis A/T/J de la liste des projets) :

- **Auto** — fiche affichée si le projet est prêt, en cours ou en reliquats,
  ou s'il porte une décision attendue.
- **Toujours** — fiche affichée quoi qu'il arrive.
- **Jamais** — le projet n'apparaît que dans le récapitulatif.

Les boutons gardent ces libellés courts ; l'explication du choix actif apparaît dessous.

**Paramètres > Diaporama** active ou coupe le dashboard de santé, le
récapitulatif, les archives et les slides de décisions.

Sur une fiche, la première décision en attente est affichée ; à défaut, la
dernière décision prise et sa date apparaissent. Le relevé des décisions prises
couvre la période entre la revue précédente et la revue actuelle, bornes incluses.
Sans date de revue précédente, il inclut toutes les décisions prises jusqu'à la
date de revue. Les projets archivés sont exclus de ce relevé. Activez les slides
de décisions dans les paramètres pour le présenter.

Les tableaux d'archives et de décisions sont paginés automatiquement. Le résumé
des retards montre cinq entrées et le nombre d'entrées supplémentaires. Les slides
libres conservent tous leurs blocs, mais avertissent au-delà de trois : vérifiez
le rendu des contenus denses avant diffusion. Des marqueurs de gras excessivement
répétés s'affichent littéralement ; le texte d'origine reste conservé.

## Diaporama

Cliquez **Générer le diaporama ▸** dans la barre du haut. Dans **Paramètres >
Diaporama**, choisissez **Par sections** (par défaut) : gauche/droite passe
d'une section à l'autre et haut/bas parcourt ses slides ; ou **Linéaire** :
gauche/droite parcourt toutes les slides dans l'ordre, sans pile verticale.
Ce choix est enregistré dans le portefeuille et conservé dans l'export HTML
autonome. L'impression et la numérotation des pages restent identiques.
**Échap** ouvre la vue d'ensemble ; un clic rezoome.

<img src="images/fr-navigation.png" width="420" alt="Paramètres du diaporama : navigation Par sections ou Linéaire">

En l'absence de `settings.navigation` dans un portefeuille v4, la navigation
par sections est utilisée par défaut.

<img src="images/fr-slide.png" width="720" alt="Une fiche projet du diaporama, style flat">

Amener la souris en haut de l'écran fait apparaître une barre : **Retour à
l'éditeur**, **Vue d'ensemble**, **Plein écran**, **Enregistrer**,
**Imprimer**, **Fermer**.

**Enregistrer** télécharge `slideshow-{date}.html` : une copie autonome du
diaporama, en lecture seule. Elle s'ouvre en `file://` sans réseau et s'envoie
comme un seul fichier. Une police embarquée dans le portefeuille voyage dans
l'export ; sinon la police du thème doit exister chez le lecteur, faute de
quoi le diaporama retombe sur la pile système — l'impression PDF, elle,
embarque toujours les glyphes.

## Imprimer

Cliquez **Imprimer** dans la barre du diaporama, puis passez par le dialogue
d'impression du navigateur pour enregistrer un PDF. La mise en page est A4
paysage, une page par slide — 34 pages sur le jeu d'exemple. L'impression
Chrome est la seule voie PDF ; il n'y a pas de bouton d'export.

## Import & export

**Exporter…** (barre latérale) montre le portefeuille en JSON, avec un bouton
**Copier** et un bouton **Télécharger .json**. Le fichier s'appelle
`project-review-{date}.json`, où la date est la date de revue. Des cases à
cocher groupées par catégorie (toutes cochées par défaut) restreignent
l'export aux projets sélectionnés : le fichier se nomme alors
`…-partial.json` et reste un portefeuille valide à lui seul — voir
[Travailler à plusieurs](#travailler-à-plusieurs).

**Importer…** accepte un fichier déposé, un fichier choisi ou du JSON collé.
Un fichier valide affiche sa volumétrie (projets, catégories, slides libres)
et propose deux modes : **Remplacer tout le portefeuille** applique le fichier
en une action annulable, **Panacher — choisir quoi importer** permet de
sélectionner explicitement blocs et éléments
— voir [Travailler à plusieurs](#travailler-à-plusieurs). Un fichier invalide
est refusé en bloc, avec la liste complète de ses problèmes — chaque ligne
pointe l'endroit fautif du fichier (`projects[2].stage`, par exemple) pour le
corriger et recoller ; rien n'est importé tant que le fichier n'est pas
valide.

Un profil d'apparence ne contient que paramètres et catégories et se mélange
uniquement ; il ne peut pas remplacer un portefeuille. Changer manuellement la
langue modifie l'interface et les libellés des slides, jamais vos textes.

## Travailler à plusieurs

Pas besoin de serveur pour travailler en équipe : chacun édite dans sa propre
copie de l'application, et les fichiers voyagent comme vous voulez
(messagerie, partage de fichiers…).

1. **Distribuer.** Dans **Exporter…**, cochez les projets d'un collègue (les
   cases sont groupées par catégorie) et envoyez-lui le fichier
   `project-review-{date}-partial.json` — ou le fichier complet. Un export
   partiel est un portefeuille valide à lui seul : il embarque les projets
   cochés, leurs catégories, la revue et vos réglages courants.
2. **Contribuer.** Le collègue ouvre le fichier dans sa propre copie de
   l'application (import, mode remplacer), met à jour SES projets, puis vous
   renvoie son export.
3. **Panacher.** Importez le fichier reçu et choisissez **Panacher — choisir
   quoi importer**. Rien n'est sélectionné implicitement : choisissez les
   catégories et projets désirés, ainsi que les blocs revue, langue, identité,
   thème ou affichage. Les blocs non cochés préservent revue, identité,
   présentation et slides libres. Une identité inconnue est ajoutée. Une identité
   connue inchangée est ignorée ; si son contenu diffère, comparez les changements
   puis conservez la version locale, prenez le projet importé en entier ou ajoutez
   une copie indépendante. Aucun rapprochement ne repose sur le titre ou la référence métier.
   Choisissez les catégories nécessaires ou rattachez-les à vos catégories locales.
   Le remplacement d'une catégorie modifie aussi l'apparence des projets locaux qui l'utilisent.
   Aucun élément n'est supprimé et aucune fusion champ par champ n'est effectuée.

<img src="images/fr-import-merge.png" width="720" alt="Le panachage : choix des projets à importer, conflits et récapitulatif avant validation">

Le panachage est une seule entrée d'historique : **Ctrl+Z** le défait en bloc.

### Identités et références

Un nouveau projet reçoit un identifiant technique aléatoire, stable et non modifiable.
Il est conservé dans les exports et consultable/copiable dans **Options → Métadonnées du projet**.
La **référence métier** est facultative : vide, elle ne réserve aucune colonne ni aucun
emplacement dans les slides. Elle ne sert jamais à identifier une mise à jour.
La **Dernière modification**, au même endroit, indique le jour local de création ou
de dernière modification réelle du contenu. Elle ne change pas pour une valeur inchangée
ou un déplacement dans la liste ; plusieurs modifications le même jour gardent la même
date. Annuler/rétablir restaure ensemble contenu et date, sans étape supplémentaire.
Les imports conservent la date portée par le fichier, sans la remplacer par le jour d'import.

Le porteur est affiché dans la liste et sous le titre dans les récapitulatifs. La pagination
du récapitulatif est plafonnée à **6 projets par page avec des tags**, sinon **10 avec des
porteurs**, même si une densité supérieure est demandée ; un réglage inférieur est respecté.

Le champ JSON `version` indique la **version du format de données**, indépendamment
de la version de l'application. Le schéma JSON `packages/core/samples/portfolio.schema.json`
est suivi dans Git, ainsi que les jeux d'exemple fictifs ; vos portefeuilles personnels
ne sont ni ajoutés ni envoyés au dépôt par l'application. Les changements incompatibles
du format nécessitent une nouvelle version ; un changement d'interface n'en nécessite pas.

Le format courant est **v4**. Avant de passer d'une ancienne version à celle-ci,
exportez votre portefeuille. Les JSON v3 nécessitent une conversion externe ponctuelle ;
ils ne sont pas migrés automatiquement, pas plus que l'historique et les brouillons.
Une ancienne sauvegarde navigateur non lisible reste récupérable, elle n'est pas effacée silencieusement.
Après conversion, partagez le même fichier v4 : convertir séparément deux anciennes copies
leur donnerait des identités distinctes.

Un profil d'apparence (`project-review-appearance.json`) exporte uniquement les
paramètres et catégories ; importez-le par Panacher, jamais par Remplacer.

## Données & confidentialité

L'application ne transmet pas le contenu des portefeuilles à un serveur et
n'utilise ni compte ni télémétrie applicative. En ligne, l'hébergeur reçoit les
requêtes nécessaires au chargement des fichiers, des exemples demandés et des
éventuelles polices déployées. GitHub Pages journalise notamment les adresses IP
des visiteurs pour la sécurité : [documentation GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection).
Le fichier autonome ouvert hors ligne n'a pas besoin de ces requêtes.

<a id="online-security"></a>

### Utilisation en ligne : avertissement de sécurité

Les pages sous `fcabouat.github.io` partagent une même origine navigateur,
même si elles appartiennent à des dépôts différents. Un script compromis sur
un autre site de cette origine pourrait lire le portefeuille, l'historique et
les brouillons dans le même profil navigateur. **Cela ne rend pas les données
publiques**, mais le stockage local n'isole pas ces sites entre eux.
[Fonctionnement du stockage navigateur](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API).

Ne saisissez pas de données confidentielles sur ce déploiement partagé.
Préférez le fichier hors ligne ou un hébergement de confiance sur une origine
dédiée à l'application, séparée des autres applications et catalogues de documentation.
Changer uniquement le chemin ou la clé de stockage ne suffit pas. Le fichier
hors ligne dépend lui aussi de la sécurité du poste et du navigateur. Gardez
des sauvegardes JSON.

[Ouvrir l'éditeur en ligne](https://fcabouat.github.io/project-review/demo/project-review.html?lang=fr)
pour des données non confidentielles.

### Sauvegarde et récupération

- **Sauvegarde locale (localStorage)** — active par défaut. La base, les brouillons et
  l'historique annuler/rétablir sont enregistrés ENSEMBLE, sous une seule clé :
  un « annuler » ne peut donc jamais être rejoué sur un document auquel il
  n'appartient pas. Ils survivent au rechargement. Les points de sauvegarde réduisent
  les pertes sans garantir une perte nulle : le navigateur peut retarder les timers,
  ou planter avant la prochaine écriture. Importer ou supprimer des éléments écarte
  les brouillons obsolètes ; modifier un autre champ, ou annuler sa modification, les conserve.
  Désactiver la sauvegarde efface aussi les brouillons enregistrés ; la base ouverte reste intacte
  jusqu'à la fermeture de l'onglet.
- **Un retour de sauvegarde discret** — un indicateur dans le champ édité
  indique une saisie en attente ou sauvegardée. Son libellé accessible distingue
  le brouillon sauvegardé de la modification validée. Les sauvegardes normales
  n'ajoutent plus de bandeau permanent.
  Si le navigateur refuse l'écriture —
  stockage plein, navigation privée, profil restreint — un avertissement visible le dit et
  propose **Télécharger une copie** du document validé et **Télécharger les brouillons**
  pour les textes bruts absents de l'export JSON normal. Ce dernier fichier sert
  à récupérer les textes par lecture/copie, pas à importer un portefeuille.
- **La sauvegarde désactivée ailleurs** — la préférence appartient au
  navigateur, pas à l'onglet. Si un autre onglet désactive la sauvegarde
  locale, le vôtre arrête d'écrire et efface ce qu'il avait déjà enregistré,
  le dit et propose **Télécharger une copie** — le document ouvert reste à
  l'écran : ce choix de confidentialité ne se réactive que depuis
  **Paramètres ▸ Données**, par vous.
- **Deux onglets de l'application** — ils partagent un seul stockage. Si un
  autre onglet enregistre pendant que le vôtre est ouvert, le vôtre le signale
  aussitôt et n'écrit RIEN par-dessus : vous choisissez entre charger la
  version de l'autre onglet (annulable) et garder la vôtre. Rien n'est jamais
  fusionné à votre insu.
- **Purger la base** — vide catégories, projets et slides libres ; la revue et
  les paramètres sont conservés. Annulable.
- **Réinitialiser les réglages** — retour au thème et à l'affichage par
  défaut ; langue et identité sont conservées. Annulable.

## Sur téléphone ou tablette

L'éditeur s'adapte sous les largeurs de bureau : la barre latérale devient un
tiroir derrière le bouton ☰, les formulaires et les lignes de projets s'empilent,
et les tableaux larges (comme les jalons) défilent latéralement dans leur propre
cadre — la page, elle, ne défile jamais horizontalement. Le diaporama réduit
ses slides 16:9 à la taille de l'écran, et sa barre de sortie reste visible
sur écran tactile. Tout fonctionne sur téléphone ; un poste de travail reste
simplement plus confortable pour saisir.

## Apparence

<img src="images/fr-settings.png" width="720" alt="Vue Paramètres : identité, apparence et catégories — les interrupteurs de slides d’agrégat et la carte Données suivent plus bas">

La carte distingue les préférences de l'interface et l'apparence des slides.

**Paramètres > Apparence** :

- **Thème de l'interface** — Système (défaut), Clair ou Sombre. Une
  préférence de l'appareil, rangée hors du fichier de portefeuille :
  l'éditeur bascule, les slides restent claires (elles sont l'artefact). Les
  trois mêmes états sont dans le menu de schéma de la barre du haut, à côté
  du menu de langue.
- **Langue** — français ou anglais ; le changement redessine l'application à
  chaud. La langue se change aussi par le menu de langue de la barre du
  haut.

**Paramètres > Apparence > Apparence des slides** — thème, palette, police et
logo. Ces choix suivent le portefeuille dans le fichier `.json`, export
autonome et impression compris.

- **Thème** — Flat (défaut), Institutionnel ou Moderne. Il habille les slides,
  indépendamment du thème clair/sombre de l'interface.

- **Palette** — Material (défaut), Tailwind ou Uniforme. Elle résout les douze
  couleurs de catégorie ; les slides ne nomment jamais une couleur, seulement
  une catégorie.
- **Police** — Roboto et Inter sont fournies avec l'application, Roboto sert
  de défaut. Aucune police n'est téléchargée auprès d'un tiers : une famille
  vient de l'une des trois sources locales, et le statut vivant de la carte dit
  laquelle s'applique — embarquée dans le portefeuille (voir ci-dessous, elle
  gagne toujours), fournie avec l'application, ou servie par le déploiement.
  Pour cette dernière, déposez les woff2 dans un dossier portant le nom de la
  famille, à côté de l'application — `fonts/<famille>/<famille>-Regular.woff2`,
  `…-Medium.woff2`, `…-Bold.woff2` — et la carte nomme les fichiers exacts
  qu'elle a cherchés. Une famille qu'aucune des trois ne couvre s'affiche sur
  la pile système, et la carte le dit plutôt que de vous laisser le découvrir.
- **Logo** — la marque de votre organisation, embarquée dans le fichier (SVG
  ou PNG, 300 Ko max) ; sans logo, le diaporama n'en affiche aucun. Rien n'est
  embarqué dans l'application : la marque du jeu d'exemple appartient au jeu
  d'exemple, portée par son `.json` comme n'importe quelle autre.

Une palette, une police ou un logo importés restent soumis à leurs droits
propres — les embarquer dans un fichier diffusé constitue une redistribution :
vérifiez que leur licence l'autorise. La licence MIT de ce logiciel ne s'y
étend pas. La carte le dit une fois, pour les trois ensemble.

### Une palette à vous

Un portefeuille peut porter ses douze couleurs plutôt que de choisir parmi les
familles fournies. Il n'y a pas d'éditeur de couleurs : une palette est une
DONNÉE, elle arrive donc avec le fichier de données. Ajoutez un bloc
`customPalette` à `settings.theme` — un `label` facultatif et une table
`colors` portant exactement les douze noms de catégorie, chacun en
hexadécimal à six chiffres :

```json
"theme": {
  "style": "modern",
  "palette": "material",
  "font": "Roboto",
  "customPalette": {
    "label": "Couleurs maison",
    "colors": {
      "blue": "#3460d8", "indigo": "#7a4ecf", "teal": "#017661",
      "cyan": "#016770", "green": "#027a1f", "olive": "#666f02",
      "amber": "#7e5e01", "orange": "#a35301", "red": "#c52b30",
      "purple": "#a43cab", "brown": "#7d4e2c", "taupe": "#6b6456"
    }
  }
}
```

Douze noms, ni plus ni moins : une table incomplète est refusée à la porte,
chaque couleur manquante ou fautive nommée à son propre chemin. Une fois
chargée, la palette prend la tête de la liste dans la carte — sous votre
libellé, avec un aperçu — et elle S'APPLIQUE : les familles fournies attendent
que vous la retiriez. **Retirer** fait exactement cela, et c'est annulable
comme toute autre modification.

C'est ainsi qu'une organisation transmet ses couleurs à ses collègues : un
`.json` portant la palette maison, importé comme n'importe quel fichier.

### Police embarquée

<!-- La mise en scène de celle-ci — palette + deux fontes + logo, le seul
     écran qu'aucun jeu d'exemple ne produit — vit dans ce même script. -->
<img src="images/fr-embedded-font.png" width="720" alt="La carte Apparence, moitié identité du portefeuille : la liste des palettes menée par les douze couleurs du portefeuille, le champ Police avec son statut vivant « Police embarquée dans le portefeuille », les deux fontes embarquées avec leur graisse et leur taille, les deux sélecteurs, le logo, et l’unique ligne de licence qui couvre les trois">

La zone **Police embarquée** de la même carte embarque des fichiers `.woff2`
— choisis un à un ou par dossier entier — DANS le portefeuille, en data URI.
La variante de chaque fichier se lit dans son nom (`…-Thin` → 100, `…-ExtraLight` →
200, `…-Light` → 300, `…-Regular` → 400, `…-Medium` → 500, `…-SemiBold` → 600,
`…-Bold` → 700, `…-ExtraBold` → 800, `…-Black` → 900, `…-Italic` → italique), chaque
fonte est listée avec sa famille, sa graisse et sa taille, et se retire d'un
bouton. Une famille embarquée n'exige ni déploiement ni réseau :
l'application, l'export autonome et l'impression utilisent les fontes portées
par le fichier — mettez le nom de famille dans le champ **Police** et la
ligne de statut répond « Police embarquée dans le portefeuille ». Les tailles
sont plafonnées (~400 Ko par fonte, ~1,5 Mo au total) pour garder le
portefeuille portable.

Pour habiller le diaporama de la typographie de votre organisation : nom de
votre famille maison dans le champ **Police**, puis embarquez ses woff2 ici,
pour que le diaporama emporte sa police partout.
