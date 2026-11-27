import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import artwork from "./interview-demo-artwork.json" with { type: "json" };

// Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FILMGRAM_DEMO_PASSWORD, and
// FILMGRAM_SEED_TARGET (the same URL). Use only an authorized demo project.
const people = [
  ["entrevista", "Marina Costa"],
  ["rafa", "Rafa Lima"],
  ["lia", "Lia Martins"],
  ["caio", "Caio Rocha"],
  ["bia", "Bia Alves"],
  ["leo", "Léo Nunes"],
  ["ana", "Ana Ribeiro"],
  ["joao", "João Melo"],
  ["nina", "Nina Souza"],
  ["davi", "Davi Santos"],
  ["clara", "Clara Ferreira"],
];
// Real TMDB movie IDs, titles, ratings, and original PT-BR review copy.
const films = [
  [
    550,
    "Clube da Luta",
    8,
    "A montagem é elétrica, mas o que ficou comigo foi o desconforto por trás de tanta pose.",
  ],
  [
    238,
    "O Poderoso Chefão",
    10,
    "Cada conversa à mesa parece esconder outra negociação. Um filme que recompensa a atenção.",
  ],
  [
    680,
    "Pulp Fiction",
    9,
    "As conversas aparentemente banais dão ritmo a uma estrutura que nunca parece parada.",
  ],
  [
    13,
    "Forrest Gump",
    4,
    "A atuação é calorosa, mas o sentimentalismo constante acabou me afastando da história.",
  ],
  [
    278,
    "Um Sonho de Liberdade",
    9,
    "Uma história de amizade e paciência que cresce sem apressar os personagens.",
  ],
  [
    155,
    "Batman: O Cavaleiro das Trevas",
    8,
    "A tensão funciona bem quando o filme deixa as escolhas morais respirarem.",
  ],
  [
    27205,
    "A Origem",
    8,
    "O espetáculo impressiona; a ideia de voltar para casa mantém tudo unido.",
  ],
  [
    157336,
    "Interestelar",
    9,
    "O encontro entre escala cósmica e saudade familiar me pegou outra vez.",
  ],
  [
    603,
    "Matrix",
    10,
    "Ainda inventivo e cheio de personalidade. A ação continua contando a história.",
  ],
  [
    424,
    "A Lista de Schindler",
    9,
    "Difícil de assistir e impossível de esquecer. A sobriedade de algumas cenas é devastadora.",
  ],
  [
    129,
    "A Viagem de Chihiro",
    10,
    "Um mundo estranho e acolhedor, cheio de detalhes que pedem outra visita.",
  ],
  [
    496243,
    "Parasita",
    10,
    "O espaço da casa conta tanto sobre a família quanto os diálogos. Preciso rever com calma.",
  ],
  [
    19404,
    "Dilwale Dulhania Le Jayenge",
    7,
    "Um romance generoso, com músicas que tornam a longa duração mais leve.",
  ],
  [
    122,
    "O Retorno do Rei",
    9,
    "A despedida dos personagens é tão importante quanto a batalha. Uma aventura de coração enorme.",
  ],
  [
    120,
    "A Sociedade do Anel",
    9,
    "O prazer está na formação do grupo e na sensação de um mundo além da estrada.",
  ],
  [
    121,
    "As Duas Torres",
    8,
    "O cerco impressiona, mas as cenas de amizade em meio ao cansaço são minhas favoritas.",
  ],
  [
    11,
    "Star Wars",
    8,
    "Uma aventura direta, com personagens que fazem uma galáxia inteira parecer próxima.",
  ],
  [
    1891,
    "O Império Contra-Ataca",
    9,
    "Mais sombrio e ainda divertido. O final deixa espaço para a imaginação trabalhar.",
  ],
  [
    98,
    "Gladiador",
    3,
    "A trilha é marcante, mas o ritmo e a solenidade não funcionaram para mim.",
  ],
  [
    24428,
    "Os Vingadores",
    1,
    "O encontro do grupo tinha potencial, mas o excesso de batalhas tirou meu interesse.",
  ],
  [
    299536,
    "Vingadores: Guerra Infinita",
    6,
    "Equilibrar tanta gente é um desafio; algumas despedidas funcionam melhor que a correria.",
  ],
  [
    299534,
    "Vingadores: Ultimato",
    0,
    "A duração e a quantidade de despedidas não funcionaram para mim; terminei sem me envolver.",
  ],
  [
    862,
    "Toy Story",
    9,
    "Uma ideia simples executada com humor e carinho. Woody e Buzz continuam uma ótima dupla.",
  ],
  [
    8587,
    "O Rei Leão",
    8,
    "As músicas ajudam a contar uma história de perda e retorno que ainda emociona.",
  ],
  [
    12,
    "Procurando Nemo",
    8,
    "A viagem é divertida, mas a relação entre pai e filho é o verdadeiro centro.",
  ],
  [
    508947,
    "Red: Crescer é uma Fera",
    8,
    "Uma confusão afetuosa sobre amizade, família e o susto de crescer. Adorei a energia.",
  ],
  [
    35,
    "Os Simpsons: O Filme",
    2,
    "Algumas piadas funcionam, mas achei a história longa e distante do que gosto na série.",
  ],
  [
    597,
    "Titanic",
    8,
    "O romance ganha força nos detalhes da viagem antes de o espetáculo tomar conta.",
  ],
  [
    105,
    "De Volta para o Futuro",
    9,
    "Ritmo impecável e uma premissa divertida mesmo sabendo onde cada peça vai cair.",
  ],
  [
    120467,
    "O Grande Hotel Budapeste",
    9,
    "As cores encantam, mas a melancolia por baixo da comédia é o melhor.",
  ],
];
const feedCopy = [
  [
    9,
    "Revendo hoje, a trilha e a narração funcionam melhor para mim do que a reviravolta. O apartamento do começo já conta uma história inteira.",
  ],
  [
    9,
    "Os silêncios da família me impressionaram mais do que as cenas de violência. A fotografia faz até um jantar parecer perigoso.",
  ],
  [
    8,
    "Meu trecho favorito é a conversa no carro. Parece que nada está acontecendo, até você perceber que ela define o tom de tudo.",
  ],
  [
    7,
    "Não embarquei em todas as coincidências, mas as cenas mais quietas com a mãe me ganharam logo de cara.",
  ],
  [
    8,
    "Gostei de como a rotina do presídio vira parte do ritmo. A amizade parece construída em pequenos gestos.",
  ],
  [
    9,
    "O caminhão e o hospital costumam roubar a conversa, mas a sequência das balsas é a que eu sempre lembro.",
  ],
  [
    7,
    "A montagem das camadas funciona muito bem. Só queria que o filme confiasse mais no público em vez de repetir algumas regras.",
  ],
  [
    10,
    "O som fez toda a diferença na revisão. O silêncio no espaço é tão expressivo quanto o órgão nos momentos de maior escala.",
  ],
  [
    9,
    "O visual verde envelheceu melhor do que eu esperava. Reparei pela primeira vez como o figurino muda quando cada personagem atravessa os dois mundos.",
  ],
  [
    10,
    "A câmera mantém distância em várias cenas difíceis. Esse cuidado com o ponto de vista tornou a revisão ainda mais forte para mim.",
  ],
  [
    10,
    "A viagem de trem é uma das minhas sequências favoritas no cinema. Poucos filmes dão tanto espaço para a gente olhar a paisagem e pensar.",
  ],
  [
    9,
    "A chuva é meu ponto de virada favorito. O que é só um contratempo para uma família muda tudo para a outra.\n\nRever sabendo o que vem traz outra graça: as portas, as escadas e até a sala de estar já deixam pistas no quadro.",
  ],
  [
    8,
    "As músicas foram a porta de entrada, mas fiquei pelas conversas de família. O último trecho ganha força quando se aceita o ritmo de melodrama.",
  ],
  [
    8,
    "Gosto dos finais demorados. Depois de tanto tempo na estrada, ficar mais um pouco com o grupo me pareceu justo.",
  ],
  [
    10,
    "O Condado dá tanto peso à aventura que passei a reparar mais nas despedidas do começo. É um dos filmes que mais gosto de rever no frio.",
  ],
  [
    8,
    "O cerco é ótimo, mas as conversas entre Frodo e Sam seguram minha atenção mesmo quando o filme pula de um lugar para outro.",
  ],
  [
    9,
    "Tem um senso de aventura muito claro. A mesa de bar e os figurinos fazem a galáxia parecer habitada antes de qualquer explicação.",
  ],
  [
    10,
    "Hoth tem uma textura que eu ainda adoro. O filme muda completamente de tom, mas dá espaço para humor e romance no caminho.",
  ],
  [
    7,
    "A abertura me envolveu mais do que as batalhas da arena. Quando a história desacelera, o conflito político fica bem mais interessante.",
  ],
  [
    6,
    "Diverti-me mais com o grupo tentando conversar do que com o ataque final. A sequência do jantar ainda resume bem o humor do filme.",
  ],
  [
    8,
    "Esperei só ação e acabei prestando atenção no jeito de juntar personagens que mal se conhecem. Nem todos têm espaço, mas alguns encontros funcionam muito bem.",
  ],
  [
    7,
    "O começo mais quieto me ganhou. A batalha é longa, mas rever a convivência do grupo depois de tantos anos trouxe uma coisa que a primeira sessão não teve.",
  ],
  [
    9,
    "As brincadeiras com escala são o que mais me diverte. Um quarto parece um mundo inteiro quando visto do ponto de vista dos brinquedos.",
  ],
  [
    8,
    "As transições da trilha me surpreenderam na revisão. Sempre lembro das músicas, mas tinha esquecido como o filme usa bem o silêncio.",
  ],
  [
    9,
    "As cenas do aquário são meu destaque. Os personagens secundários têm personalidade sem tirar o foco da busca.",
  ],
  [
    9,
    "O grupo de amigas parece gente de verdade. O ritmo e as expressões exageradas me deram vontade de voltar a lendas da minha própria família.",
  ],
  [
    5,
    "Gosto do começo, sobretudo das piadas sobre a própria cidade. Depois achei que a viagem se esticou, mas ainda valeu a sessão.",
  ],
  [
    9,
    "O navio funciona quase como um mapa social. Na revisão, prestei mais atenção em quem pode circular por cada espaço do que no romance.",
  ],
  [
    9,
    "Toda vez que revejo, encontro um detalhe no cenário que volta mais tarde. O humor da atuação vende até as coincidências.",
  ],
  [
    10,
    "As mudanças de enquadramento fazem cada lembrança parecer contada por uma pessoa diferente. Voltei por causa da comédia e saí pensando na solidão do hotel.",
  ],
];
const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const target = process.env.FILMGRAM_SEED_TARGET?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.FILMGRAM_DEMO_PASSWORD;
if (
  !url ||
  !target ||
  url !== target ||
  !key ||
  !password ||
  password.length < 12
)
  throw new Error(
    "Defina a URL, o destino igual à URL, a chave e a senha de pelo menos 12 caracteres. Use somente o projeto Filmgram autorizado.",
  );
