import { join } from 'node:path';
import { resolveUploadPath } from './resolve-upload-path';

const ROOT = '/app/uploads';

describe('resolveUploadPath', () => {
  it('gecerli bir /uploads/ yolunu dogru cozer', () => {
    const result = resolveUploadPath('/uploads/congress-1/abc.jpg', ROOT);
    expect(result).toBe(join(ROOT, 'congress-1/abc.jpg'));
  });

  it('/uploads/ ile baslamayan bir url icin null doner', () => {
    expect(resolveUploadPath('/etc/passwd', ROOT)).toBeNull();
    expect(resolveUploadPath('uploads/congress-1/abc.jpg', ROOT)).toBeNull();
  });

  it('yol gecisi (path traversal) denemesini reddeder', () => {
    expect(resolveUploadPath('/uploads/../../etc/passwd', ROOT)).toBeNull();
    expect(resolveUploadPath('/uploads/../secret.txt', ROOT)).toBeNull();
  });

  it('gorunuste zararsiz ama yine de root disina cikan bir yolu reddeder', () => {
    // "/app/uploads-evil" gibi bir kardes klasore kaymayi da engellemeli -
    // basit bir startsWith(ROOT) kontrolu bunu YANLISLIKLA kabul ederdi.
    expect(
      resolveUploadPath('/uploads/../uploads-evil/x.jpg', ROOT),
    ).toBeNull();
  });
});
