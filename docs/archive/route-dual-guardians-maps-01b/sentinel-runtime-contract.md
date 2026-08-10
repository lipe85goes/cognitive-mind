# Contrato do Sentinela no runtime

Portado de `tools/validation/dual-guardian-lab.mjs` (`sentinelStep`, contrato
c3 `{ patrol: true, commitTurns: 3 }`), aprovado pela 01A. O lab é a fonte de
verdade comportamental; o runtime tem de decidir o que ele decide.

## Constantes

| nome | valor | origem |
|---|---|---|
| `PORTAL_ZONE_RADIUS` | 2 | `ZONE_RADIUS` do lab |
| `SENTINEL_LEASH` | 2 | `SENTINEL_LEASH` do lab |
| `SENTINEL_THREAT_HORIZON` | 6 | limiar `bestThreat > 6` do lab |
| `SENTINEL_COMMIT_TURNS` | 3 | contrato c3 |

## Zona e acessos

`computePortalDefenceZone(playerStart, exitPosition, walls)`

- **zona**: células a distância BFS ≤ 2 do portal. Segue a topologia, não é
  retângulo. A ordem é a de descoberta do BFS a partir do portal.
- **acessos**: células fora da zona que a tocam. Um acesso só conta se o
  Explorador puder chegar por ele **sem passar por outro acesso** — dois acessos
  colados são uma única aproximação, e aí não há o que escolher.

## Decisão

`decideSentinelMove(state, playerPosition, exitPosition, walls, zone)` — pura:
lê o estado e devolve o próximo. Nada estratégico vive na camada Babylon.

1. **Ameaça**: acesso com menor distância BFS até o Explorador. Empate resolve
   pelo primeiro na ordem dos acessos — determinístico.
2. **Compromisso**: se `commitLeft > 0` e há alvo, mantém o alvo e decrementa.
   Senão adota o novo alvo e reinicia `commitLeft = 3`. Um turno para assumir
   mais três de posse.
3. **Coleira**: se a ameaça está a mais de 6, ou o Sentinela está fora da zona
   e a mais de `2 + 2` do portal, ele **abandona** — alvo vira o portal,
   compromisso zera. Não vira um segundo Caçador.
4. **Movimento**: entre os vizinhos que não são o portal e que ficam a ≤ 4 do
   portal, escolhe o de menor distância até o alvo. Só se move se isso melhorar
   — empate significa ficar parado.

## Nascimento

Primeira célula da zona que não é o portal, nem o Explorador, nem o Caçador.
A zona vem em ordem BFS a partir do portal, então é a célula utilizável mais
próxima — geometria, não coordenada mágica.

Se não existir nenhuma, **lança**. O portal é certificado com pelo menos duas
saídas, então isso significaria violação do contrato do gerador, e inventar uma
posição esconderia o defeito.

## Ordem do turno

Do `simulateDual` do lab, verbatim:

```
EXPLORADOR move
  → coleta de luz, portal (vitória)
  → Explorador entrou no Caçador?  → captura
  → Explorador entrou no Sentinela? → captura
  → CAÇADOR move → captura?
  → SENTINELA move → captura?
```

O Sentinela decide **por último**, sobre o estado que o Caçador já produziu, e
não ocupa a célula do Caçador — se o destino coincidir, permanece onde está.
Nada depende da ordem de renderização.

## O que o Sentinela nunca faz

- ocupar a célula do portal (`patrol` é sempre verdadeiro no c3);
- sair da coleira `PORTAL_ZONE_RADIUS + SENTINEL_LEASH = 4`;
- retargetar durante o compromisso — é isso que torna a finta possível;
- perseguir o Explorador pelo mapa.
