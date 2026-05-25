# MindFlow — Treino Cognitivo

Aplicação web de treino cognitivo com atividades interativas curtas, pensada para uso mobile e apresentação como MVP.

## Descrição

O **MindFlow** oferece exercícios leves de estimulação cognitiva (memória, planejamento, atenção e reação) em uma interface clara, em português brasileiro, adequada a idosos e pessoas que precisam de apoio cognitivo.

**Importante:** este produto **não é uma ferramenta de diagnóstico médico**. Trata-se de estimulação e prática cognitiva por meio de jogos simples.

## Objetivo do MVP

Validar a experiência de um hub de atividades cognitivas com:

- painel de atividades
- duas atividades jogáveis
- pontuação e resultados recentes salvos no dispositivo (`localStorage`)
- interface acessível, calma e responsiva

## Atividades disponíveis

| Atividade | Descrição |
|-----------|-----------|
| **Sequência de Cores** | Repita a sequência de cores na ordem correta. |
| **Labirinto de Fuga** | Chegue até a saída antes que o predador alcance você. |

## Atividades planejadas (em breve)

- Trilha de Números
- Toque Rápido
- Padrões Iguais
- Caça-Palavras
- Planeje o Caminho
- Grade de Foco
- Dupla Tarefa

## Stack tecnológica

- [Next.js](https://nextjs.org) (App Router)
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS](https://tailwindcss.com)
- `localStorage` para resultados recentes no navegador
- [Lucide React](https://lucide.dev) para ícones

## Como executar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

### Outros comandos

```bash
npm run build   # build de produção
npm run start   # servir build de produção
npm run lint    # verificação ESLint
```

## Estrutura do projeto (resumo)

```
src/
  app/           # página principal e layout
  components/    # UI compartilhada (painel, cards, resultados)
  data/          # definição das atividades
  engine/        # pontuação, dificuldade, armazenamento
  games/         # lógica de cada jogo (isolada por pasta)
  types/         # tipos TypeScript
public/
  icon.svg       # ícone para PWA / atalho na tela inicial
```

## PWA (preparação básica)

- Manifesto web em `src/app/manifest.ts`
- Metadados em português (`title`, `description`)
- Cores de tema alinhadas ao design claro (`#eef4f9`)
- Sem suporte offline avançado nesta versão

## Próximas evoluções possíveis

- Login e contas de usuário
- Relatórios de progresso
- Empacotamento PWA / app nativo (Capacitor)
- Mais atividades e níveis de dificuldade
- Backend e sincronização na nuvem

## Licença

Projeto privado / MVP — consulte o responsável pelo repositório para termos de uso.
