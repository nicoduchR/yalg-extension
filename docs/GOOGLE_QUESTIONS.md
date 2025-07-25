# Google Questions - YALG Extension

## Quel est l'objectif de l'extension YALG ?

L'extension YALG Chrome a deux objectifs principaux :

1. Récupération des posts LinkedIn : L'extension collecte automatiquement les publications LinkedIn de l'utilisateur à la demande de l'utilisateur pour alimenter le système d'intelligence artificielle et générer du contenu optimisé.

2. Ajout rapide d'anecdotes audio : Un bouton d'action rapide permet aux utilisateurs d'enregistrer et d'ajouter facilement des anecdotes audio directement depuis LinkedIn, enrichissant ainsi leur base de contenu personnel.

Cette extension s'intègre parfaitement avec la plateforme YALG pour automatiser la création de contenu LinkedIn basé sur les données personnelles et professionnelles de l'utilisateur.

## Justification des autorisations

Permissions nécessaires :
- activeTab : Accès à l'onglet LinkedIn actif pour récupérer les posts à la demande
- scripting : Injection de scripts pour extraire le contenu LinkedIn et ajouter le bouton anecdote
- storage : Sauvegarde des données utilisateur et configuration de synchronisation
- tabs : Navigation entre les onglets LinkedIn pour la collecte de posts
- cookies : Authentification avec la plateforme YALG

Host permissions :
- linkedin.com : Accès au contenu LinkedIn (posts, profil)
- yalg.ai : Communication avec l'API YALG pour synchroniser les données

## Justification de l'autorisation d'accès à l'hôte

L'extension nécessite l'accès à deux domaines spécifiques pour fonctionner :

1. linkedin.com : Indispensable pour les deux objectifs principaux
   - Lecture des publications LinkedIn de l'utilisateur sur demande
   - Injection du bouton d'ajout d'anecdotes audio dans l'interface LinkedIn
   - Accès aux données de profil pour contextualiser le contenu

2. yalg.ai : Nécessaire pour la synchronisation des données
   - Envoi des posts LinkedIn collectés vers la plateforme YALG
   - Transmission des anecdotes audio enregistrées
   - Authentification et gestion des paramètres utilisateur

Ces accès sont limités aux domaines strictement nécessaires au fonctionnement de l'extension.

## Utilisez-vous code distant ?

Non, je n'utilise pas "Code distant"

L'extension YALG fonctionne exclusivement avec du code local :
- Tous les scripts JavaScript sont inclus dans le package de l'extension
- Le service worker (background.js) est local
- Les scripts de contenu sont locaux
- La popup utilise des ressources locales uniquement

L'extension communique uniquement avec l'API YALG pour l'échange de données (posts LinkedIn et anecdotes audio), mais ne charge aucun code JavaScript depuis des serveurs distants.

## Consommation des données

Quelles données prévoyez-vous de collecter auprès des utilisateurs ?

☑ Informations permettant d'identifier personnellement l'utilisateur
- Nom et informations de profil LinkedIn pour contextualiser le contenu

☑ Communications personnelles
- Anecdotes audio enregistrées par l'utilisateur

☑ Informations d'authentification
- Tokens d'authentification pour la connexion à la plateforme YALG

☑ Contenu du site Web
- Publications LinkedIn de l'utilisateur (texte, images, liens)

Certifications :
☑ Je ne vends ni ne transfère les données des utilisateurs à des tiers en dehors des cas d'utilisation approuvés
☑ Je n'utilise ni ne transfère les données des utilisateurs à des fins sans rapport avec la fonctionnalité de base de mon article
☑ Je n'utilise ni ne transfère les données des utilisateurs pour déterminer leur solvabilité ou à des fins de prêt

Toutes les données collectées sont utilisées exclusivement pour les deux objectifs principaux de l'extension.

## Règles de confidentialité

L'extension YALG dispose de règles de confidentialité détaillées accessible à l'adresse :
https://yalg.ai/privacy-policy

Ces règles de confidentialité couvrent :
- Types de données collectées par l'extension
- Utilisation des données LinkedIn et des anecdotes audio
- Mesures de sécurité appliquées
- Droits des utilisateurs concernant leurs données
- Durée de conservation des données
- Coordonnées pour les questions relatives à la confidentialité

Les règles de confidentialité sont mises à jour régulièrement pour refléter les dernières pratiques de l'extension et sont conformes au RGPD et aux réglementations locales en matière de protection des données. 