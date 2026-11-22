# Filmgram — plano de implementação

O Filmgram usa o TMDB para descoberta de filmes e séries. A navegação pública abre fichas por URL. O login com Google permite salvar títulos, organizar playlists e publicar avaliações.

| Etapa                 | Entrega                                                                                                                                              | Aceite                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. Entrevista         | Tendências diárias de filmes, banner, cards, ficha, estados de carregamento e falha, layout responsivo e atribuição.                                 | A URL pública na Vercel abre sem conta e mostra títulos reais do TMDB.                          |
| 2. Conta e descoberta | Séries, filtros All/Films/Series, inglês por padrão, português do Brasil e espanhol, Google OAuth, favoritos, assistidos e recomendações por gênero. | Login retorna à ficha e favoritos ficam disponíveis em outro dispositivo.                       |
| 3. Perfil e playlists | Perfil público com contagem de formatos e gráfico de gêneros, playlists privadas por padrão com publicação opcional.                                 | Apenas o dono altera uma lista e a ordenação é gravada em uma transação.                        |
| 4. Social             | Seguir pessoas, feed cronológico, curtidas, nota de 1–5, resenha e link do YouTube opcionais.                                                        | A avaliação aparece na ficha, perfil e feed dos seguidores. Só o autor pode alterar ou excluir. |

## Interface

Mobile usa Discover, Following, Playlists e Profile na barra inferior. Desktop usa os mesmos destinos no cabeçalho. All, Films e Series são filtros de Discover e preservam a seleção na URL. Trending now usa tendências diárias. Top rated usa o TMDB. Most liked usa curtidas do Filmgram. Recently watched usa a marcação explícita de assistido. Descoberta mantém a identidade escura e coral dos mockups.

## Tecnologias e responsabilidades

- **Next.js App Router, React e TypeScript estrito.** As rotas compõem telas. Componentes do servidor carregam dados. Componentes cliente tratam interações. CSS Modules e variáveis CSS organizam o tema e os estilos.
- **TMDB, Zod e cache do Next.js.** O servidor valida as respostas e converte para tipos de domínio. Tendências públicas usam revalidação de 600 segundos. O token fica no servidor. Um título é identificado pelo par formato e ID.
- **next-intl.** A rota define idioma e mensagens em inglês, português do Brasil e espanhol. Cada resenha mantém a língua do autor.
- **Supabase Auth, PostgreSQL e RLS.** O Google confirma a identidade. Supabase mantém a sessão em cookies. Server Actions validam a entrada e o banco aplica as regras de acesso. Migrações e tipos gerados ficam no repositório.
- **Vercel e GitHub.** GitHub executa a CI e Vercel publica o Next.js. Configurações de preview e produção são separadas.

## Estrutura

```text
src/app/             Rotas e layouts
src/features/        Funcionalidades, componentes e testes de domínio
src/components/      Navegação e UI compartilhada
src/integrations/    Clientes e contratos de TMDB e Supabase
src/i18n/            Roteamento e configuração de idioma
src/messages/        Traduções da interface
src/types/           Tipos do banco
src/styles/          Estilos globais e tema
public/              Imagens e marca
supabase/            Configuração, migrações e testes de acesso
tests/               Setup e fluxos de navegador
.husky/              Hooks locais
.github/workflows/   Verificações de PR
```

## Verificação e responsabilidades

O pre-commit executa lint e testes relacionados. O pre-push roda tipos, unitários e um fluxo curto do Playwright. A CI roda lint, tipos, Vitest, integração com Supabase local, build e E2E desktop e mobile com dados controlados.

Terra médio é o executor principal. Terra baixo recebe ajustes isolados. Terra alto cuida de autorização e concorrência. A revisão final usa Sol médio em leitura, com foco em infraestrutura, organização, tipagem e fidelidade ao design nas capturas mobile e desktop. O relatório apresenta evidência, impacto, prioridade e plano de correção com um executor indicado. Aplicar as correções depende de autorização do usuário.
