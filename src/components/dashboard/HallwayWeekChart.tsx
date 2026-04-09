import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type { HallwayWeekStats } from '@/services/dashboard.service';

const chartConfig = {
  enrolled: {
    label: 'Enrolled (total)',
    color: 'var(--chart-1)',
  },
  hallway: {
    label: 'Students scanned (hallway)',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

function formatWeekRange(weekStart: string, weekEnd: string) {
  try {
    const a = parseISO(weekStart);
    const b = parseISO(weekEnd);
    return `${format(a, 'MMM d')} – ${format(b, 'MMM d, yyyy')} (UTC week)`;
  } catch {
    return `${weekStart} – ${weekEnd}`;
  }
}

export function HallwayWeekChart({
  stats,
  loading,
}: {
  stats: HallwayWeekStats | null;
  loading?: boolean;
}) {
  const chartData = useMemo(() => {
    if (!stats?.days?.length) return [];
    return stats.days.map((d) => ({
      label: d.label,
      date: d.date,
      enrolled: stats.enrolled_total,
      hallway: d.hallway_students,
    }));
  }, [stats]);

  const todayLabel = useMemo(() => {
    if (!stats) return undefined;
    const row = stats.days.find((d) => d.date === stats.today);
    return row?.label;
  }, [stats]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent>
          <Skeleton className="aspect-video w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hallway activity</CardTitle>
          <CardDescription>
            Enrolled students vs distinct students with hallway scans this week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">No data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hallway activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-video max-h-[280px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={(props) => {
                const { x, y, payload } = props;
                const isToday = payload.value === todayLabel;
                return (
                  <text
                    x={x}
                    y={y}
                    dy={16}
                    textAnchor="middle"
                    fill={isToday ? 'var(--primary)' : 'currentColor'}
                    className={isToday ? 'fill-primary text-xs font-semibold' : 'text-xs'}
                  >
                    {String(payload.value)}
                  </text>
                );
              }}
            />
            {todayLabel ? (
              <ReferenceLine
                x={todayLabel}
                stroke="var(--primary)"
                strokeOpacity={0.45}
                strokeDasharray="4 4"
              />
            ) : null}
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Area
              dataKey="hallway"
              type="natural"
              fill="var(--color-hallway)"
              fillOpacity={0.35}
              stroke="var(--color-hallway)"
            />
            <Area
              dataKey="enrolled"
              type="natural"
              fill="var(--color-enrolled)"
              fillOpacity={0.2}
              stroke="var(--color-enrolled)"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full flex-col gap-1 text-sm text-muted-foreground">
          <span>{formatWeekRange(stats.week_start, stats.week_end)}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
