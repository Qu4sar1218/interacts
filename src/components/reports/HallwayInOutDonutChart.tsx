import { useMemo } from 'react';
import { Label, Pie, PieChart } from 'recharts';

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
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { format, parseISO } from 'date-fns';
import type { HallwayDailyComparisonResponse } from '@/services/reports.service';

const chartConfig = {
  time_in: {
    label: 'TIME_IN (distinct students)',
    color: 'var(--chart-1)',
  },
  time_out: {
    label: 'TIME_OUT (distinct students)',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

type Props = {
  data: HallwayDailyComparisonResponse | null;
  loading?: boolean;
};

export function HallwayInOutDonutChart({ data, loading }: Props) {
  const chartData = useMemo(() => {
    const ins = data?.distinct_check_ins ?? 0;
    const outs = data?.distinct_check_outs ?? 0;
    return [
      { segment: 'time_in', visitors: ins, fill: 'var(--color-time_in)' },
      { segment: 'time_out', visitors: outs, fill: 'var(--color-time_out)' },
    ];
  }, [data]);

  const totalInOut = useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.visitors, 0);
  }, [chartData]);

  const dateLabel = data?.date
    ? format(parseISO(data.date + 'T12:00:00'), 'EEEE, MMM d, yyyy')
    : '';

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Hallway check-in vs check-out</CardTitle>
        <CardDescription>
          Distinct students with TIME_IN vs TIME_OUT raw timelogs at the hallway terminal for {dateLabel || 'selected date'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {loading ? (
          <div className="flex aspect-square max-h-[250px] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : totalInOut === 0 ? (
          <div className="flex aspect-square max-h-[250px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No hallway TIME_IN or TIME_OUT logs for this day.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="segment" />} />
              <Pie
                data={chartData}
                dataKey="visitors"
                nameKey="segment"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {totalInOut.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground"
                          >
                            IN + OUT (distinct)
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          Same basis as admin dashboard: distinct students per log type (a student may appear in both slices).
        </div>
      </CardFooter>
    </Card>
  );
}
