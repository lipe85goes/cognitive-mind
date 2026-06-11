# MindFlow — Treino Cognitivo

Aplicação web de treino cognitivo com atividades interativas curtas — uma jornada calma de "mini-mundos" táteis, pensada para uso mobile e apresentação como MVP.

## Descrição

O **MindFlow** oferece exercícios leves de estimulação cognitiva (memória, planejamento, atenção e contagem) em uma interface clara, em português brasileiro, adequada a idosos e pessoas que se beneficiam de apoio cognitivo. A direção visual é inspirada em jogos de tabuleiro, jardins e painéis de comando ilustrados.

**Importante:** este produto **não é uma ferramenta de diagnóstico médico**. Trata-se de estimulação e prática cognitiva por meio de jogos simples.

## Estações disponíveis (5 mini-mundos jogáveis)

| Estação | Jogo base | Habilidade |
|---------|-----------|------------|
| **Circuito de Memória** | Sequência de Cores | Memória e atenção |
| **Rota Estratégica** | Labirinto de Fuga | Planejamento e estratégia |
| **Central de Comandos** | Painel de Segurança | Foco e sequência |
| **Trilha Lógica** | Trilha de Números | Atenção e ordem lógica |
| **Jardim de Sementes** | Distribuição de sementes | Contagem e planejamento |

Cada estação tem ilustração própria (`public/illustrations/`), tela de introdução ("Como jogar"), tabuleiro tátil, e tela de resultado com mensagens de encorajamento. Resultados ficam salvos no dispositivo (`localStorage`).

## Stack tecnológica

- [Next.js 16](https://nextjs.org) (App Router) — atenção: esta versão tem mudanças relevantes; consulte `node_modules/next/dist/docs/`
- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com) + CSS custom properties (tokens de paleta por mundo em `globals.css`)
- [Motion](https://motion.dev) para animações (sempre respeitando `prefers-reduced-motion`)
- [Lucide React](https://lucide.dev) para ícones; `canvas-confetti` para celebração de conclusão

## Como executar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

### Outros comandos

```bash
npm run build     # build de produção
npm run start     # servir build de produção
npm run lint      # verificação ESLint
npx tsc --noEmit  # verificação de tipos
```

## Arquitetura

Visão completa (estrutura, fluxo de telas, registro de mundos e **receita para adicionar um novo jogo**) em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

```
src/
  app/           # página única (visões: home | game | result) e layout
  components/    # casca compartilhada (dashboard, intro, layout de jogo, resultado)
  data/          # worlds.ts (registro canônico por jogo), activities, intros
  engine/        # pontuação, dificuldade, meta diária, armazenamento
  games/         # lógica de cada jogo (isolada por pasta) + registro
  lib/           # sons, confete, animações de feedback, labels
  types/         # tipos TypeScript compartilhados
public/
  illustrations/ # arte das estações e do herói do dashboard
```

## Acessibilidade

- Alvos de toque grandes, texto grande e alto contraste
- `prefers-reduced-motion` respeitado em todas as animações e no confete
- Sons opcionais (desligados por padrão, persistidos no aparelho)
- Movimentação por teclado na Rota Estratégica (setas)
- Sem cronômetros: todas as atividades são no ritmo da pessoa

## PWA (preparação básica)

- Manifesto web em `src/app/manifest.ts`, metadados em português
- Sem suporte offline avançado nesta versão

## Próximas evoluções possíveis

- Perfis locais e relatórios de progresso para clínicas
- Exportação/impressão de resultados
- Empacotamento PWA / app nativo (Capacitor)
- Mais estações e níveis de dificuldade
- Backend e sincronização na nuvem

## Licença

Projeto privado / MVP — consulte o responsável pelo repositório para termos de uso.
