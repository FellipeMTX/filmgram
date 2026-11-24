const playerTitles = {
  en: "YouTube video player",
  "pt-BR": "Reprodutor de vídeo do YouTube",
  es: "Reproductor de vídeo de YouTube",
};

function videoId(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1)
        : host === "youtube.com" || host === "m.youtube.com"
          ? url.searchParams.get("v")
          : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function ReviewVideo({ url, locale }: { url: string; locale: string }) {
  const id = videoId(url);
  if (!id) return null;

  return (
    <iframe
      key={id}
      className="mt-3 block aspect-video min-h-[200px] w-full max-w-[480px] rounded-md bg-black"
      src={`https://www.youtube-nocookie.com/embed/${id}`}
      title={
        playerTitles[locale as keyof typeof playerTitles] ?? playerTitles.en
      }
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      allow="encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}
