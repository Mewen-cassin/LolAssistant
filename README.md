# LoL Assistant

Outil perso (Electron + TypeScript) pour League of Legends :

- se connecte au client LoL via l'API locale (LCU), sans toucher au jeu ;
- crée et range des pages de runes par champion, rôle et matchup, avec un éditeur visuel ;
- importe automatiquement la meilleure page au verrouillage du champion ;
- affiche tes notes de matchup et les conseils officiels (Data Dragon).

Aucune clé API Riot n'est nécessaire.

## Installation

Prérequis : [Node.js](https://nodejs.org) (version LTS) et le client League of Legends sur Windows.

```bash
git clone <url-du-depot>
cd LoL-Assistant
npm install
npm start
```

Si le client n'est pas dans `C:\Riot Games\League of Legends` (ni sur les lecteurs D à G), définis la variable
d'environnement `LOL_PATH` vers le dossier d'installation avant de lancer.

## Utilisation

1. **Créer une page** : tape un champion (autocomplétion), choisis rôle et adversaire si besoin, puis clique tes runes.
   Le bouton « Copier la page active du client » remplit l'éditeur depuis le client.
2. **Bibliothèque** : tape un nom de champion pour filtrer, puis Importer, Modifier ou Supprimer.
3. **Import automatique** : au verrouillage du champion, la page la plus précise est importée
   (matchup exact > rôle > page par défaut).
4. **Notes** : tes notes générales ou par matchup, affichées pendant la sélection.

### Une page à réserver dans le client

Le client limite le nombre de pages de runes. Renomme une de tes pages en `[A] Assistant` : l'outil l'écrase à chaque
import et ne touche jamais à tes autres pages.

## Données

Les pages et notes sont enregistrées localement (`%APPDATA%\lol-assistant\data.json`), propres à chaque PC.

## Avertissement

Projet non officiel, non affilié à Riot Games. Il n'utilise que l'API locale du client et les données publiques
Data Dragon, et ne modifie ni ne lit le processus du jeu.
