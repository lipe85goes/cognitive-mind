# MindFlow Visual System

O contrato de continuidade entre Home, transicao, intro, setup e game shell
dos mundos principais esta em `docs/MINDFLOW_WORLD_MASTER_SCENES.md`.

Este documento consolida o sistema visual oficial do MindFlow. Ele não cria uma nova direção. Ele organiza as decisões já aprovadas para orientar Home, Rota Estratégica, Circuito de Memória, jogos legados, modal e próximas missões visuais.

Regra central: toda decisão visual deve ajudar o Explorador a **pensar em paz**.

## 1. Identidade visual oficial

MindFlow é um ambiente digital cognitivo calmo, adulto, premium e tátil. Ele deve parecer um jogo real, mas sem pressão, urgência ou excesso de estímulo.

Direção oficial:

- Calmo: a interface orienta sem gritar.
- Adulto/premium: visual respeitoso, nunca infantilizado.
- Tátil: botões, placas, tabuleiros e objetos devem parecer manipuláveis.
- 2.5D como linguagem principal: profundidade visual com sprites, camadas, sombras e perspectiva controlada.
- Jogo real: cada tela deve parecer uma experiência jogável, não um site com cartões.
- Sem dashboard: métricas existem apenas quando ajudam a orientação.
- Sem pressão: nada deve sugerir velocidade, cobrança, ranking ou competição.
- Sem infantilizar: formas podem ser lúdicas, mas a linguagem e a composição devem respeitar o Explorador.

## 2. O que evitar

Não usar como direção visual:

- Mapa de fases estilo Candy Crush, Royal Match ou progressão linear falsa.
- Ilhas flutuantes genéricas.
- Cards em grid como estrutura principal.
- Dashboard SaaS, analytics, widgets, ranking, streak, XP ou porcentagens como foco.
- App clínico, formulário médico ou tela de produtividade.
- Neon excessivo, brilho agressivo ou feedback caótico.
- Fantasia genérica que pareça castelo/floresta sem função cognitiva.
- Excesso de escuro, vinheta pesada ou sensação de ameaça.
- Excesso de UI ao redor do jogo.
- Badges, conquistas, troféus e urgência como recompensa principal.

Se uma tela parecer "site bonito com cards", a direção visual ainda não está pronta.

## 3. Linguagem visual

### Paleta

A base deve ser acolhedora e legível:

- Marfim, creme e tons quentes suaves para áreas de respiro.
- Verde sálvia, teal e azul profundo como cores de confiança e foco.
- Dourado/âmbar controlado para luz, ativação e destaque.
- Argila, madeira e bronze envelhecido para superfícies táteis.
- Vermelho deve ser raro e nunca usado como punição visual dominante.

### Materiais

Os materiais devem parecer físicos, não chapados:

- Madeira quente e suave.
- Pedra ou slate levemente pintado.
- Metal/bronze controlado, sem amarelo excessivo.
- Cristal/luz como elemento de foco, não como explosão visual.
- Texturas sutis, sem ruído visual que atrapalhe idosos ou pessoas ansiosas.

### Luz

A luz deve orientar:

- Luz quente para acolhimento.
- Luz teal/azul para foco cognitivo.
- Glow contido para estado ativo.
- Nada de flashes rápidos.
- Preferir transições suaves por opacity/transform.

### Câmera 2.5D

A câmera visual padrão deve sugerir objeto sobre mesa/palco:

- Perspectiva leve de cima.
- Profundidade suficiente para parecer tangível.
- Sem distorção extrema.
- Objetos principais grandes e legíveis.
- Mobile pode simplificar a perspectiva para preservar toque e leitura.

### Sombras e profundidade

Sombra tem função de integração:

- Sombra de contato para objetos-mundo, pads, placas e tabuleiros.
- Camadas com diferença clara de plano.
- Evitar elementos que pareçam colados em cima da cena.
- Evitar blur pesado como truque de profundidade.

### Espaço negativo

O espaço vazio é parte da calma:

- Não preencher todos os cantos com HUD.
- O tabuleiro/palco deve ser protagonista.
- Informações secundárias devem respirar e não competir com a ação.

### Objetos-mundo

