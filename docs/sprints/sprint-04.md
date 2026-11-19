# Sprint 4 sur 8 : piloter son quotidien

Planning du 19 novembre 2026. Product Backlog complet : `../product-backlog.md`.

## Sprint Goal

> **Chaque matin, le fondateur sait qui relancer, quel argent va rentrer et
> quelle échéance approche, et peut agir en un clic.**

## Valeur ajoutée du sprint

Les sprints 1 à 3 ont donné au fondateur des **outils** : une fiche par client,
des factures, des paiements, la trésorerie, un conseiller. Mais c'est encore à
lui de penser à les ouvrir et de deviner quoi faire. Le sprint 4 **transforme
ces données en actions du jour**.

| Avant le sprint 4 | Après le sprint 4 |
|---|---|
| Le fondateur doit se souvenir de rappeler un prospect | Il programme un suivi daté, qui réapparaît le bon jour (US-05) |
| Il ouvre quatre écrans pour savoir où il en est | Un seul écran « Ma journée » lui dit quoi faire (US-06) |
| Il connaît son solde d'aujourd'hui | Il voit son solde dans 30, 60 et 90 jours, et quand il risque de manquer d'argent (US-17) |
| Il découvre une échéance fiscale quand la pénalité tombe | Il voit ses obligations à venir et un rappel 7 jours avant (US-10) |
| L'application ne tourne que sur les postes des développeurs, avec une IA factice | Elle est en ligne, et le conseiller répond avec le vrai modèle |

## Pourquoi ces US, et pas celles prévues à la revue du sprint 3

Le deck du sprint 3 proposait la validation des actions des agents (US-07/09,
8 pts), la traduction de l'interface (i18n, 3 pts), les suivis (US-05) et le
déploiement. En reclassant le backlog par **valeur pour le fondateur divisée
par l'effort**, deux de ces choix ne tiennent plus :

- **US-07/09 (valider les actions des agents)** : la règle « humain dans la
  boucle » est déjà respectée, puisqu'aujourd'hui l'agent n'envoie rien ; le
  fondateur envoie lui-même la relance par WhatsApp. La validation en un clic
  prend toute sa valeur avec l'envoi automatique des emails (US-08) : les deux
  iront ensemble au sprint 5.
- **i18n** : les utilisateurs visés parlent français ; l'anglais sert à
  l'ouverture vers d'autres pays, prévue plus tard. C'est une dette de la
  Definition of Done, acceptée et datée (voir plus bas).

