const labels = {
  en: {
    saved: "Saved",
    action: "Save to playlist",
    close: "Close",
    description: "Choose where to keep this title.",
    private: "Private",
    pending: "Saving…",
    error: "Could not update the collection. Try again.",
    library: "View playlists",
  },
  "pt-BR": {
    saved: "Salvos",
    action: "Salvar em playlist",
    close: "Fechar",
    description: "Escolha onde guardar este título.",
    private: "Privada",
    pending: "Salvando…",
    error: "Não foi possível atualizar a coleção. Tente novamente.",
    library: "Ver playlists",
  },
  es: {
    saved: "Guardados",
    action: "Guardar en lista",
    close: "Cerrar",
    description: "Elige dónde guardar este título.",
    private: "Privada",
    pending: "Guardando…",
    error: "No se pudo actualizar la colección. Inténtalo de nuevo.",
    library: "Ver listas",
  },
};
export function savedCollectionLabels(locale: string) {
  return labels[locale as keyof typeof labels] ?? labels.en;
}