Cada jogo deve parecer um objeto cognitivo tangível:

- Rota: tabuleiro físico, rota, luzes, portal, guardião e planejamento.
- Circuito: disco/tabuleiro de memória, pads, núcleo e trilhas luminosas.
- Central: console tátil de comandos.
- Trilha: pedras/tile path lógico.
- Jardim: vasos, sementes e equilíbrio visual.

## 4. Home: O Ateliê dos Mundos

A Home oficial é **O Ateliê dos Mundos**: um plano mental sereno onde objetos-mundo aparecem como pequenos dioramas cognitivos.

Decisões aprovadas:

- A Home ativa usa HTML/CSS 2.5D leve.
- Não usar Three, R3F, Canvas, `requestAnimationFrame` ou render loop contínuo na produção `/`.
- Rota Estratégica e Circuito de Memória são os mundos principais.
- Central de Comandos, Trilha Numérica e Jardim de Sementes continuam acessíveis, mas visualmente mais quietos.
- Não usar trilha, caminho pontilhado, nós de mapa, mascote andando ou progressão falsa.
- Os placeholders atuais são fundação técnica, não arte final.
- HOME-ART-01 deve substituir placeholders por sprites finais leves mantendo o contrato de acessibilidade.

Critério de aprovação da Home: parecer "um lugar calmo com mundos para explorar", não dashboard.

## 5. Circuito de Memória

O Circuito de Memória usa board mestre 2.5D + overlays alinhados.

Decisões aprovadas:

- `useColorSequenceGame.ts` é regra e não deve ser alterado por motivo visual.
- O board mestre contém plataforma, pads, núcleo e trilhas integrados.
- Overlays transparentes têm o mesmo enquadramento do board para alinhamento pixel-perfeito.
- Hitboxes reais ficam em React/HTML, nunca cozidas na arte.
- Texto, HUD, progresso e botões ficam fora da imagem.
- Erro visual deve ser âmbar suave, não vermelho punitivo.

Evitar:

- PNGs soltos tentando encaixar manualmente em perspectiva.
- Pads separados com luz/material/câmera incoerentes.
- HUD externo pesado que faça a tela parecer app.
- Glow forte demais que esconda o tabuleiro.

Próximo passo visual: CIRCUIT-ART-01 para refinar textura, material, brilho, peso de HUD e integração premium sem mudar regra.

## 6. Rota Estratégica

A Rota Estratégica continua válida com Babylon + GLBs, porque é o jogo principal e precisa de tabuleiro interativo 3D.

Direção aprovada:

- Tabuleiro físico/premium.
- Materiais compatíveis com MindFlow: madeira quente, bronze controlado, slate/sage, luzes claras.
- Personagens/props devem parecer miniaturas de jogo, não peças abstratas.
- HUD deve apoiar a rota, não virar painel de cobrança.
- Antes de expandir para 9x9 ou armadilha ativa, fazer ROTA-VISUAL ou ROTA-SPLIT para alinhar visual e estrutura.

Risco atual: se a Rota ficar muito escura, técnica ou carregada, ela quebra "Pensar em paz" mesmo funcionando mecanicamente.

## 7. HUD e painéis

HUD é apoio, não protagonista.

Regras:

- Usar placas do mundo, não cards de dashboard.
- Texto curto e direto.
- Contraste confortável.
- Foco acessível e visível.
- Informações permanentes só se ajudarem a decisão.
- Métricas secundárias devem ser discretas.
- Evitar excesso de contadores, labels e estados simultâneos.
- Evitar vermelho e linguagem de falha.

Boas placas orientam. Cards genéricos cobram.

## 8. Assets

Regras oficiais:

- Runtime leve.
- Masters fora de `public/`.
- Cada pasta visual relevante deve ter README.
- Budget deve existir antes de integrar.
- Review sheet ou preview comparável antes de promover asset para runtime.
- Kits de um mesmo jogo devem usar mesma câmera, luz, escala e linguagem material.
- Não integrar asset incoerente só porque é bonito isoladamente.

Budgets práticos:

- Home runtime alvo: até 600 KB; teto absoluto 1.5 MB.
- Sprites principais podem ser maiores que secundários, mas não devem bloquear carregamento.
- Previews e masters ficam em `docs/archive/` ou em pipeline de geração, não em `public/`.

