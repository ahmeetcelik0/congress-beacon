// Oturum/sunum/rol "çıkar veya sil" istekleri sayfa DÜZEYİNDEKİ TEK paylaşılan
// `ConfirmDeleteDialog`e bu ortak şekille bubble edilir (bkz.
// `ImportPreviewBoard` — aynı desen `/sessions`teki `DeleteTarget` ile, ama
// KASITLI olarak ayrı bir tip: burada `session` aslında KALICI silme değil,
// EXCLUDED işaretlemedir (bkz. `excludeProgramImportSessionAction`);
// `presentation`/`role` ise KALICI silmedir.
export type DeleteTarget = {
  kind: 'session' | 'presentation' | 'role';
  id: string;
  label: string;
};
