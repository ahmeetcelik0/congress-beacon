import * as React from 'react';

/**
 * `CongressInfoSection.body` mobilde Markdown olarak render edilecek (bkz.
 * görev tanımı) — panel tarafında da canlı bir önizleme gösterilmesi
 * isteniyor, ancak projede hiçbir Markdown kütüphanesi kurulu değil ve ağır
 * bir editör de istenmiyor (bkz. `web/package.json`). Burada saf bir alt
 * küme (# / ## başlıklar, **kalın**, "- " madde listesi, düz paragraflar)
 * DOĞRUDAN React eleman ağacına dönüştürülür — `dangerouslySetInnerHTML`
 * KULLANILMAZ, bu yüzden kullanıcı girdisi React'ın kendi metin escape'leme
 * davranışıyla otomatik güvenli kalır (XSS riski yok).
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part !== '');
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={`${keyPrefix}-${index}`}>{part}</React.Fragment>;
  });
}

export function MarkdownLitePreview({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let blockKey = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    const currentKey = blockKey++;
    blocks.push(
      <ul key={`ul-${currentKey}`}>
        {listBuffer.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item, `li-${currentKey}-${itemIndex}`)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === '') {
      flushList();
      continue;
    }

    const heading2 = line.match(/^##\s+(.*)/);
    const heading1 = line.match(/^#\s+(.*)/);
    const listItem = line.match(/^-\s+(.*)/);

    if (heading2) {
      flushList();
      const currentKey = blockKey++;
      blocks.push(<h3 key={`h-${currentKey}`}>{renderInline(heading2[1], `h-${currentKey}`)}</h3>);
      continue;
    }
    if (heading1) {
      flushList();
      const currentKey = blockKey++;
      blocks.push(<h2 key={`h-${currentKey}`}>{renderInline(heading1[1], `h-${currentKey}`)}</h2>);
      continue;
    }
    if (listItem) {
      listBuffer.push(listItem[1]);
      continue;
    }

    flushList();
    const currentKey = blockKey++;
    blocks.push(<p key={`p-${currentKey}`}>{renderInline(line, `p-${currentKey}`)}</p>);
  }
  flushList();

  if (blocks.length === 0) {
    return <p className="content-markdown-empty">Önizlemek için içerik girin.</p>;
  }

  return <div className="content-markdown-preview">{blocks}</div>;
}
