import { api } from '@/lib/api';
import { AppShellNav, type NavCongress } from './app-shell-nav';

// Sidebar'daki "son 5 kongre" listesi, kabuk Next.js kök layout'unun bir
// parçası olduğu için (layout'lar client-side navigasyonda yeniden
// render edilmez) yalnızca ilk sayfa yüklemesinde/sert navigasyonda
// tazelenir. Kongreler sayfasından yapılan ekleme/silme, sidebar'a
// tam sayfa yenilemeye kadar yansımayabilir — bilinçli bir ödünleşim
// (bkz. proje teslim notu).
//
// `failed: true`, isteğin GERÇEKTEN patladığını (ağ/backend hatası) ifade
// eder; bu, "kongre hiç yok" durumundan ayrı tutulur ki sidebar kullanıcıya
// yanlışlıkla "hiç kongre yok" izlenimi vermesin (bkz. /admin/login dışındaki
// sayfalarda bu ayrım anlamlıdır — login sayfasında nav zaten render edilmez).
async function getRecentCongresses(): Promise<{ items: NavCongress[]; failed: boolean }> {
  try {
    const congresses = await api.listCongresses();
    return {
      items: [...congresses]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((congress) => ({ id: congress.id, name: congress.name })),
      failed: false,
    };
  } catch {
    // Giriş yapılmamışsa (ör. /admin/login) ya da backend geçici olarak
    // erişilemezse sidebar çökmez, ancak bunu sessizce "boş liste" olarak
    // değil, açık bir yükleme hatası olarak işaretleriz.
    return { items: [], failed: true };
  }
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { items: recentCongresses, failed: recentCongressesFailed } = await getRecentCongresses();

  return (
    <AppShellNav recentCongresses={recentCongresses} recentCongressesFailed={recentCongressesFailed}>
      {children}
    </AppShellNav>
  );
}
