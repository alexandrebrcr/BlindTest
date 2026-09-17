# 🎵 BlindTest Party - Application Web & PWA

Une application de **Blind Test musical moderne, fluide et festive**, conçue pour fonctionner aussi bien en solo qu'entre amis lors de soirées, directement depuis un navigateur mobile, tablette ou PC, sans installation complexe ni frais d'hébergement.

---

## 🚀 Déploiement gratuit sur GitHub Pages (En 3 étapes)

Le projet est entièrement statique (HTML5, Modern CSS, ES Modules JavaScript). Il est **100% prêt pour GitHub Pages** sans aucune étape de compilation (`build`) requise.

### 1. Initialiser le dépôt Git et commiter les fichiers
Ouvrez un terminal dans ce dossier et lancez :
```bash
git init
git add .
git commit -m "Initial commit - BlindTest Party PWA"
```

### 2. Créer un dépôt sur GitHub et lier le projet
Sur [GitHub.com](https://github.com), créez un nouveau dépôt public (ex: `BlindTest`), puis liez-le :
```bash
git remote add origin https://github.com/<VOTRE-PSEUDO-GITHUB>/BlindTest.git
git branch -M main
git push -u origin main
```

### 3. Activer GitHub Pages
1. Sur votre dépôt GitHub, rendez-vous dans **Settings** > **Pages** (dans le menu de gauche).
2. Sous **Build and deployment** > **Source**, sélectionnez **Deploy from a branch**.
3. Choisissez la branche **main** et le dossier **/ (root)**, puis cliquez sur **Save**.
4. En 1 minute, votre jeu est en ligne à l'adresse :  
   👉 `https://<VOTRE-PSEUDO-GITHUB>.github.io/BlindTest/`

---

## 📲 Comment l'installer comme une vraie application sur Smartphone ?

L'application est une **Progressive Web App (PWA)** certifiée. Elle s'installe en quelques secondes sans passer par l'App Store ou Google Play :

### Sur iPhone (iOS / Safari) :
1. Ouvrez le lien GitHub Pages dans **Safari**.
2. Appuyez sur le bouton de partage (l'icône carrée avec la flèche vers le haut 📤 en bas de l'écran).
3. Faites défiler et appuyez sur **"Sur l'écran d'accueil"** (ou *"Add to Home Screen"*).
4. L'icône de l'application apparaît sur votre iPhone : elle s'ouvre en **plein écran**, sans barre d'adresse !

### Sur Android (Chrome) :
1. Ouvrez le lien dans **Google Chrome**.
2. Un bandeau ou le menu (3 points) vous proposera **"Installer l'application"** ou **"Ajouter à l'écran d'accueil"**.

---

## 🎮 Modes de Jeu

1. **🎯 Solo QCM (4 choix)** :
   - Idéal sur smartphone pour jouer rapidement.
   - Compte à rebours de 20 secondes, bonus de rapidité et multiplicateurs de série (*streak* x1.5, x2) !
2. **✍️ Solo Saisie Libre** :
   - Tapez le nom de l'artiste ou du titre.
   - Moteur avec algorithme de distance de Levenshtein pour valider la réponse même avec une petite faute de frappe ou d'orthographe.
3. **🚨 Soirée Buzzer (2 à 4 joueurs sur le même écran)** :
   - Posez le téléphone ou la tablette au milieu de la table.
   - Chaque joueur / équipe a son quadrant de couleur tactile.
   - Le premier qui touche l'écran gagne la main avec un compte à rebours de 5 secondes pour crier sa réponse !
4. **👑 Soirée "Maître du Jeu"** :
   - Branchez votre appareil en Bluetooth sur l'enceinte de la soirée.
   - Le maître du jeu contrôle la musique (Lecture, Pause, Rejouer), consulte la réponse secrète et gère les scores des équipes en 1 clic.

---

## 🎲 Fonctionnalité Spéciale : Départ Aléatoire

Vous pouvez choisir dans les réglages :
- **Classique (0s)** : Le morceau démarre au tout début de l'extrait (souvent l'intro ou le refrain).
- **🎲 Aléatoire (au milieu de l'extrait)** : La musique démarre à un moment imprévisible (entre la 5e et la 15e seconde) pour un défi bien plus corsé !

---

## 🎼 Catégories Musicales Incluses

- 🔥 **Rap Français** (Jul, Orelsan, Ninho, Booba, PNL, IAM, Damso, Nekfeu, Soprano...)
- 🕺 **Années 80** (Michael Jackson, Madonna, Indochine, Balavoine, Début de Soirée, Queen...)
- 💿 **Années 90 & 2000** (Britney Spears, Daft Punk, Eminem, Manau, Kyo, Diam's, Linkin Park...)
- 🎸 **Rock Classics** (Queen, AC/DC, Nirvana, The Beatles, Rolling Stones, Téléphone...)
- ✨ **Pop Internationale** (Taylor Swift, The Weeknd, Dua Lipa, Bruno Mars, Billie Eilish...)
- 🏰 **Disney & Enfance** (Le Roi Lion, La Reine des Neiges, Aladdin, Tarzan, Pokémon...)
- 🎬 **Cinéma & Séries** (Star Wars, Harry Potter, Pirates des Caraïbes, Game of Thrones...)
- 🍷 **Variété Française** (Jean-Jacques Goldman, Renaud, Francis Cabrel, Johnny Hallyday, Aznavour...)

---

## 🛠️ Architecture Technique

- **Moteur Audio :** Extraits officiels 30 secondes haute fidélité via l'API iTunes (support CORS natif sans proxy, zéro publicité, chargement instantané).
- **Synthétiseur d'effets sonores (Web Audio API) :** Bruit de buzzer jeu télé, ding de victoire, double bip d'erreur et tic-tac chrono générés dynamiquement (aucun fichier son lourd à charger).
- **Interface & Design :** Thème sombre soirée néon, effets de glassmorphism, animations vinyle rotatif, affichage réactif à 100% de la hauteur de vue mobile (`100dvh`).
