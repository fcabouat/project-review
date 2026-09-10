# Guide utilisateur

project-review fait tourner une revue mensuelle de projets à partir d'un seul
portefeuille. On saisit les projets une fois ; tout le diaporama — dashboards,
tableau récapitulatif, fiches projet, décisions, archives — est dérivé de ces
données. Aucune slide ne s'édite à la main.

L'application est un seul fichier multilingue : elle démarre dans la langue
du navigateur (français si le navigateur l'annonce, anglais sinon) et change
de langue à tout moment. Le guide anglais est [user-guide.md](user-guide.md).

## Démarrer

Deux façons de lancer l'application :

- **Sans installation.** Téléchargez `project-review.html` et double-cliquez
  dessus. L'application tourne en `file://` — pas de serveur, pas de réseau,
  pas de compte.
- **Depuis les sources.** `bun install`, puis `bun run dev` et ouvrir l'URL
  affichée.

La langue d'affichage est détectée au premier lancement et se change à tout
moment par le menu de langue de la barre du haut (ou dans les
[Paramètres](#apparence)).

## Premier portefeuille

L'application démarre vide : aucun projet, et une identité vierge — au
premier lancement, renseignez votre organisation (nom, service, contact,
logo) dans **Paramètres**. La date de revue est celle du jour.

Pour voir un exemple complet, importez le jeu Déjà Vu Ltd. : 20 projets
dans 8 catégories. L'application elle-même ne transporte aucun contenu — des
portefeuilles d'exemple accompagnent l'app (`sample-portfolio.fr.json` à côté
du fichier téléchargé) et le site du projet ; importez-en un par
**Importer…**, comme n'importe quel portefeuille. L'import est une seule
entrée d'historique — Ctrl+Z l'annule. La démo en ligne prend le raccourci :
son adresse `?sample` démarre directement sur le même jeu.

<img src="images/fr-review.png" width="720" alt="Vue Revue : titre, sous-titre, dates et slides libres">

Ensuite :

- **Revue** porte le cadre du diaporama : titre, sous-titre, dates de revue,
  et les slides libres (chacune avec un titre, une ancre et des blocs de
  texte ; les flèches **Monter** / **Descendre** les réordonnent).
- **Projets** liste le portefeuille ; **+ Ajouter un projet** en crée un.
- **Paramètres** porte l'identité, le thème, les catégories, les slides
  libres, les slides d'agrégat et l'administration des données ; chaque
  projet appartient à une catégorie.

Chaque vue est une adresse : `#/review`, `#/projects`, `#/settings`,
`#/history` — et `#/sheet/P-01` pour une fiche projet. Les entrées de la barre
latérale sont de vrais liens, les boutons précédent/suivant du navigateur
retracent la navigation, et l'URL d'une fiche se met en favori ou se partage
comme lien profond, même en `file://`.

## Saisir

<img src="images/fr-projects.png" width="720" alt="Vue Projets : le portefeuille groupé par catégorie">

Cliquez une ligne de projet (ou son crayon) pour ouvrir sa fiche. L'éditeur de
fiche a cinq onglets : **Cadre & état**, **Récit**, **Décisions**,
**Jalons & dates**, **Options**.

<img src="images/fr-sheet.png" width="720" alt="Éditeur de fiche : onglet Cadre & état d'un projet">

- Le bouton **⋯** en tête de ligne ouvre le menu de la ligne : **Monter**,
  **Descendre** et **Supprimer** (avec confirmation).
- Un champ égale une entrée d'historique, enregistrée quand le champ perd le
  focus.
- Annuler/rétablir garde les 500 dernières actions : **Ctrl+Z** / **Ctrl+Y**,
  ou les flèches de la barre du haut. Toute action s'annule — saisies,
  imports, purges ; au-delà de 500 entrées, les plus anciennes sont
  abandonnées en silence.
- La vue **Historique** liste les actions enregistrées en termes métier et
  montre la position courante ; on y remonte ou redescend le fil des
  changements.
- Le bouton **Aperçu de la slide** (œil) rend la slide qu'un projet ou une
  slide libre produira, sans générer tout le diaporama.

## Le diaporama dérivé

Sur le jeu d'exemple, le diaporama fait 34 slides : une slide libre
d'ouverture, la slide de titre, le dashboard du portefeuille, le dashboard de
santé, le tableau récapitulatif, un intercalaire par catégorie suivi des
fiches projet, les décisions attendues, les archives, et le relevé des
décisions précédentes. Tout est dérivé du portefeuille au moment de la
génération ; les slides ne s'éditent jamais directement — on change les
données.

Qu'un projet ait ou non une fiche se règle par son option **Slide de détail**
(onglet Options, ou les raccourcis A/T/J de la liste des projets) :

- **Auto** — fiche affichée si le projet est prêt, en cours ou en reliquats,
  ou s'il porte une décision attendue.
- **Toujours** — fiche affichée quoi qu'il arrive.
- **Jamais** — le projet n'apparaît que dans le récapitulatif.

**Paramètres > Slides d'agrégat** active ou coupe le dashboard de santé, le
récapitulatif, les archives et les slides de décisions.

## Diaporama

Cliquez **Générer le diaporama ▸** dans la barre du haut. La navigation
fonctionne à tiroirs : les flèches gauche et droite passent d'une section à
l'autre, la flèche bas ouvre une catégorie et parcourt ses fiches. **Échap**
ouvre la vue d'ensemble ; un clic rezoome.

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
et propose deux modes : **Remplacer tout le portefeuille** (la voie
historique) applique le fichier en une action annulable, **Fusionner les
projets dans le portefeuille courant** intègre la contribution d'un collègue
— voir [Travailler à plusieurs](#travailler-à-plusieurs). Un fichier invalide
est refusé en bloc, avec la liste complète de ses problèmes — chaque ligne
pointe l'endroit fautif du fichier (`projects[2].stage`, par exemple) pour le
corriger et recoller ; rien n'est importé tant que le fichier n'est pas
valide.

En mode remplacement, la case **Conserver mes réglages et mon identité**
(cochée par défaut) rend l'import « contenu seul » : projets, catégories,
revue et slides libres sont remplacés, thème, logo, langue et affichage sont
conservés. Décochez-la pour prendre le fichier entier.

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
3. **Fusionner.** Importez le fichier reçu et choisissez **Fusionner les
   projets dans le portefeuille courant** : l'aperçu chiffre l'effet avant
   d'agir (« fusionner : 3 remplacés, 2 ajoutés ») et liste les projets que
   le fichier remplacerait. Un projet d'identifiant
   connu remplace le vôtre à sa place, un identifiant nouveau s'ajoute en fin
   de sa catégorie, une catégorie inconnue est créée — vos catégories
   homonymes gardent leur version, et rien n'est jamais supprimé. La revue,
   les réglages et les slides libres du fichier reçu sont ignorés.

<img src="images/fr-import-merge.png" width="720" alt="Le choix du mode d'import : remplacer ou fusionner, avec l'aperçu chiffré et la liste des projets remplacés">

La fusion est une seule entrée d'historique : **Ctrl+Z** la défait en bloc.

## Données & confidentialité

Tout reste dans le navigateur. Pas de serveur, pas de compte ; rien ne quitte
la machine. Le seul appel réseau possible est Google Fonts, et seulement si
la police choisie n'est ni fournie avec l'application ni embarquée dans le
portefeuille.

- **Sauvegarde locale (localStorage)** — active par défaut. La base et
  l'historique annuler/rétablir survivent au rechargement de la page. La
  désactiver efface les clés enregistrées ; la base ouverte reste intacte
  jusqu'à la fermeture de l'onglet.
- **Purger la base** — vide catégories, projets et slides libres ; la revue et
  les paramètres sont conservés. Annulable.
- **Réinitialiser les réglages** — retour au thème et à l'affichage par
  défaut ; langue et identité sont conservées. Annulable.

## Sur téléphone ou tablette

L'éditeur s'adapte sous les largeurs de bureau : la barre latérale devient un
tiroir derrière le bouton ☰, les formulaires s'empilent, et les tableaux
larges (le portefeuille, les jalons) défilent latéralement dans leur propre
cadre — la page, elle, ne défile jamais horizontalement. Le diaporama réduit
ses slides 16:9 à la taille de l'écran, et sa barre de sortie reste visible
sur écran tactile. Tout fonctionne sur téléphone ; un poste de travail reste
simplement plus confortable pour saisir.

## Apparence

<img src="images/fr-settings.png" width="720" alt="Vue Paramètres : identité, langue et palette, catégories et slides libres — les interrupteurs de slides d’agrégat et la carte Données suivent plus bas">

**Paramètres > Langue & palette** :

- **Thème** — Flat (défaut) ou Institutionnel. Il habille les slides.
- **Thème de l'interface** — Système (défaut), Clair ou Sombre. Une
  préférence de l'appareil, rangée hors du fichier de portefeuille :
  l'éditeur bascule, les slides restent claires (elles sont l'artefact). Les
  trois mêmes états sont dans le menu de schéma de la barre du haut, à côté
  du menu de langue.
- **Palette** — Material (défaut), Tailwind ou Gov.
- **Police** — Roboto est fournie avec l'application et sert de défaut. Une
  police embarquée dans le portefeuille (voir ci-dessous) gagne toujours.
  Marianne est utilisée si ses fichiers de police sont déployés à côté de
  l'application ; avec « Marianne » dans le champ, la carte liste les
  fichiers attendus et affiche un statut vivant — embarquée, servie, ou
  introuvable avec repli sur la pile système. Tout autre nom de famille
  Google Fonts se charge par le réseau quand il y en a un.
- **Langue** — français ou anglais ; le changement redessine l'application à
  chaud. La langue se change aussi par le menu de langue de la barre du
  haut.

### Police embarquée

<img src="images/fr-embedded-font.png" width="720" alt="La carte Langue & palette : thème, thème d’interface, palette, police, le statut vivant « Police embarquée dans le portefeuille », et la zone Police embarquée listant deux fontes avec leur graisse et leur taille, les deux sélecteurs, et l’avertissement de licence">

La zone **Police embarquée** de la même carte embarque des fichiers `.woff2`
— choisis un à un ou par dossier entier — DANS le portefeuille, en data URI.
La variante de chaque fichier se lit dans son nom (`Marianne-Regular.woff2` →
400, `…-Medium` → 500–600, `…-Bold` → 700–800, `…Italic` → italique), chaque
fonte est listée avec sa famille, sa graisse et sa taille, et se retire d'un
bouton. Une famille embarquée n'exige ni déploiement ni réseau :
l'application, l'export autonome et l'impression utilisent les fontes portées
par le fichier — mettez le nom de famille dans le champ **Police** et la
ligne de statut répond « Police embarquée dans le portefeuille ». Les tailles
sont plafonnées (~400 Ko par fonte, ~1,5 Mo au total) pour garder le
portefeuille portable.

Embarquer une police dans un fichier diffusé constitue une redistribution —
vérifiez que sa licence l'autorise (Marianne : usage réservé à l'État).

Pour habiller le diaporama aux couleurs d'une administration française :
palette Gov + police Marianne, ici même — et embarquez les woff2 de Marianne
si votre organisation peut les utiliser, pour que le diaporama emporte sa
police partout.
