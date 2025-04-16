# SystemEl - Application d'Analyse de Loterie

Une application web PWA moderne pour l'analyse des résultats de loterie, permettant le suivi et l'analyse des tirages pour différentes catégories (GH18, CIV10, CIV13, CIV16).

## Fonctionnalités

- ✨ Interface utilisateur moderne, élégante et responsive avec un thème sombre
- 📊 Analyse statistique des tirages (fréquence, récurrences, prédictions)
- 💾 Stockage local des données avec IndexedDB (persistance hors ligne)
- 📱 Support PWA pour une utilisation hors ligne et une installation sur mobile
- 📤 Import/Export, sauvegarde et restauration des données
- 🔄 Réinitialisation des données par catégorie

## Catégories

- **GH18** : Tirage de la loterie du Ghana à 18h
- **CIV10** : Tirage de la loterie de Côte d'Ivoire à 10h
- **CIV13** : Tirage de la loterie de Côte d'Ivoire à 13h
- **CIV16** : Tirage de la loterie de Côte d'Ivoire à 16h

## Sous-menus

- **Entrées** : Enregistrement des tirages (date + 5 boules de 01 à 90)
- **Consulter** : Analyse des récurrences (présence dans le même tirage, le tirage suivant, numéros simultanés)
- **Statistiques** : Fréquence des boules, boules les plus/moins fréquentes, prédictions, graphiques

## Technologies Utilisées

- HTML5
- CSS3 (thème sombre, design responsive)
- JavaScript (ES6+)
- IndexedDB pour le stockage local
- Chart.js pour les graphiques
- Service Workers pour le support PWA

## Installation

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/beniskossi/LotteryK.git