# Product Backlog — GestionEmp

Mis à jour le 19 novembre 2026, au début du sprint 4 (sur 8).

> **Sources.** La répartition des 29 US par cas d'utilisation et la description
> de chaque cas viennent de `diagrams/diagramme_de_cas_d_utilisation_uml_2.html`.
> Le périmètre des modules vient de `.claude/CLAUDE.md`, et les livraisons de
> l'historique git et de `docs/sprints/`. Les **intitulés détaillés des US ont
> été reconstruits** à partir de ces sources : le Product Owner les valide, et
> remplace un intitulé si la liste d'origine dit autre chose.

## Vision et Product Goal

**Pour** le fondateur d'une petite entreprise au Cameroun, qui fait seul le
travail d'un service administratif, **GestionEmp** est un back-office virtuel :
des agents IA répondent à ses questions juridiques, comptables et RH en citant
les textes qui s'appliquent (Cameroun, OHADA, CEMAC), et l'aident à facturer,
encaisser, relancer ses clients et tenir ses échéances. **À la différence**
d'un logiciel de gestion classique ou d'un chatbot généraliste, il raisonne sur
les propres données de l'entreprise et sur le droit applicable, et ne fait
jamais rien sans la validation du fondateur.

**Product Goal (fin du sprint 8)** : un fondateur camerounais gère depuis une
seule application ses clients, ses factures et sa trésorerie, ses obligations
légales et son équipe, avec des agents IA fiables, sourcés et sous contrôle.

**La valeur, en une phrase** : moins de temps perdu, moins d'argent qui
dort chez les clients, moins de risques d'oublier une obligation, et plus de
décisions prises avec les bons chiffres.

## Légende

- **Valeur** : valeur métier pour le fondateur, de 1 (faible) à 5 (forte).
- **Pts** : effort estimé en points (suite de Fibonacci). « — » : livré
  avant les estimations en points.
- **Statut** : ✅ Done · 🟡 Partiel (ce qui reste est indiqué) · 🎯 Sprint 4 ·
  ⬜ À faire.
- Les US restant à faire sont classées par **valeur / effort** dans la
  section « Ordre de priorité ».

## Les 29 User Stories

### M1 · Socle et accès (UC-01)

| ID | User Story | Valeur | Pts | Statut |
|---|---|---|---|---|
| US-01 | En tant que fondateur ou collaborateur, je veux me connecter de façon sécurisée et choisir mon entreprise active, afin que mes données restent protégées. | 5 | — | ✅ Sprints 1-2. Reste : interface en anglais (dette i18n). |
| US-22 | En tant qu'utilisateur, je veux exporter ou faire effacer mes données personnelles, afin d'en garder la maîtrise. | 3 | 3 | ⬜ |

### M2 · Contrôle des agents (UC-02, UC-03)

| ID | User Story | Valeur | Pts | Statut |
|---|---|---|---|---|
| US-11 | En tant que fondateur, je veux poser toutes mes questions (droit, comptabilité, fiscalité) au même endroit, afin de ne pas chercher quel assistant utiliser. | 3 | 5 | ⬜ |
| US-16 | En tant que fondateur, je veux connaître le niveau de confiance de chaque réponse d'un agent, afin de savoir quand m'y fier. | 4 | 2 | 🟡 Fait pour le conseiller financier. Reste : l'agent juridique. |
| US-20 | En tant que fondateur, je veux être orienté vers un professionnel (avocat, expert-comptable) quand l'agent atteint ses limites, afin de ne pas décider sur une réponse fragile. | 4 | 2 | 🟡 Fait pour le conseiller financier. Reste : l'agent juridique. |
| US-07 | En tant que fondateur, je veux valider ou rejeter chaque action qu'un agent propose (envoyer un email, émettre un document), afin que rien ne parte sans mon accord. | 4 | 5 | ⬜ Prérequis de toute action externe d'un agent. |
| US-09 | En tant que fondateur, je veux consulter le journal de tout ce que les agents ont fait, afin de pouvoir vérifier et justifier. | 3 | 3 | 🟡 Les échanges du conseiller sont enregistrés. Reste : journal commun et écran. |
| US-21 | En tant que fondateur, je veux régler le niveau d'autonomie de chaque agent, afin de choisir ce qu'il peut préparer seul. | 2 | 3 | ⬜ |
| US-28 | En tant que fondateur, je veux suivre ce que me coûte l'utilisation des agents, afin de maîtriser mon budget. | 2 | 3 | ⬜ |

### M3 · Agent juridique (UC-02, UC-06)

