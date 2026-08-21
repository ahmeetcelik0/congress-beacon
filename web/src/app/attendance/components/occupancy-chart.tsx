'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';
import { getHallColor } from '@/lib/hall-colors';
import { formatIstanbulTime as formatTime } from '@/lib/congress-time';
import type { OccupancySeries } from '@/lib/api';

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) {
    return null;
  }

  const sorted = [...payload].sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

  return (
    <div className="tp-chart-tooltip">
      <div className="tp-chart-tooltip-time">{formatTime(String(label))}</div>
      {sorted.map((entry) => (
        <div key={String(entry.dataKey)} className="tp-chart-tooltip-row">
          <span className="tp-chart-tooltip-key" style={{ backgroundColor: entry.color }} />
          <span className="tp-chart-tooltip-value">{String(entry.value)}</span>
          <span className="tp-chart-tooltip-name">{entry.name}</span>
        </div>
      ))}
    </div>
  );
}

export function OccupancyChart({ series }: { series: OccupancySeries }) {
  if (series.halls.length === 0 || series.points.length === 0) {
    return <div className="tp-empty">Bu aralıkta gösterilecek veri yok.</div>;
  }

  const data = series.points.map((point) => ({
    bucketStart: point.bucketStart,
    ...point.values,
  }));

  return (
    <div className="tp-chart-card">
      <div className="tp-legend">
        {series.halls.map((hall) => (
          <span key={hall.hallId} className="tp-legend-item">
            <span
              className="tp-legend-swatch"
              style={{ ['--swatch-color' as string]: getHallColor(hall.hallId) }}
            />
            {hall.hallName}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
          <XAxis
            dataKey="bucketStart"
            tickFormatter={formatTime}
            tick={{ fill: '#8b93a7', fontSize: 12 }}
            axisLine={{ stroke: 'rgba(148, 163, 184, 0.2)' }}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#8b93a7', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={ChartTooltip} cursor={{ stroke: 'rgba(232,236,243,0.25)' }} />
          {series.halls.map((hall) => {
            const color = getHallColor(hall.hallId);
            return (
              <Area
                key={hall.hallId}
                type="monotone"
                dataKey={hall.hallId}
                name={hall.hallName}
                stackId="occupancy"
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.14}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