À la place, **US-06, US-10 et la prévision d'US-17** apportent une forte valeur
pour un effort faible ou moyen, et répondent au retour du professeur
(sécuriser l'argent, suivre et fidéliser les clients).

## Capacité et Sprint Backlog

Prévision : 18 points (voir le deck du sprint 3). Engagement : **16 points**.

| Rang | Élément | Valeur | Pts | Qui |
|---|---|---|---|---|
| 1 | Mise en ligne et validation de l'IA sur Gemini | enabler | 2 | Back / IA |
| 2 | US-05 Suivis datés | 5 | 3 | Back + Front 1 |
| 3 | US-06 Ma journée | 5 | 3 | Front 1 |
| 4 | US-17 Prévision de trésorerie | 5 | 3 | Back / IA + Front 2 |
| 5 | US-10 Calendrier des obligations fiscales et sociales | 5 | 5 | Back + Front 2 |

**Condition sur US-10 (Definition of Ready)** : le Product Owner fournit avant
J+2 la liste des obligations du Cameroun pour une SARL et un entrepreneur
individuel (intitulé, organisme, périodicité, date limite, source officielle).
L'application ne doit afficher aucune date qui ne vienne pas d'une source.
Sans cette liste, US-10 retourne au backlog et **US-23 (import de contacts,
3 pts)** prend sa place.

## User Stories et critères d'acceptation

Les critères sont écrits pour être vérifiés devant le jury : chaque
« Alors » est visible à l'écran ou dans les tests.

### Mise en ligne et validation de l'IA (2 pts)

> En tant que **membre du jury ou futur utilisateur**, je veux accéder à
> GestionEmp en ligne et obtenir de vraies réponses de l'IA, afin de juger le
> produit tel qu'un fondateur l'utilisera.

1. **Étant donné** la branche `main`, **quand** l'équipe lance
   `deploy/deploy.sh`, **alors** l'application répond en HTTPS sur l'adresse de
   démo et `/api/v1/health/` renvoie 200.
2. **Étant donné** le compte de démo (données fictives), **quand** on se
   connecte en ligne, **alors** toutes les pages livrées s'affichent, sur
   ordinateur et sur téléphone.
3. **Étant donné** la clé Gemini du serveur, **quand** on pose les 5 questions
   suggérées au conseiller, **alors** chaque réponse ne cite que des faits
   existants, affiche une fiabilité, et aucune ne contient un chiffre absent des
   faits. Les 5 questions, les réponses et la fiabilité sont notées dans
   `docs/sprints/sprint-04-ia.md`.
4. Aucune donnée réelle d'entreprise n'est envoyée au modèle (offre gratuite :
   données fictives uniquement).

### US-05 Suivis datés (3 pts)

> En tant que **fondateur**, je veux programmer un suivi daté pour un client ou
> un prospect, afin de ne jamais oublier de le recontacter.

1. **Étant donné** une fiche client, **quand** je programme un suivi avec une
   date, un motif (« envoyer le devis ») et éventuellement un canal (appel,
   WhatsApp, email, rendez-vous), **alors** il apparaît sur la fiche, trié par
   date.
2. **Quand** je choisis une date passée, **alors** le suivi est refusé avec un
   message clair.
3. **Étant donné** un suivi à faire, **quand** je le marque comme fait avec un
   compte rendu, **alors** le suivi est clos et le compte rendu est ajouté à
   l'historique des échanges du client (US-04).
4. **Quand** je reporte un suivi, **alors** sa nouvelle date remplace
   l'ancienne, et le report reste visible dans l'historique du suivi.
5. **Étant donné** un suivi non fait dont la date est passée, **alors** il est
   marqué « en retard » sur la fiche et dans « Ma journée ».
6. La liste des clients indique, pour chacun, la date du prochain suivi.
7. Un suivi d'une autre entreprise n'est jamais visible ni modifiable (404,
   testé). Les collaborateurs peuvent créer et clore des suivis, comme ils
   gèrent déjà les clients.
8. Le conseiller financier connaît les suivis prévus, et ne propose donc pas de
   relancer un prospect déjà programmé.

### US-06 Ma journée (3 pts)

> En tant que **fondateur**, je veux un écran « Ma journée » qui rassemble mes
> suivis du jour, mes impayés, mes échéances et mes alertes, afin de savoir
> quoi faire en ouvrant l'application.

1. **Quand** le fondateur se connecte, **alors** « Ma journée » est sa page
   d'accueil.
2. **Alors** elle affiche, chacun en un bloc :
   - les suivis du jour et en retard (US-05) ;
   - les factures en retard, les plus anciennes d'abord, avec le montant dû et
     les jours de retard ;
   - les échéances des 7 prochains jours (US-10) ;
   - les alertes : trésorerie sous le seuil, risque de passer sous le seuil
     (US-17), brouillons de facture non émis.
3. **Quand** je clique sur un élément, **alors** j'arrive directement à
   l'action : fiche du client, facture avec « Rédiger une relance », page
   Trésorerie, échéance.
4. **Étant donné** qu'il n'y a rien à faire, **alors** un état vide positif
   l'indique (« Rien d'urgent aujourd'hui »).
5. Les montants sont exactement ceux du conseiller et de la page Trésorerie :
   « Ma journée » n'a pas de modèle à elle, elle lit les mêmes données.
6. **Étant donné** un collaborateur, **alors** il voit ses suivis, mais aucune
   donnée financière.
7. Lisible sans défilement horizontal sur un téléphone de 390 px de large.

### US-17 Prévision de trésorerie (3 pts)

> En tant que **fondateur**, je veux voir ce que sera ma trésorerie dans 30, 60
> et 90 jours, afin d'anticiper un manque d'argent.

1. **Alors** la page Trésorerie affiche le solde prévu à 30, 60 et 90 jours :
   solde actuel + factures émises non payées attendues à leur échéance −
   sorties prévues.
2. Les sorties prévues sont la moyenne mensuelle des sorties des 3 derniers
   mois. Cette hypothèse est écrite sous la prévision.
3. Deux scénarios s'affichent : **prudent** (les factures déjà en retard ne sont
   pas comptées) et **si les retards sont payés**.