| ID | User Story | Valeur | Pts | Statut |
|---|---|---|---|---|
| US-02 | En tant que fondateur, je veux poser une question juridique et obtenir une réponse qui cite les textes applicables au Cameroun, afin de décider en connaissance de cause. | 5 | — | ✅ Sprints 1-2 (Code du travail 1992). |
| US-19 | En tant que fondateur employeur, je veux des réponses sur le droit du travail appliquées à ma situation (embauche, période d'essai, préavis, congés), afin de gérer mes salariés sans faute. | 4 | 2 | 🟡 Couvert par US-02 avec le Code du travail. Reste : intégrer les modifications postérieures à 1992. |
| US-13 | En tant que fondateur, je veux qu'un agent rédige un brouillon de contrat (prestation, CGV, NDA) à partir d'une fiche client, afin de gagner du temps sans partir d'une page blanche. | 4 | 8 | ⬜ |

### M4 · Comptabilité et finance (UC-02, UC-07)

| ID | User Story | Valeur | Pts | Statut |
|---|---|---|---|---|
| US-12 | En tant que fondateur, je veux poser des questions comptables et fiscales et obtenir des réponses sourcées (OHADA, Code général des impôts), afin d'éviter les erreurs. | 4 | 3 | 🟡 Le conseiller répond sur les chiffres de l'entreprise. Reste : réponses sur les textes, **pas Ready** tant que les textes ne sont pas fournis. |
| US-14 | En tant que fondateur, je veux créer et émettre des factures conformes (XAF, TVA, NIU, RCCM, numérotation continue), afin d'être payé et en règle. | 5 | 5 | ✅ Sprint 3, avec les avoirs. |
| US-15 | En tant que fondateur, je veux enregistrer les paiements (Mobile Money, espèces, virement) et suivre les impayés, afin de savoir qui me doit quoi. | 5 | 3 | ✅ Sprint 3, avec les relances rédigées par l'IA. |
| US-17 | En tant que fondateur, je veux suivre ma trésorerie et voir ce qu'elle sera dans les semaines à venir, afin d'anticiper un manque d'argent. | 5 | 3 | 🟡 Le solde réel et le seuil d'alerte sont faits (sprint 3). 🎯 Reste : la prévision à 30, 60 et 90 jours. |

### M5 · Gestion des clients (UC-04, UC-05)

| ID | User Story | Valeur | Pts | Statut |
|---|---|---|---|---|
| US-03 | En tant que fondateur, je veux une fiche par client et prospect, afin d'avoir toutes ses informations au même endroit. | 5 | 3 | ✅ Sprint 3 |
| US-04 | En tant que fondateur, je veux noter chaque échange avec un client, afin de reprendre une relation là où je l'ai laissée. | 4 | — | ✅ Sprint 3 (avec US-03) |
| US-05 | En tant que fondateur, je veux programmer un suivi daté pour un client ou un prospect, afin de ne jamais oublier de le recontacter. | 5 | 3 | 🎯 Sprint 4 |
| US-08 | En tant que fondateur, je veux qu'un agent rédige mes emails et messages aux clients, afin de relancer et prospecter plus vite. | 4 | 3 | 🟡 Les relances d'impayés sont rédigées (sprint 3). Reste : messages de suivi et de prospection, et envoi après validation (dépend d'US-07). |
| US-18 | En tant que fondateur, je veux suivre mes opportunités dans un pipeline, afin de savoir ce que je peux signer et quand. | 3 | 5 | ⬜ |
| US-23 | En tant que fondateur, je veux importer mes contacts (CSV, carnet du téléphone), afin de démarrer sans tout ressaisir. | 3 | 3 | ⬜ |

### M6 · Gestion des collaborateurs (UC-06, UC-08)

| ID | User Story | Valeur | Pts | Statut |
|---|---|---|---|---|
| US-24 | En tant que fondateur, je veux un dossier par salarié (contrat, poste, date d'entrée), afin d'avoir mon personnel en règle. | 3 | 3 | ⬜ |
| US-25 | En tant que collaborateur, je veux demander un congé, et en tant que fondateur, l'accepter ou le refuser, afin de planifier sans papier. | 3 | 5 | ⬜ |
| US-26 | En tant que fondateur, je veux générer les documents RH courants (contrat de travail, attestation), afin de ne pas les rédiger à la main. | 3 | 5 | ⬜ |
| US-27 | En tant que fondateur, je veux une liste d'étapes d'accueil pour chaque nouvel arrivant, afin que rien ne soit oublié. | 2 | 3 | ⬜ |

### M7 · Pilotage du fondateur (UC-09)

| ID | User Story | Valeur | Pts | Statut |
|---|---|---|---|---|
| US-06 | En tant que fondateur, je veux un écran « Ma journée » qui rassemble mes suivis du jour, mes impayés, mes échéances et mes alertes, afin de savoir quoi faire en ouvrant l'application. | 5 | 3 | 🎯 Sprint 4 |
| US-10 | En tant que fondateur, je veux un calendrier de mes obligations fiscales et sociales, avec un rappel avant chaque échéance, afin de ne jamais payer de pénalité. | 5 | 5 | 🎯 Sprint 4, à condition que le calendrier officiel soit fourni (Definition of Ready). |
| US-29 | En tant que fondateur, je veux synchroniser mon agenda et ma messagerie, afin de tout voir au même endroit. | 2 | 8 | ⬜ |

### Éléments techniques (enablers)

Ils n'apportent pas de valeur seuls, mais conditionnent celle des US.

| Élément | Valeur rendue possible | Pts | Statut |
|---|---|---|---|
| Mise en ligne (serveur AWS) | Sans elle, aucun utilisateur ne peut se servir de l'application | 1 | 🎯 Sprint 4 |
| Validation de l'IA sur le vrai modèle (Gemini) | Les réponses du conseiller sont utiles, pas seulement factices | 1 | 🎯 Sprint 4 |
| Traduction de l'interface FR / EN (i18n) | Ouverture à l'Europe et aux pays anglophones | 3 | ⬜ Dette acceptée (voir sprint 4) |
| Tâches planifiées (Celery + Redis) | Rappels envoyés à heure fixe, appels IA en arrière-plan | 3 | ⬜ |
| PDF des factures | Envoi de la facture en pièce jointe | 2 | ⬜ |

## Où en est-on

| Fin du sprint 3 | Nombre | User Stories |
|---|---|---|
| ✅ Done | 6 | US-01, 02, 03, 04, 14, 15 |
| 🟡 Partielles | 7 | US-08, 09, 12, 16, 17, 19, 20 |
| ⬜ À faire | 16 | US-05, 06, 07, 10, 11, 13, 18, 21, 22, 23, 24, 25, 26, 27, 28, 29 |

Les modules M4 (finance) et M5 (clients) sont les plus avancés. M6
(collaborateurs) et M7 (pilotage) n'ont pas commencé. Avec 3 sprints sur 8
effectués, l'équipe a livré l'essentiel de la valeur « argent et clients » ;
il reste à aider le fondateur à piloter son quotidien, puis à gérer son équipe.

## Évolution du backlog

| Moment | Changement | Pourquoi (valeur) |
|---|---|---|
| Sprint 0 (8-14 oct.) | Socle : authentification, multi-entreprise, isolation des données, CI, déploiement prêt | Rien ne fonctionne sans la sécurité et l'isolation des données |
| Sprints 1-2 (15-16 oct.) | US-01 et US-02 livrées, Code du travail du Cameroun chargé | La question juridique sourcée est la promesse la plus visible du produit |
| Planning du sprint 3 | **Re-priorisation après le retour du professeur** : finance (US-14, 15, 17) et clients (US-03, 04) passent devant la supervision des agents (US-07, 09) | Le fondateur doit d'abord être payé et suivre ses clients : c'est là que se joue sa survie |
| Pendant le sprint 3 | Ajouts négociés avec le PO : conseiller financier IA (couvre une partie d'US-12, 16, 20), avoirs et contre-passations (complètent US-14 et 15), relances rédigées par l'IA (partie d'US-08) | Les impayés sont le premier problème du fondateur : l'IA l'aide à les récupérer |
| Revue du sprint 3 | US-12 (textes comptables) reportée, faute de textes fournis ; déploiement et i18n non faits | Ne pas citer de textes de loi qu'on n'a pas : la fiabilité passe avant tout |
| Planning du sprint 4 | **Changement par rapport au deck du sprint 3** : US-05, 06, 10 et la prévision d'US-17 passent devant US-07/09 et l'i18n (voir `sprints/sprint-04.md`) | Aujourd'hui l'agent n'envoie rien seul : la validation humaine n'apporte de la valeur qu'avec l'envoi automatique. Le fondateur a d'abord besoin de savoir quoi faire chaque jour |

## Ordre de priorité des US restantes

Rang par valeur divisée par effort, puis par dépendances.

| Rang | Élément | Valeur | Pts | Note |
|---|---|---|---|---|
| 1 | Mise en ligne et validation de l'IA | (enabler) | 2 | Sprint 4 |
| 2 | US-05 Suivis datés | 5 | 3 | Sprint 4 |
| 3 | US-06 Ma journée | 5 | 3 | Sprint 4 |
| 4 | US-17 Prévision de trésorerie | 5 | 3 | Sprint 4 |
| 5 | US-10 Calendrier des obligations | 5 | 5 | Sprint 4 si Ready, sinon sprint 5 |
| 6 | US-16 et US-20 pour l'agent juridique | 4 | 4 | Petit effort, fiabilité de l'agent phare |
| 7 | US-07 Validation des actions, puis US-08 envoi des emails | 4 | 8 | Ensemble : l'agent envoie enfin, sous contrôle |
| 8 | US-23 Import de contacts | 3 | 3 | Remplaçant d'US-10 au sprint 4 si besoin |
| 9 | US-12 Questions comptables sur textes | 4 | 3 | Dès que les textes sont fournis |
| 10 | US-13 Brouillons de contrats | 4 | 8 | |
| 11 | US-09 Journal d'audit | 3 | 3 | |
| 12 | US-18 Pipeline | 3 | 5 | |
| 13 | US-24, 25, 26, 27 (collaborateurs) | 2-3 | 16 | Bloc M6, sprints 6-7 |
| 14 | US-22, 11, 21, 28, 29 | 2-3 | 22 | Sprints 7-8, ou après le projet |
