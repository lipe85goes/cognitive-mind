# Home Hero Worlds 3D 01 — Rota e Circuito como pequenos mundos

Material de aceitação da missão `HOME-HERO-WORLDS-3D-01`. Nada aqui é
carregado em runtime. As capturas `*-focus-*.png` e as tiras de continuidade
vêm do runtime real (dev server + Chromium).

## O que era o problema

**Rota:** a Home mostrava o próprio `board.glb` do jogo deitado num plinto, a
0,62 de escala e no centro do frame. Silhueta = grande retângulo com grade.
Reconhecível, mas era "o jogo sobre a mesa".

**Circuito:** a Home lia o kit V2 do jogo (`memory-board.webp`) direto. Um
artefato bonito, mas sozinho — sem terreno, sem base, sem ambiente. Lia como
ícone/logo grande.

**O corte, medido:** o alpha do `memory-board.webp` terminava em `bottom=1023`
num canvas de 1024 — **margem inferior de 0 px**. A saia da base e a sombra de
contato saíam do frame no próprio render. Não era CSS, máscara nem placa: era a
fonte, com `ortho_scale 7.35` apertado demais para board + sombra. A Rota tinha
63 px de folga e estava sã.

## Os dois novos mundos

**Rota Estratégica — ilha de pedra com ruína e portal.** Massa rochosa
irregular (nove blocos cinzelados, nunca um disco limpo), prateleira de terra,
platô elevado à direita. O tabuleiro sobrevive como **ruína pavimentada** a 0,33
de escala, afundada no terreno num canto: a grade continua reconhecível sem
dominar. Um caminho de seis pedras sobe do tabuleiro até o platô, onde está o
**portal teal** — o ponto de luz principal. Lanternas do jogo iluminam o
caminho, muros viram blocos de ruína, pilares quebrados fecham o fundo, e o
Guardião e o Explorador aparecem como presenças pequenas que dão escala.

**Circuito de Memória — ilha mineral com altar.** A mesma linguagem de ilha em
pedra teal, com dois degraus anelares subindo ao altar. No topo está o **board
V2 oficial, importado do próprio gerador do jogo** (`BASE_OBJECTS` de
`create_memory_circuit_visual_v2.py`): as quatro posições, quatro cores, quatro
símbolos, o bronze, a pedra e o cristal teal são literalmente o mesmo artefato,
agora assentado no seu lugar. Fragmentos de bronze, cristais azuis contidos,
rochas e musgo completam a ilha.

## Pipeline

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python tools\blender\create_hero_world_dioramas.py
node tools/assets/create_hero_world_layers.mjs
```

- Canvas **1120×840**, câmera ortográfica compartilhada (`ortho_scale 11.6`,
  elevação 50°), mesmo rig de luz (chave quente, rim âmbar, fill teal).
- Passes: `shadow · base · terrain · structure · props · characters · energy ·
  front` (a Rota usa os 8; o Circuito 7 — sem `characters`, porque o artefato é
  o sujeito).
- **Guarda de silhueta automática:** o encoder mede a caixa alpha de cada passe
  e falha se qualquer lado tocar a borda do frame. É o que impede o corte de
  voltar.

## Correções técnicas encontradas no caminho

1. **Passes vazios** — as chaves de camada não tinham prefixo de mundo; todo
   pass saiu em branco no primeiro render. `register()` passou a namespaçar.
2. **Símbolos flutuando** — os símbolos do board são objetos `CURVE`, não
   `MESH`. O filtro por MESH os tirava do pass de estrutura mas os deixava
   visíveis em **todos** os passes. Guarda ampliada para todo tipo renderizável.
3. **Passes acesos do jogo** — importar todos os objetos novos trazia também os
   `STATE_OBJECTS` (anéis ativos, símbolos coloridos, discos de glow), acendendo
   os quatro pads de uma vez. Agora só `BASE_OBJECTS`.

## Arquivos

- `route-before-after.png` · `circuit-before-after.png`
- `route-world-layers.png` · `circuit-world-layers.png`
- `route-world-composite.png` · `circuit-world-composite.png`
- `route-focus-desktop.png` · `circuit-focus-desktop.png`
- `circuit-neighbor-left.png` · `circuit-neighbor-right.png`
- `circuit-crop-proof.png` — borda, base e sombra completas
- `route-focus-tablet.png` · `circuit-focus-tablet.png`
- `route-focus-mobile.png` · `circuit-focus-mobile.png`
- `home-to-route-continuity.png` · `home-to-circuit-continuity.png`
- `hero-asset-weights.json` · `raw/` (passes PNG, review only)

## Pesos e medições do runtime

| Item | Valor |
| --- | --- |
| Rota (8 camadas) | 104 KB |
| Circuito (7 camadas) | 112 KB |
| Payload de imagens da Home (medido, cache desligado) | **161 KB** |
| Imagens carregadas na Home | 37 |
| Overflow horizontal (1440 / 820 / 390) | 0 / 0 / 0 |
| Seleção com ponteiro pousado no vizinho | **STABLE** |
| Erros de console / HTTP ≥400 | 0 / 0 |

Muito abaixo do orçamento (500 KB por herói; 2 MB de carga inicial). Os kits
antigos (`dioramas/route/`, `dioramas/circuit/`) continuam no disco mas já não
são referenciados por `src/` — a remoção fica para a missão de limpeza.

## Bug encontrado e corrigido durante a validação

O Circuito não tem passe `characters` (o artefato é o sujeito), mas o gerador de
camadas pedia os 8 sufixos para os dois heróis. Resultado: `circuit-characters
.webp` inexistente → **HTTP 400 do otimizador de imagens e erro de console em
cada render da Home**. Corrigido com uma lista explícita de passes ausentes por
mundo; a captura final registra zero 400 e zero erro de console.

## Pendências honestas

- O **portal** da Rota usa o GLB do jogo visto de cima; a essa escala ele lê
  mais como uma taça de luz teal do que como um portal. Trocar por geometria
  própria de portal é assunto de ROTA-VISUAL-01.
- Os **pilares** da Rota são cilindros com tampa de bronze: funcionam como
  ruína no conjunto, mas de perto são simples.
- **Tablet** mantém o mundo em foco a 480 px (herdado da composição desktop);
  ainda merece um passe próprio.
- **Mobile** funciona sem overflow, mas sobra faixa vazia abaixo da placa.
- Os três **mundos secundários não foram tocados**, como pedido.