Checklist antes de integrar asset:

- Está no caminho runtime correto?
- Tem peso aceitável?
- Não contém texto embutido?
- Não substitui controle acessível?
- Combina com câmera/luz dos outros assets?
- Tem README ou documentação de origem?

## 9. CSS

Regra: não adicionar CSS novo em `src/app/globals.css` para novas features.

Padrão:

- CSS isolado por feature.
- Prefixo por feature.
- Home: `.hj-*` em `src/styles/home.css`.
- Rota: `.rsg-*`.
- Circuito: `.mfg-*`.
- Modal: `.prm-*`.
- Atualizar `docs/CSS_CLEANUP_MAP.md` quando uma feature mudar de arquitetura visual.

`globals.css` deve ficar cada vez mais base/shared/legado controlado, não depósito de novas telas.

## 10. Matriz de unificação

| Área | Estado atual | Problema | Direção futura | Missão recomendada |
| --- | --- | --- | --- | --- |
| Home | 2.5D HTML/CSS com placeholders em `HomeStage` | Arte ainda é placeholder técnico | Sprites finais leves de objetos-mundo no Ateliê | HOME-ART-01 |
| Circuito | Board mestre 2.5D + overlays | Ainda precisa refinamento material/HUD | Palco premium coerente, overlays contidos, HUD integrado | CIRCUIT-ART-01 |
| Rota | Babylon + GLBs | Visual ainda pode divergir da linguagem 2.5D/premium calma | Materiais e HUD mais MindFlow, peças mais claras | ROTA-VISUAL-01 |
| Security Panel | Ativo, legado visual | Ainda depende de shared UI antiga | Recriar como console tátil calmo | GAME-BRIDGE-01 |
| Number Trail | Ativo, legado visual | Ainda parece exercício/tela antiga | Recriar como trilha lógica tátil | GAME-BRIDGE-01 |
| Seed Garden | Ativo, legado visual | Mais próximo do conceito, mas fora do sistema final | Integrar como mundo de cultivo 2.5D | GAME-BRIDGE-01 |
| Modal/resultado | Funcional e preservado | Pode carregar linguagem visual antiga de recompensa | Resultado como fechamento calmo da prática | RESULT-VISUAL-01 |
| Transições | `WorldEntryTransition` preservado | Pode divergir da Home 2.5D | Transições leves, sem espetáculo ou carga GPU excessiva | HOME-02 ou TRANSITION-01 |

## 11. Checklist de aprovação visual

Use esta lista antes de aprovar qualquer missão visual:

- Parece MindFlow?
- Ajuda o Explorador a pensar em paz?
- Parece jogo, não dashboard?
- Está claro para idosos e pessoas com suporte cognitivo?
- Está adulto/premium, sem infantilizar?
- Está leve em runtime?
- Está acessível por teclado, toque e leitura?
- Está coerente com os outros mundos?
- Evita excesso de brilho?
- Evita excesso de escuro?
- Evita excesso de texto?
- Evita card/site/app genérico?
- O HUD apoia em vez de dominar?
- O erro orienta sem vergonha?
- Os assets têm câmera, luz e material coerentes?

Se a resposta principal for "não", a missão precisa ser simplificada ou redirecionada.

## 12. Próximas missões sugeridas

Ordem recomendada:

1. HOME-ART-01: criar/substituir sprites finais leves da Home mantendo `HomeStage`.
2. GAME-BRIDGE-01: definir ponte visual para jogos legados sem mexer em regras.
3. CIRCUIT-ART-01: refinar o Circuito de Memória dentro do board mestre 2.5D.
4. ROTA-VISUAL-01: alinhar Rota Estratégica ao sistema visual MindFlow.
5. HOME-02 teardown: remover/arquivar Home 3D antiga se a Home 2.5D for aprovada.
6. ROTA-SPLIT-01: separar melhor estrutura visual/regra se necessário.
7. Depois disso: avaliar 9x9, armadilhas ativas ou expansão de mecânicas.

Não avançar para mecânicas novas se a experiência visual ainda parecer dashboard, protótipo ou app genérico.
