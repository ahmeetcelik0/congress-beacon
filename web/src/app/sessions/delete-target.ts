// Oturum/sunum/rol silme istekleri sayfa DUZEYINDEKI TEK paylasilan
// `ConfirmDeleteDialog`e bu ortak sekille bubble edilir (bkz. `SessionsBoard`
// - dialog satir/kart icine gomulmez, aksi halde gecersiz DOM/gorsel hataya
// yol acar, bkz. gorev tanimi).
export type DeleteTarget = {
  kind: 'session' | 'presentation' | 'role';
  id: string;
  label: string;
};
