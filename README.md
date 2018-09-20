#### Forgemaso

## Documentation
Commands
```diff
:!fm
:!fm <rune>
:!fm <rune> <qty>

<rune> : Optional, default : "pa"
<qty> : Optional, default : 1 (min:1, max:100)

--------------------
!fm.help
!fm.stats
!fm.runes
!fm.ladder
!fm.gladder
!fm.best
!fm.gbest
--------------------

Le nombre de point obtenu pour un passage de rune est le logarythme base 2 de la proba :
    -> Une rune avec une chance de 1 sur 2 rapportera  log2(2) => 1 point
    -> Une rune avec une chance de 1 sur 4 rapportera  log2(4) => 2 points
    -> Une rune avec une chance de 1 sur 8 rapportera  log2(8) => 3 points
    -> Une rune avec une chance de 1 sur 16 rapportera  log2(16) => 4 points
    -> Une rune avec une chance de 1 sur 32 rapportera  log2(32) => 5 points
    -> Une rune avec une chance de 1 sur 50 rapportera  log2(50) => 5.64 points
    -> Une rune avec une chance de 1 sur 100 rapportera  log2(100) => 6.64 points

    Le multiplicateur :

    Il a pour valeur initial 100%, chaque succés de rune multiplie votre nombre de point par le multiplicateur actuel.
    Le multiplicateur évolu selon les risques pris :
        > A chaque tentative réussie, le multiplicateur augmentera selon la rune passée.

    Exemple :

    > Tentative rune à 1/2 : ECHEC | Score est de 0 | Multiplacteur rest à 100%
    > Tentative rune à 1/2 : SUCCES | Score est de 1 | Multiplicateur : 102%
    > Tentative rune à 1/2 : SUCCES | Score est de 1 + 1*1.02 = 2.02 | Multiplicateur : 104%
    > Tentative rune à 1/4 : SUCCES : Score est de 2.02 + 2*1.04 = 4.10 | Multiplicateur à 108%

```

## Dependencies

```diff
discord.js: ^11.4.2,
edit-json-file: ^1.1.0
```