4. **Étant donné** un seuil d'alerte, **quand** la prévision prudente passe
   dessous, **alors** l'écran indique la date estimée (« risque de passer sous
   le seuil vers le 15 décembre ») et l'alerte apparaît dans « Ma journée ».
5. Le conseiller reçoit la prévision comme un fait, et peut répondre à
   « Aurai-je assez d'argent fin décembre ? » en la citant.
6. Les calculs sont faits par le code et testés sur un jeu de données dont le
   résultat est connu, scénario prudent comme optimiste, y compris sans
   historique (prévision = solde actuel + encaissements attendus).

### US-10 Calendrier des obligations fiscales et sociales (5 pts)

> En tant que **fondateur**, je veux un calendrier de mes obligations fiscales
> et sociales, avec un rappel avant chaque échéance, afin de ne jamais payer de
> pénalité.

1. Les obligations sont des **données par pays** (intitulé, organisme,
   périodicité, règle de date, source officielle), chargées par une commande.
   Aucune date n'est écrite dans le code.
2. **Alors** le fondateur voit les échéances des 3 prochains mois, avec pour
   chacune l'organisme et un lien vers la source.
3. **Quand** une obligation ne le concerne pas (régime, forme juridique),
   **alors** il peut la masquer pour son entreprise.
4. **Quand** il marque une échéance comme faite (date, note), **alors** elle
   sort de la liste à faire. **Sinon**, une fois la date passée, elle est
   marquée « en retard ».
5. **Étant donné** une échéance dans 7 jours ou moins, **alors** elle apparaît
   dans « Ma journée ». Ce rappel est dans l'application ; l'envoi par email
   viendra avec les tâches planifiées.
6. Chaque écran porte l'avertissement ajouté par le code : « Vérifiez vos
   échéances auprès de l'administration fiscale, de la CNPS ou de votre
   expert-comptable. »
7. Une entreprise ne voit jamais les échéances cochées par une autre (testé).

## Definition of Done du sprint 4

1. Tous les critères d'acceptation de l'US sont vérifiés en démo.
2. Les règles métier sont dans les services et testées : calculs, permissions,
   isolation entre entreprises.
3. Les specs frontend couvrent la logique (`src/app/core`) et tournent en CI.
4. Une pull request par US, relue par un autre membre de l'équipe, CI verte,
   fusionnée sur `main`.
5. Déployé sur l'environnement en ligne et vérifié sur téléphone.
6. Migrations propres, aucun secret dans git.
7. Textes de l'interface en français. **Dette acceptée par le PO** : la
   traduction anglaise (i18n) est planifiée au sprint 6.

## Démonstration prévue au jury

Avec le compte de démo, en ligne :

1. Connexion : « Ma journée » s'ouvre et montre un suivi en retard, la facture
   de l'hôtel en retard, une échéance fiscale dans 5 jours et le risque de
   trésorerie.
2. Clic sur la facture → « Rédiger une relance » → le fondateur l'envoie par
   WhatsApp.
3. Clic sur le suivi → marqué comme fait avec un compte rendu, qui apparaît
   dans l'historique du client.
4. Page Trésorerie : la prévision à 30, 60 et 90 jours, les deux scénarios et
   la date de risque.
5. Question au conseiller : « Aurai-je assez d'argent fin décembre ? ». La
   réponse cite la prévision et affiche sa fiabilité.
6. Calendrier : une échéance marquée comme faite disparaît de « Ma journée ».
