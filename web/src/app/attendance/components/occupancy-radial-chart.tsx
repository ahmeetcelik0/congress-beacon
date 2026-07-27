'use client';

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';

/**
 * Salon başına doluluk göstergesi. Kapasitesi TANIMLI salonlar için
 * çağrılır — `capacity === null` durumunda bu bileşen HİÇ render EDİLMEZ
 * (bkz. `HallOccupancyCard`), çünkü boş/donmuş bir grafik göstermek yanlış
 * bir kesinlik izlenimi verir.
 *
 * Renk kasıtlı olarak SALON KİMLİK rengidir (`getHallColor`), yoğunluk
 * durumunun (`StatusBadge`) rengi DEĞİL — ikisi ayrı anlam taşır: bu grafik
 * "hangi salon" sorusuna, rozet "ne kadar dolu/riskli" sorusuna cevap verir.
 * Bu ayrım tüm diğer grafiklerle (alan grafiği, katılımcı geçmişi) tutarlı
 * salon rengini korur.
 *
 * `chartPercentage` çağıran tarafından 0-100 aralığına kırpılmış olarak
 * gelir (kapasite aşımı görsel olarak dolu halkada durur), ama
 * `displayPercentage` (gerçek, 100'ü aşabilen değer) merkezde METİN olarak
 * gösterilir — kullanıcı grafik dolu görünse bile gerçek oranı okuyabilir.
 */
export function OccupancyRadialChart({
  chartPercentage,
  displayPercentage,
  color,
  accessibleLabel,
}: {
  chartPercentage: number;
  displayPercentage: number;
  color: string;
  accessibleLabel: string;
}) {
  const data = [{ name: 'occupancy', value: chartPercentage, fill: color }];

  return (
    <div className="tp-radial-wrap" role="img" aria-label={accessibleLabel}>
      <ResponsiveContainer width={88} height={88}>
        <RadialBarChart
          width={88}
          height={88}
          innerRadius={30}
          outerRadius={42}
          barSize={9}
          data={data}
          startAngle={90}
          endAngle={-270}
          // İlk yüklemede hafif bir dolum animasyonu olur, ama polling
          // güncellemesinde `isAnimationActive` KAPALI — aksi hâlde her 5
          // saniyede bir tam animasyon tekrarı rahatsız edici olurdu.
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={5}
            background={{ fill: 'rgba(139, 160, 189, 0.14)' }}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="tp-radial-center" aria-hidden="true">
        <span className="tp-radial-value">%{displayPercentage}</span>
      </div>
    </div>
  );
}