const parsed = new URL(url);
if (
  parsed.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(parsed.hostname)
)
  throw new Error("O destino remoto deve usar HTTPS.");
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const marker = "filmgram_interview_demo_v1";
const uuid = (label) => {
  const h = createHash("sha256").update(`${marker}:${label}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const check = (error, action) => {
  if (error) throw new Error(`${action}: ${error.message}`);
};
async function insert(table, rows, onConflict) {
  const { error } = await db
    .from(table)
    .upsert(rows, { onConflict, ignoreDuplicates: true });
  check(error, `Inserindo ${table}`);
}
const existing = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await db.auth.admin.listUsers({
    page,
    perPage: 1000,
  });
  check(error, "Consultando contas");
  for (const user of data.users) existing.set(user.email?.toLowerCase(), user);
  if (data.users.length < 1000) break;
}
const ids = [];
for (const [slug, name] of people) {
  const email = `${slug}@filmgram.example`;
  let user = existing.get(email);
  if (user && user.app_metadata?.[marker] !== true)
    throw new Error(`Conta ${email} já existe sem marcador demo.`);
  if (!user) {
    const result = await db.auth.admin.createUser({
      email,
      password:
        slug === "entrevista"
          ? password
          : randomBytes(28).toString("base64url") + "Aa9!",
      email_confirm: true,
      app_metadata: { [marker]: true },
      user_metadata: { display_name: name },
    });
    check(result.error, `Criando ${email}`);
    user = result.data.user;
  }
  ids.push(user.id);
}
const verifier = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: credential, error: credentialError } =
  await verifier.auth.signInWithPassword({
    email: "entrevista@filmgram.example",
    password,
  });
if (credentialError || credential.user?.id !== ids[0]) {
  throw new Error("A senha fornecida não autentica a conta de entrevista.");
}

for (let i = 0; i < people.length; i++) {
  const handle = `demo_entrevista_${people[i][0]}`;
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .neq("id", ids[i]);
  check(error, "Consultando perfis");
  if (data.length) throw new Error(`Nome de perfil ${handle} já está em uso.`);
  const result = await db
    .from("profiles")
    .update({ handle, display_name: people[i][1] })
    .eq("id", ids[i]);
  check(result.error, "Atualizando perfil demo");
}
for (const [column, other] of [
  ["follower_id", "following_id"],
  ["following_id", "follower_id"],
]) {
  const { data, error } = await db
    .from("follows")
    .select(other)
    .eq(column, ids[0]);
  check(error, "Consultando relacionamentos");
  if (data.some((row) => !ids.slice(1).includes(row[other])))
    throw new Error(
      "Conta de entrevista possui relacionamento fora da demo; nenhuma relação será removida.",
    );
}
await insert(
  "follows",
  ids.slice(1).flatMap((id) => [
    { follower_id: ids[0], following_id: id },
    { follower_id: id, following_id: ids[0] },
  ]),
  "follower_id,following_id",
);
const now = Date.now();
const reviews = films.flatMap(([tmdb_id, , rating, body], i) => [
  {
    id: uuid(`review:main:${tmdb_id}`),
    user_id: ids[0],
    media_type: "movie",
    tmdb_id,
    rating,
    body,
    created_at: new Date(now - (i + 36) * 3600000).toISOString(),
  },
  {
    id: uuid(`review:feed:${tmdb_id}`),
    user_id: ids[1 + (i % 10)],
    media_type: "movie",
    tmdb_id,
    rating: feedCopy[i][0],
    body: feedCopy[i][1],
    created_at: new Date(now - (i + 1) * 3600000).toISOString(),
  },
]);
await insert("reviews", reviews, "user_id,media_type,tmdb_id");
const { data: actual, error: reviewError } = await db
  .from("reviews")
  .select("id,user_id,tmdb_id")
  .in("user_id", ids)
  .eq("media_type", "movie")
  .in(
    "tmdb_id",
    films.map((f) => f[0]),
  );
check(reviewError, "Consultando avaliações");
const lookup = new Map(
  actual.map((row) => [`${row.user_id}:${row.tmdb_id}`, row]),
);
const feed = films.map(([id], i) => lookup.get(`${ids[1 + (i % 10)]}:${id}`));
if (
  feed.some((row) => !row) ||
  films.some(([id]) => !lookup.has(`${ids[0]}:${id}`))
) {
  throw new Error("A verificação não encontrou todas as avaliações previstas.");
}
await insert(
  "review_likes",
  feed.slice(0, 20).map((r, i) => ({
    review_id: r.id,
    user_id: i % 2 ? ids[0] : ids[1 + ((i + 1) % 10)],
  })),
  "review_id,user_id",
);
await insert(
  "review_comments",
  feed.slice(0, 10).flatMap((r, i) => [
    {
      id: uuid(`comment:${r.id}:first`),
      review_id: r.id,
      user_id: ids[0],
      body: [
        "Boa observação! Essa cena também ficou comigo.",
        "Gostei desse olhar. Quero rever prestando atenção nisso.",
        "Concordo em parte; a trilha também fez diferença para mim.",
      ][i % 3],
    },
    {
      id: uuid(`comment:${r.id}:reply`),
      review_id: r.id,
      user_id: r.user_id,
      mentioned_profile_id: ids[0],
      body: [
        "Sim! Na próxima sessão vou reparar ainda mais.",
        "Boa lembrança, a conversa depois do filme rende muito.",
        "Também pensei nisso quando os créditos começaram.",
      ][i % 3],
    },
  ]),
  "id",
);
const ownConversation = [
  [
    27205,
    "Também voltei pensando mais na família do que no quebra-cabeça. A cena da cozinha ganha outro peso na segunda sessão.",
  ],
  [
    603,
    "A coreografia me pegou de novo. A estação de metrô conta muito sobre o que mudou com o Neo sem precisar explicar.",
  ],
  [
    129,
    "Acho o começo ainda mais estranho quando revejo. Fiquei pensando nas coisas que o filme deixa sem resposta.",
  ],
  [
    496243,
    "Concordo sobre a casa. Em uma segunda sessão, parece que os enquadramentos avisam tudo com antecedência.",
  ],
];
await insert(
  "review_comments",
  ownConversation.map(([id, body], i) => ({
    id: uuid(`comment:own:${id}`),
    review_id: lookup.get(`${ids[0]}:${id}`).id,
    user_id: ids[i + 1],
    body,
  })),
  "id",
);
await insert(
  "review_likes",
  ownConversation.map(([id], i) => ({
    review_id: lookup.get(`${ids[0]}:${id}`).id,
    user_id: ids[i + 1],
  })),
  "review_id,user_id",
);
const history = films.slice(0, 20).map(([tmdb_id, media_title], index) => ({
  user_id: ids[0],
  media_type: "movie",
  tmdb_id,
  media_title,
  poster_path: artwork[tmdb_id][0],
  genre_ids: artwork[tmdb_id][1],
  watched_at: new Date(now - (index * 3 + 1) * 3_600_000).toISOString(),
}));
await insert("watched", history, "user_id,media_type,tmdb_id");
await insert(
  "favorites",
  history
    .slice(0, 4)
    .map(({ user_id, media_type, tmdb_id, media_title, poster_path }) => ({
      user_id,
      media_type,
      tmdb_id,
      media_title,
      poster_path,
    })),
  "user_id,media_type,tmdb_id",
);
await insert(
  "title_likes",
  films
    .slice(0, 12)
    .map(([tmdb_id]) => ({ user_id: ids[0], media_type: "movie", tmdb_id })),
  "user_id,media_type,tmdb_id",
);
const listId = uuid("playlist:main");
const { data: existingList, error: listError } = await db
  .from("playlists")
  .select("user_id")
  .eq("id", listId)
  .maybeSingle();
check(listError, "Consultando lista");
if (existingList && existingList.user_id !== ids[0])
  throw new Error("Identificador de lista já pertence a outra conta.");
await insert(
  "playlists",
  [
    {
      id: listId,
      user_id: ids[0],
      name: "Para rever com calma",
      description: "Filmes que renderam boas conversas depois da sessão.",
      is_public: true,
    },
  ],
  "id",
);
await insert(
  "playlist_items",
  films.slice(0, 6).map(([tmdb_id, media_title], position) => ({
    id: uuid(`playlist:item:${tmdb_id}`),
    playlist_id: listId,
    media_type: "movie",
    tmdb_id,
    media_title,
    poster_path: artwork[tmdb_id][0],
    position,
  })),
  "playlist_id,media_type,tmdb_id",
);
for (const column of ["follower_id", "following_id"]) {
  const { count, error } = await db
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq(column, ids[0]);
  check(error, "Verificando contagem de relacionamentos");
  if (count !== 10)
    throw new Error("A conta não tem dez relacionamentos em cada direção.");
}
console.log(
  `Demo preparada: entrevista@filmgram.example; 10 seguidores, 10 seguindo, ${films.length} filmes avaliados e ${feed.length} avaliações no feed.`,
);
