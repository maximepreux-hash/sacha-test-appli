# Tape-Tête Ping-Pong 🏓

Un petit jeu de tape-taupe pour Sacha : les têtes de Sacha, Papa et Мама sortent
de briques de construction, et il faut les taper avec la raquette de ping-pong !

- 45 secondes par partie, 3 niveaux (Facile, Moyen, Rapide)
- 1 point par tête, **3 points** pour la balle de ping-pong orange (« Smash ! »)
- Musique, sons, étoiles, confettis et record à battre
- Fonctionne sur iPhone, iPad et Android, même sans connexion une fois installé

## 🔒 Les photos

Les photos ne sont **pas** dans ce dépôt GitHub et ne sont jamais envoyées sur Internet.
On les choisit directement dans le jeu (bouton ⚙️ → 📷 Photo) et elles restent
enregistrées uniquement sur le téléphone ou la tablette.

## Installer le jeu sur le téléphone

1. **Une seule fois, sur GitHub** : publier le site
   - Le dépôt doit être **public** (Settings → General → tout en bas « Change visibility »).
   - Settings → **Pages** → Source « Deploy from a branch » → choisir la branche
     `claude/quirky-mccarthy-v0rz8y` (ou `main` une fois fusionnée) et le dossier `/ (root)` → **Save**.
   - Après 1 à 2 minutes, le jeu est en ligne sur :
     `https://maximepreux-hash.github.io/sacha-test-appli/`
2. **iPhone / iPad** : ouvrir ce lien dans **Safari** → bouton Partager ⬆️ →
   **« Sur l'écran d'accueil »**.
3. **Android** : ouvrir le lien dans **Chrome** → menu ⋮ → **« Ajouter à l'écran d'accueil »**
   (ou « Installer l'application »).
4. Ouvrir le jeu **depuis la nouvelle icône**, puis ⚙️ pour mettre les photos et les prénoms.

> Sur iPhone, l'icône de l'écran d'accueil a sa propre mémoire : choisissez les photos
> depuis l'icône, pas depuis Safari.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Les écrans du jeu |
| `style.css` | Les couleurs, les briques, les animations |
| `game.js` | Les règles du jeu, les réglages, le recadrage des photos |
| `audio.js` | La musique et les bruitages (générés, sans fichier audio) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installation sur l'écran d'accueil et mode hors connexion |
