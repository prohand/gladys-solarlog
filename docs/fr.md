# Solar-Log

Suivez votre installation solaire dans Gladys avec un enregistreur **Solar-Log** (Solar-Log 200,
250, 300, 500, 1000, 1200, 1900, 2000, Solar-Log Base…) : production, consommation, surplus,
bilans, onduleurs et batterie. L'intégration lit le Solar-Log **sur votre réseau local** via son
interface JSON ouverte : aucun compte cloud, aucune donnée ne sort de chez vous.

## Ce que vous obtenez

- Un appareil **Solar-Log** : puissance de production, puissance DC, tensions AC et DC,
  production totale (compteur en kWh) et — si un compteur de consommation est relié au
  Solar-Log — puissance consommée, consommation totale, surplus (production moins consommation)
  et taux d'autoconsommation.
- Un appareil **par onduleur** avec sa puissance instantanée (optionnel).
- Un appareil **batterie** (niveau, puissance de charge et de décharge) si le Solar-Log en gère
  une.
- Des **déclencheurs de scène** : production démarrée / arrêtée, surplus solaire disponible /
  terminé, Solar-Log injoignable / de nouveau joignable.
- Des **actions de scène** : lire les valeurs solaires, vérifier le surplus solaire, obtenir la
  production d'une période.
- Deux **widgets** pour le tableau de bord : « Production solaire » et « Bilan solaire ».

La production totale est publiée comme un index de compteur : le suivi d'énergie de Gladys en
déduit la production de n'importe quel jour, mois ou année.

## Avant de commencer

1. Donnez au Solar-Log une **adresse IP fixe** dans votre box (réservation DHCP).
2. Ouvrez la page web du Solar-Log dans un navigateur (son adresse IP).
3. Allez dans **Configuration > Système > Contrôle d'accès** et activez **Interface JSON
   ouverte**. Enregistrez. Sans cela, le Solar-Log ne répond rien à l'intégration.
4. Optionnel : si le niveau d'accès « utilisateur » est protégé par un mot de passe, notez-le. Il
   ne sert qu'aux données par onduleur et à la batterie.

## Configuration

Dans Gladys, ouvrez **Intégrations > Solar-Log > Configuration** :

| Champ                          | Quoi saisir                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Adresse du Solar-Log           | Adresse IP ou nom d'hôte, ex. `192.168.1.20` (`http://` est ajouté pour vous). |
| Mot de passe utilisateur       | Seulement si le niveau « utilisateur » a un mot de passe. Stocké comme secret. |
| Intervalle de rafraîchissement | Fréquence de lecture du Solar-Log. 60 s par défaut, 30 s minimum.              |
| Seuil de production            | Production (W) qui déclenche « Production solaire démarrée ». 50 W par défaut. |
| Seuil de surplus               | Surplus (W) qui déclenche « Surplus solaire disponible ». 1000 W par défaut.   |
| Marge de surplus               | « Surplus terminé » se déclenche au seuil moins cette marge. 200 W par défaut. |
| Un appareil par onduleur       | Crée aussi un appareil par onduleur. Activé par défaut.                        |

Cliquez ensuite sur **Tester la connexion** : la réponse affiche la production du moment et celle
du jour. Ouvrez l'onglet **Découverte** et ajoutez les appareils voulus. **Rechercher à nouveau
les onduleurs** relit les onduleurs et la batterie après un changement sur le Solar-Log.

## Déclencheurs de scène

| Déclencheur                    | Quand                                                                | Variables                                    |
| ------------------------------ | -------------------------------------------------------------------- | -------------------------------------------- |
| Production solaire démarrée    | La production dépasse le seuil de production (le matin).             | `production_w`                               |
| Production solaire arrêtée     | La production passe sous la moitié du seuil (le soir).               | `yield_today_kwh`                            |
| Surplus solaire disponible     | Production moins consommation atteint le seuil de surplus.           | `surplus_w`, `production_w`, `consumption_w` |
| Surplus solaire terminé        | Le surplus passe sous le seuil moins la marge.                       | `surplus_w`, `production_w`, `consumption_w` |
| Solar-Log injoignable          | Trois lectures de suite ont échoué. Filtrez sur la raison si besoin. | `reason`                                     |
| Solar-Log de nouveau joignable | Le Solar-Log répond de nouveau.                                      |                                              |

Chaque déclencheur se déclenche **une fois par changement**, jamais à chaque lecture, et pas au
redémarrage de l'intégration. Les déclencheurs de surplus demandent un compteur de consommation
sur le Solar-Log.

## Actions de scène

- **Lire les valeurs solaires** : lit le Solar-Log maintenant. Sorties : `reachable`,
  `production_w`, `consumption_w`, `surplus_w`, `yield_today_kwh`, `self_consumption_percent`.
- **Vérifier le surplus solaire** : le surplus atteint-il le minimum choisi ? Sorties :
  `available` (jamais vrai si le Solar-Log ne répond pas), `surplus_w`.
- **Obtenir la production solaire** : production et consommation en kWh pour aujourd'hui, hier,
  ce mois-ci, cette année ou depuis l'installation.

Exemple : « Quand le surplus solaire est disponible, entre 10 h et 16 h, allumer la prise du
chauffe-eau ; quand le surplus est terminé, l'éteindre. »

## Widgets du tableau de bord

- **Production solaire** : production, consommation et surplus en direct, part de la puissance
  crête, courbe sur 24 heures, production du jour, état du lien et bouton **Actualiser**.
- **Bilan solaire** : production et consommation du jour, d'hier, du mois, de l'année et au
  total, plus l'autoconsommation actuelle.

## Dépannage

- **« L'interface JSON ouverte est désactivée »** : activez-la (voir « Avant de commencer »).
- **« Le Solar-Log ne répond pas »** : vérifiez l'adresse, que Gladys et le Solar-Log sont sur le
  même réseau et qu'aucun pare-feu ne bloque le port 80.
- **« Le Solar-Log a refusé le mot de passe »** : vérifiez le mot de passe du niveau
  « utilisateur ». Le résumé de l'installation fonctionne sans ; seuls les onduleurs et la
  batterie en ont besoin.
- **Valeurs à 0 juste après un redémarrage du Solar-Log** : l'intégration les ignore exprès
  jusqu'à la fin du démarrage du Solar-Log.
- **Aucun appareil onduleur** : les données par onduleur peuvent exiger le mot de passe ; cliquez
  sur **Rechercher à nouveau les onduleurs** après l'avoir saisi.

## Confidentialité

Tout reste sur votre réseau : l'intégration ne parle qu'à votre Solar-Log. Le mot de passe est
stocké comme un secret Gladys et n'est jamais écrit dans les logs.
