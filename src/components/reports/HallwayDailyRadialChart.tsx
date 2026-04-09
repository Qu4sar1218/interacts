import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

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
  scanned: {
    label: 'Hallway check-ins (distinct)',
    color: 'var(--chart-1)',
  },
  remainder: {
    label: 'No hallway scan',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

type Props = {
  data: HallwayDailyComparisonResponse | null;
  loading?: boolean;
};

export function HallwayDailyRadialChart({ data, loading }: Props) {
  const chartData =
    data && data.enrolled_total > 0
      ? [
          {
            label: 'day',
            scanned: data.distinct_check_ins,
            remainder: data.not_scanned_in_hallway,
          },
        ]
      : [{ label: 'day', scanned: 0, remainder: 0 }];

  const total = data?.enrolled_total ?? 0;
  const dateLabel = data?.date
    ? format(parseISO(data.date + 'T12:00:00'), 'EEEE, MMM d, yyyy')
    : '';

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Hallway vs enrollment (single day)</CardTitle>
        <CardDescription>
          Distinct TIME_IN scans at the hallway terminal vs active enrollments for {dateLabel || 'selected date'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 items-center pb-0">
        {loading ? (
          <div className="flex aspect-square w-full max-w-[250px] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : total === 0 ? (
          <div className="flex aspect-square w-full max-w-[250px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No enrollment data to compare.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-w-[250px]">
            <RadialBarChart data={chartData} endAngle={180} innerRadius={80} outerRadius={130}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) - 16}
                            className="fill-foreground text-2xl font-bold"
                          >
                            {total.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 4}
                            className="fill-muted-foreground"
                          >
                            Enrolled
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </PolarRadiusAxis>
              <RadialBar
                dataKey="scanned"
                stackId="a"
                cornerRadius={5}
                fill="var(--color-scanned)"
                className="stroke-transparent stroke-2"
              />
              <RadialBar
                dataKey="remainder"
                stackId="a"
                cornerRadius={5}
                fill="var(--color-remainder)"
                className="stroke-transparent stroke-2"
              />
            </RadialBarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="leading-none text-muted-foreground">
          Stacked arc: students with at least one hallway TIME_IN that day vs students with no hallway scan that
          day (still enrolled school-wide).
        </div>
      </CardFooter>
    </Card>
  );
}
